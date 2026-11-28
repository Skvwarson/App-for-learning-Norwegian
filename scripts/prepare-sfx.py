#!/usr/bin/env python3
"""Prepare sound effects downloaded from ElevenLabs for the app.

    python3 scripts/prepare-sfx.py tap ~/Downloads/tap*.mp3

Each file becomes audio/sfx/<name>-1.mp3, -2.mp3 … (old variants of that name are
replaced): silence trimmed from both ends, cut to a maximum length with a short
fade, mono, and brought to the loudness that suits the sound (taps quiet,
celebrations loud). Then data/sfx.js is updated so the app uses them.
Needs ffmpeg.
"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# name: (peak level in dBFS, maximum length in seconds)
SOUNDS = {
    'tap': (-18, 0.25), 'tile': (-18, 0.3), 'page-right': (-16, 0.6), 'page-left': (-16, 0.6),
    'correct': (-12, 0.9), 'almost': (-13, 0.9), 'wrong': (-14, 0.9), 'bonus': (-10, 1.5),
    'step-done': (-10, 2.0), 'streak': (-9, 2.5), 'lesson-done': (-8, 3.0), 'level-up': (-8, 3.0), 'day-done': (-8, 3.5),
}

def peak_db(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True, stdin=subprocess.DEVNULL).stderr
    return float(re.search(r'max_volume: (-?[\d.]+) dB', out).group(1))

def main():
    if len(sys.argv) < 3 or sys.argv[1] not in SOUNDS:
        sys.exit(f'Usage: prepare-sfx.py <name> <file> [file …]\nNames: {", ".join(SOUNDS)}')
    name, files = sys.argv[1], [pathlib.Path(f) for f in sys.argv[2:]]
    target, max_len = SOUNDS[name]
    out_dir = ROOT / 'audio' / 'sfx'
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob(f'{name}-*.mp3'):
        old.unlink()
    fade = min(0.08, max_len / 4)
    for i, src in enumerate(files, 1):
        tmp = out_dir / f'.{name}-{i}.wav'
        trim = ('silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
                'silenceremove=start_periods=1:start_threshold=-55dB,areverse,'
                f'atrim=0:{max_len},afade=t=out:st={max_len - fade}:d={fade}')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(src), '-ac', '1', '-ar', '44100', '-af', trim, str(tmp)],
                       check=True, stdin=subprocess.DEVNULL)
        gain = target - peak_db(tmp)
        dst = out_dir / f'{name}-{i}.mp3'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(tmp), '-af', f'volume={gain:.1f}dB',
                        '-codec:a', 'libmp3lame', '-b:a', '128k', str(dst)], check=True, stdin=subprocess.DEVNULL)
        tmp.unlink()
        print(f'{dst.relative_to(ROOT)}  ({gain:+.1f} dB)')

    # Update the list in data/sfx.js.
    js = ROOT / 'data' / 'sfx.js'
    text = js.read_text()
    body = re.search(r'export const SFX_FILES = \{\n(.*?)\};', text, re.S)
    entries = dict(re.findall(r"^\s*'?([\w-]+)'?: (\d+),", body.group(1), re.M))
    entries[name] = str(len(files))
    lines = ''.join(f"  '{k}': {v},\n" for k, v in sorted(entries.items(), key=lambda kv: list(SOUNDS).index(kv[0])))
    js.write_text(text[:body.start(1)] + lines + text[body.end(1):])
    print(f'data/sfx.js: {name} has {len(files)} variant(s). Bump the app version (sw.js + js/core/version.js) before pushing.')

if __name__ == '__main__':
    main()
