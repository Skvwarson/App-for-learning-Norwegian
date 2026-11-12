"""Cut words and short phrases out of the dialogue recordings, so a unit's
vocabulary, examples and role-play lines are spoken by the real voices too.

For every phrase a unit says aloud (words, their examples, grammar examples,
role-play lines) that has no recording of its own, find it inside a recorded
dialogue line, using Whisper word
timestamps, cut it out, and keep it only if Whisper hears exactly that phrase
in the clip. One voice for everything you learn (TEACHER: words, examples,
grammar, model answers); role-play lines only from that same character.
Writes audio/clips/*.mp3 and data/clips.js.

Needs: pip install faster-whisper numpy   (downloads the Whisper "small" model once)
usage: python3 scripts/make-clips.py
"""
import json, os, re, subprocess, difflib, hashlib, tempfile
import numpy as np
from faster_whisper import WhisperModel

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(tempfile.gettempdir(), 'norsk-clip-words.json')
TEACHER = 'Emma'  # the voice for words, grammar and practice until a dedicated recording exists
OUT = os.path.join(REPO, 'audio', 'clips')

data = json.loads(subprocess.run(['node', '-e', f"""
Promise.all([import('{REPO}/data/units.js'), import('{REPO}/data/recordings.js')]).then(([{{ UNITS }}, {{ recordingEntries }}]) => {{
  const rec = new Map(recordingEntries());
  const lines = [], targets = [];
  for (const u of UNITS) {{
    u.dialogue.forEach(([sp, no]) => {{ if (rec.has(no)) lines.push({{ unit: u.id, sp, no, file: rec.get(no) }}); }});
    const say = (t, voice = 'TEACHER') => {{ if (t && !rec.has(t)) targets.push({{ unit: u.id, text: t, voice }}); }};
    for (const w of u.words) {{ say(w.no); if (w.ex) say(w.ex[0]); }}
    for (const [no] of u.grammar.examples ?? []) say(no);
    for (const d of u.grammar.drills ?? []) if (typeof d.a === 'string') say(d.a);
    for (const l of u.roleplay.lines) say(l.who === 'you' ? l.model : l.no, l.who === 'you' ? 'TEACHER' : u.roleplay.partner);
  }}
  console.log(JSON.stringify({{ lines, targets }}));
}});"""], capture_output=True, text=True, check=True).stdout)

def norm(t):
    t = t.lower().replace('{name}', ' ').replace('…', ' ')
    return re.sub(r"[^\wæøå' ]|_", ' ', t).split()

model = WhisperModel('small', device='cpu', compute_type='int8')
def load(path, ss=None, t=None):
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', f'{ss:.3f}', '-t', f'{t:.3f}'] if ss is not None else []) + ['-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.int16).astype(np.float32) / 32768.0

# 1. Word timestamps for every recorded dialogue line (cached between runs).
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
for l in data['lines']:
    if l['file'] in cache: continue
    segs, _ = model.transcribe(load(os.path.join(REPO, l['file'])), language='no', beam_size=5, word_timestamps=True,
                               initial_prompt=l['no'], condition_on_previous_text=False)
    cache[l['file']] = [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]
    json.dump(cache, open(CACHE, 'w'), ensure_ascii=False)

# 2. Script word → (start, end) for words Whisper heard exactly as written.
timed = []
for l in data['lines']:
    script = norm(l['no'])
    hw, ht = [], []
    for a, b, w in cache[l['file']]:
        for x in norm(w): hw.append(x); ht.append((a, b))
    times = [None] * len(script)
    for blk in difflib.SequenceMatcher(None, hw, script, autojunk=False).get_matching_blocks():
        for k in range(blk.size): times[blk.b + k] = ht[blk.a + k]
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(REPO, l['file'])], capture_output=True, text=True).stdout)
    timed.append({**l, 'script': script, 'times': times, 'dur': dur})

def heard(path, ss, t):
    segs, _ = model.transcribe(load(path, ss, t), language='no', beam_size=5, condition_on_previous_text=False, without_timestamps=True)
    return norm(' '.join(s.text for s in segs))

# 3. Find, cut and verify each phrase.
os.makedirs(OUT, exist_ok=True)
clips, done, tried = {}, set(), 0
units = [u['unit'] for u in data['lines']]
for tg in data['targets']:
    want = norm(tg['text'])
    key = ' '.join(want)
    if not want or key in done: continue
    done.add(key)  # first request for a text wins (units are in order)
    voice = TEACHER if tg['voice'] == 'TEACHER' else tg['voice']
    order = sorted([l for l in timed if l['sp'] == voice], key=lambda l: l['unit'] != tg['unit'])
    for l in order:
        s, n = l['script'], len(want)
        hits = [i for i in range(len(s) - n + 1) if s[i:i + n] == want]
        for i in hits:
            span = l['times'][i:i + n]
            if any(x is None for x in span): continue
            prev_end = l['times'][i - 1][1] if i > 0 and l['times'][i - 1] else 0.0
            next_start = l['times'][i + n][0] if i + n < len(s) and l['times'][i + n] else l['dur']
            a = max(prev_end, span[0][0] - 0.08) if i > 0 else 0.0
            b = min(next_start, span[-1][1] + 0.15) if i + n < len(s) else l['dur']
            if b - a < 0.25: continue
            tried += 1
            got = heard(os.path.join(REPO, l['file']), a, b - a)
            ok = got == want if n <= 2 else difflib.SequenceMatcher(None, got, want).ratio() >= 0.85
            if not ok: continue
            name = re.sub(r'[^a-z0-9]+', '-', key.replace('æ', 'ae').replace('ø', 'o').replace('å', 'aa'))[:40].strip('-')
            name = f"{name}-{hashlib.md5(key.encode()).hexdigest()[:6]}.mp3"
            ln = b - a
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{a:.3f}', '-t', f'{ln:.3f}', '-i', os.path.join(REPO, l['file']),
                            '-af', f'afade=t=in:d=0.015,afade=t=out:st={max(0, ln - 0.04):.3f}:d=0.04', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k',
                            os.path.join(OUT, name)], check=True)
            clips[tg['text']] = f'audio/clips/{name}'
            break
        if tg['text'] in clips: break

with open(os.path.join(REPO, 'data', 'clips.js'), 'w') as f:
    f.write('// Words and phrases cut from the dialogue recordings by scripts/make-clips.py\n'
            '// (each checked with speech recognition). Text → audio file.\n'
            f'export const CLIPS = {json.dumps(clips, ensure_ascii=False, indent=1)};\n')
print(f"{len(done)} phrases without a recording · {tried} candidate cuts checked · {len(clips)} clips kept")
