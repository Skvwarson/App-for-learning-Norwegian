"""Cut a voice-over recording into one file per script line.

The recording is someone reading a script (.txt, one line per sentence, blank
lines between) with short pauses. Whisper word timestamps are matched to the
script word by word; lines Whisper missed are recovered from the pauses
between their neighbours. Every cut is trimmed of silence and then checked by
transcribing it again.

Needs: pip install faster-whisper numpy   (downloads the Whisper "small" model once)
usage: python3 scripts/cut-voiceover.py <script.txt> <recording.mp3> <out dir> [--json out.json]
Writes <out dir>/001.mp3 … and prints a report; --json saves [[text, file, score], …].
"""
import sys, os, re, json, difflib, subprocess, tempfile
import numpy as np
from faster_whisper import WhisperModel

script_path, audio_path, out_dir = sys.argv[1:4]
json_out = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
lines = [l.strip() for l in open(script_path, encoding='utf-8-sig') if l.strip()]

model = WhisperModel('small', device='cpu', compute_type='int8')
def load(path, ss=None, t=None):
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', f'{ss:.3f}', '-t', f'{t:.3f}'] if ss is not None else []) + ['-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.int16).astype(np.float32) / 32768.0
def duration(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)
NUM = {'0': 'null', '1': 'en', '2': 'to', '3': 'tre', '4': 'fire', '5': 'fem', '6': 'seks', '7': 'sju', '8': 'åtte', '9': 'ni', '10': 'ti', '11': 'elleve', '12': 'tolv'}
def norm(t):
    t = t.lower().replace('-', ' ').replace('…', ' ')
    return [NUM.get(w, w) for w in re.sub(r"[^\wæøå ]", ' ', t).split()]

dur = duration(audio_path)
def silences(path, db=-40, d=0.15):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    out, s0 = [], None
    for k, v in re.findall(r'silence_(start|end): ([\d.]+)', r):
        if k == 'start': s0 = float(v)
        elif s0 is not None: out.append((s0, float(v))); s0 = None
    if s0 is not None: out.append((s0, dur))
    return out
sil = silences(audio_path)

# 1. Transcribe in ~20 s chunks cut at pauses (Whisper sometimes skips the start of long windows).
mids = [(a + b) / 2 for a, b in sil if b - a > 0.25]
edges, t = [0.0], 0.0
while dur - t > 24:
    nxt = [x for x in mids if t + 14 < x < t + 22]
    t = nxt[-1] if nxt else t + 20
    edges.append(t)
edges.append(dur)
heard = []
for a0, b0 in zip(edges, edges[1:]):
    segs, _ = model.transcribe(load(audio_path, a0, b0 - a0), language='no', beam_size=5, word_timestamps=True, condition_on_previous_text=False)
    heard += [(a0 + w.start, a0 + w.end, w.word) for s in segs for w in s.words]

# 2. Match heard words to script words.
script, owner = [], []
for li, l in enumerate(lines):
    for w in norm(l): script.append(w); owner.append(li)
hw, ht = [], []
for a, b, w in heard:
    for x in norm(w): hw.append(x); ht.append((a, b))
span = [[None, None] for _ in lines]
def assign(hi, li):
    if span[li][0] is None or ht[hi][0] < span[li][0]: span[li][0] = ht[hi][0]
    if span[li][1] is None or ht[hi][1] > span[li][1]: span[li][1] = ht[hi][1]
for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, hw, script, autojunk=False).get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1): assign(i1 + k, owner[j1 + k])
    elif tag == 'replace' and (i2 - i1) <= 3 * (j2 - j1) + 2:
        for k in range(i2 - i1): assign(i1 + k, owner[j1 + (k * (j2 - j1)) // (i2 - i1)])

# Keep spans in order (a mis-assigned word can't make a line overlap its neighbours).
for li in range(len(lines)):
    if span[li][0] is None: continue
    prev = next((span[k][1] for k in range(li - 1, -1, -1) if span[k][1] is not None), 0.0)
    if span[li][0] < prev - 0.05: span[li] = [None, None]

# 3. Lines Whisper missed: share out the speech between their neighbours by the pauses there.
def speech_segments(lo, hi):
    segs, cur = [], lo
    for a, b in sil:
        if b <= lo or a >= hi: continue
        if a - cur > 0.06: segs.append((cur, min(a, hi)))
        cur = max(cur, b)
    if hi - cur > 0.06: segs.append((cur, hi))
    return segs
li = 0
while li < len(lines):
    if span[li][0] is not None: li += 1; continue
    run_end = li
    while run_end < len(lines) and span[run_end][0] is None: run_end += 1
    lo = next((span[k][1] for k in range(li - 1, -1, -1) if span[k][1] is not None), 0.0)
    hi = span[run_end][0] if run_end < len(lines) else dur
    segs = speech_segments(lo + 0.02, hi - 0.02)
    n = run_end - li
    if len(segs) >= n and n:
        # merge the extra segments where the gap is shortest until there is one per line
        while len(segs) > n:
            k = min(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1])
            segs[k:k + 2] = [(segs[k][0], segs[k + 1][1])]
        for k in range(n): span[li + k] = list(segs[k])
    li = run_end

# 4. Cut at the middle of the pause between lines, trim silence, check each piece.
os.makedirs(out_dir, exist_ok=True)
TH = '-45dB'
trim = (f"silenceremove=start_periods=1:start_duration=0:start_threshold={TH}:start_silence=0.08,"
        f"areverse,silenceremove=start_periods=1:start_duration=0:start_threshold={TH}:start_silence=0.12,areverse,"
        "afade=t=in:d=0.01")
def quietest(lo, hi):
    best = None
    for a, b in sil:
        a2, b2 = max(a, lo), min(b, hi)
        if b2 - a2 > 0.03 and (best is None or b2 - a2 > best[1] - best[0]): best = (a2, b2)
    return (best[0] + best[1]) / 2 if best else (lo + hi) / 2
results, problems = [], []
for li, l in enumerate(lines):
    s, e = span[li]
    if s is None:
        problems.append(f'{li + 1:03d} NOT FOUND: {l}'); results.append([l, None, 0]); continue
    prev_e = next((span[k][1] for k in range(li - 1, -1, -1) if span[k][1] is not None), 0.0)
    next_s = next((span[k][0] for k in range(li + 1, len(lines)) if span[k][0] is not None), dur)
    a = quietest(prev_e, s) if li else max(0, s - 0.3)
    b = quietest(e, next_s) if next_s < dur else min(dur, e + 0.5)
    a, b = max(a, s - 0.4), min(b, e + 0.6)
    name = f'{li + 1:03d}.mp3'
    tmp = os.path.join(out_dir, name + '.wav')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{a:.3f}', '-t', f'{b - a:.3f}', '-i', audio_path, tmp], check=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-af', trim, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', os.path.join(out_dir, name)], check=True)
    os.remove(tmp)
    segs, _ = model.transcribe(load(os.path.join(out_dir, name)), language='no', beam_size=5, condition_on_previous_text=False, without_timestamps=True)
    got = norm(' '.join(x.text for x in segs))
    score = difflib.SequenceMatcher(None, got, norm(l)).ratio()
    results.append([l, name, round(score, 2)])
    if score < 0.5: problems.append(f'{li + 1:03d} {score:.2f} "{l}"  heard: "{" ".join(got)}"')
ok = sum(1 for r in results if r[1])
print(f'{os.path.basename(script_path)}: {ok}/{len(lines)} lines cut, {dur:.0f} s')
if problems: print('  CHECK:\n   ' + '\n   '.join(problems))
if json_out: json.dump(results, open(json_out, 'w'), ensure_ascii=False)
