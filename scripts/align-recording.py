"""Cut a speaker's whole-course recording into dialogue lines using Whisper word
timestamps. Words that aren't in the script (spoken "Unit 3" headings etc.) are
skipped. Cuts are snapped to the quietest point between two lines.

Better than split-recording.mjs when pauses are uneven or headings were read aloud.
Needs: pip install faster-whisper numpy (downloads the Whisper "small" model once).

usage: python3 scripts/align-recording.py <Speaker> <file.mp3> [--write]
"""
import sys, json, re, subprocess, difflib, os, tempfile
import numpy as np
from faster_whisper import WhisperModel

_model = None
def model():
    global _model
    _model = _model or WhisperModel('small', device='cpu', compute_type='int8')
    return _model

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

def words(path, prompt=None):
    segs, _ = model().transcribe(load(path), language='no', beam_size=5, word_timestamps=True, initial_prompt=prompt, vad_filter=False, condition_on_previous_text=False)
    return [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]

def text(path):
    segs, _ = model().transcribe(load(path), language='no', beam_size=5, vad_filter=False)
    return ' '.join(s.text.strip() for s in segs)


class asr:
    words = staticmethod(words)

speaker, path = sys.argv[1], sys.argv[2]
write = '--write' in sys.argv
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.loads(subprocess.run(['node', '-e', f"""
import('{REPO}/data/units.js').then(({{UNITS}}) => {{
  const out = [];
  for (const u of UNITS) u.dialogue.forEach(([sp, no], i) => {{ if (sp === {json.dumps(speaker)}) out.push([u.id, i + 1, no]); }});
  console.log(JSON.stringify(out));
}});"""], capture_output=True, text=True, check=True).stdout)

NUM = {'0': 'null', '1': 'en', '2': 'to', '3': 'tre', '4': 'fire', '5': 'fem', '6': 'seks', '7': 'sju', '8': 'åtte', '9': 'ni', '10': 'ti'}
def norm(t):
    t = t.lower().replace('-', ' ').replace('…', ' ')
    return [NUM.get(w, w) for w in re.sub(r"[^\wæøå ]", ' ', t).split()]

cache = os.path.join(tempfile.gettempdir(), f"align-words-{speaker}.json")
if os.path.exists(cache):
    heard = json.load(open(cache))
else:
    heard = []
    sil0 = []
    r0 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True)
    st0 = None
    for kind, v in re.findall(r'silence_(start|end): ([\d.]+)', r0.stderr):
        if kind == 'start': st0 = float(v)
        elif st0 is not None: sil0.append((st0 + float(v)) / 2); st0 = None
    total = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout)
    edges, t = [0.0], 0.0
    while total - t > 22:
        nxt = [x for x in sil0 if t + 12 < x < t + 22]
        t = nxt[-1] if nxt else t + 20
        edges.append(t)
    edges.append(total)
    tmp = cache + '.wav'
    for a0, b0 in zip(edges, edges[1:]):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a0:.3f}', '-t', f'{b0 - a0:.3f}', '-i', path, tmp], check=True)
        heard += [(a0 + x, a0 + y, w) for x, y, w in asr.words(tmp)]
    json.dump(heard, open(cache, 'w'), ensure_ascii=False)

# Flatten script words, remembering their line; flatten heard words (a heard token may hold several words).
script, owner = [], []
for li, (_, _, no) in enumerate(lines):
    for w in norm(no):
        script.append(w); owner.append(li)
# Spoken headings ("Unit 14") are never part of a line: drop them and remember where they are.
headers, skip = [], 0
toks = [(a, b, norm(t)) for a, b, t in heard]
hw, htime = [], []
for k, (a, b, ws) in enumerate(toks):
    if skip: skip -= 1; continue
    if ws and ws[0] in ('unit', 'junit', 'enhet'):
        end = b
        if len(ws) == 1 and k + 1 < len(toks): end = toks[k + 1][1]; skip = 1
        headers.append((a, end)); continue
    for w in ws:
        hw.append(w); htime.append((a, b))

sm = difflib.SequenceMatcher(None, hw, script, autojunk=False)
span = [[None, None] for _ in lines]   # heard index range per line
matched = [0] * len(lines)
def assign(hi, li):
    if span[li][0] is None or hi < span[li][0]: span[li][0] = hi
    if span[li][1] is None or hi > span[li][1]: span[li][1] = hi
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1):
            matched[owner[j1 + k]] += 1; assign(i1 + k, owner[j1 + k])
    elif tag == 'replace' and (i2 - i1) <= 3 * (j2 - j1) + 2:
        # misheard words ("120" for "hundre og tjue") belong to the lines they replace
        for k in range(i2 - i1):
            assign(i1 + k, owner[j1 + (k * (j2 - j1)) // (i2 - i1)])

dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout)
# Quiet stretches, for snapping cut points.
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], capture_output=True, text=True)
sil, st = [], None
for kind, v in re.findall(r'silence_(start|end): ([\d.]+)', r.stderr):
    if kind == 'start': st = float(v)
    elif st is not None: sil.append((st, float(v))); st = None

def snap(lo, hi):
    """Middle of the longest silence between lo and hi (else the midpoint)."""
    best = None
    for a, b in sil:
        a2, b2 = max(a, lo), min(b, hi)
        if b2 - a2 > 0.05 and (best is None or b2 - a2 > best[1] - best[0]): best = (a2, b2)
    return ((best[0] + best[1]) / 2) if best else (lo + hi) / 2

# Missing lines get interpolated between neighbours; report them.
times = []
for li, (a, b) in enumerate(span):
    times.append((htime[a][0], htime[b][1]) if a is not None else None)
problems = []
cuts = []
for li, (u, n, no) in enumerate(lines):
    words_n = len(norm(no))
    ratio = matched[li] / max(1, words_n)
    if times[li] is None or ratio < 0.6:
        problems.append(f'{u}/{n:02d} only {matched[li]}/{words_n} words heard: {no}')
    if times[li] is None:
        cuts.append(None); continue
    s, e = times[li]
    prev_end = next((times[k][1] for k in range(li - 1, -1, -1) if times[k]), 0.0)
    next_start = next((times[k][0] for k in range(li + 1, len(lines)) if times[k]), dur)
    hdr = [h for h in headers if prev_end - 0.05 <= h[0] and h[1] <= s + 0.05]
    if hdr: prev_end = max(prev_end, max(h[1] for h in hdr))
    hdr2 = [h for h in headers if e - 0.05 <= h[0] and h[1] <= next_start + 0.05]
    if hdr2: next_start = min(next_start, min(h[0] for h in hdr2))
    a = snap(prev_end, s) if li else max(0.0, s - 0.25)
    if li == 0 and prev_end == 0.0: a = max(0.0, min(a, s - 0.05))
    b = snap(e, next_start) if next_start < dur else min(dur, e + 0.3)
    # never keep more than 0.35 s of lead/tail silence
    a = max(a, s - 0.35); b = min(b, e + 0.45)
    cuts.append((a, b))

# Words the speaker said that aren't in the script (e.g. "Unit 4").
extra = []
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag in ('insert', 'replace', 'delete') and i2 > i1 and (j2 - j1) < (i2 - i1):
        extra.append(f"{htime[i1][0]:.1f}s: {' '.join(hw[i1:i2])}")

print(f'{speaker}: {len(lines)} lines, {dur:.1f} s')
for (u, n, no), c in zip(lines, cuts):
    print(f"{u}/{n:02d} {('%.2f-%.2f' % c) if c else '   MISSING   '}  {no}")
if extra: print('Not in script:', ' | '.join(extra[:40]))
if problems: print('PROBLEMS:\n  ' + '\n  '.join(problems))

if write:
    for (u, n, no), c in zip(lines, cuts):
        if not c: continue
        a, b = c; ln = b - a
        out = f'{REPO}/audio/{u}/{n:02d}.mp3'
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{a:.3f}', '-t', f'{ln:.3f}', '-i', path,
                        '-af', f'afade=t=in:d=0.02,afade=t=out:st={max(0, ln - 0.05):.3f}:d=0.05', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', out], check=True)
    print('written')
