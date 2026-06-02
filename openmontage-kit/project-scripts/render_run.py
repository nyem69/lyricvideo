#!/usr/bin/env python3
"""Render the Karabatan montage: Remotion (silent) -> ffmpeg music mux.

Remotion's <Audio> can't load file:// paths and video_compose caps renders at
600s, so we drive Remotion directly (silent) and mux the music with ffmpeg
(fades + trim). Images load fine via file://.

Usage: render_run.py [test|full] [width] [height]
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("/Users/azmi/PROJECTS/LLM/OpenMontage/projects/karabatan-family-montage")
ART = ROOT / "artifacts"
COMPOSER = Path("/Users/azmi/PROJECTS/LLM/OpenMontage/remotion-composer")

which = sys.argv[1] if len(sys.argv) > 1 else "test"
W = sys.argv[2] if len(sys.argv) > 2 else "1920"
H = sys.argv[3] if len(sys.argv) > 3 else "1080"

ed_file = "edit_decisions_test.json" if which == "test" else "edit_decisions.json"
silent = ROOT / "renders" / (f"{which}_silent.mp4")
final = ROOT / "renders" / ("test.mp4" if which == "test" else "final.mp4")
final.parent.mkdir(parents=True, exist_ok=True)

ed = json.loads((ART / ed_file).read_text())
music = ed.get("audio", {}).get("music", {})
music_src = music.get("src")
fade_in = music.get("fadeInSeconds", 1.5)
fade_out = music.get("fadeOutSeconds", 4.0)

# Strip audio from props — Remotion renders silent; ffmpeg muxes music after.
props = dict(ed)
props.pop("audio", None)
props_path = ROOT / "renders" / f".props_{which}.json"
props_path.write_text(json.dumps(props))

total = ed["metadata"]["total_duration_seconds"]
print(f"[1/2] Remotion render ({which}): {len(ed['cuts'])} cuts, {total:.1f}s @ {W}x{H} -> {silent}")
t0 = time.time()
r = subprocess.run(
    ["npx", "remotion", "render", str(COMPOSER / "src" / "index.tsx"), "Explainer",
     str(silent), "--props", str(props_path), "--width", W, "--height", H,
     "--concurrency", "8"],
    cwd=str(COMPOSER), capture_output=True, text=True,
)
dur = time.time() - t0
if r.returncode != 0:
    print("RENDER FAILED:\n", r.stdout[-1500:], "\n", r.stderr[-2500:])
    sys.exit(1)
print(f"   rendered in {dur/60:.1f} min")

print(f"[2/2] ffmpeg mux music ({Path(music_src).name}) with fades -> {final}")
# Probe music length so the fade-out lands at the song's real end (the video may
# run a few seconds longer for the closing/credit cards). apad extends the track
# with silence to the video length so -shortest matches the video, not the song.
mp = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=nw=1:nk=1", music_src], capture_output=True, text=True)
music_dur = float(mp.stdout.strip() or total)
fade_out_st = max(0.0, music_dur - fade_out)
af = (f"afade=t=in:st=0:d={fade_in},"
      f"afade=t=out:st={fade_out_st:.2f}:d={fade_out},apad")
print(f"   video {total:.1f}s, music {music_dur:.1f}s, fade-out at {fade_out_st:.1f}s")
m = subprocess.run(
    ["ffmpeg", "-y", "-i", str(silent), "-i", music_src,
     "-filter:a", af, "-map", "0:v:0", "-map", "1:a:0",
     "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(final)],
    capture_output=True, text=True,
)
if m.returncode != 0:
    print("MUX FAILED:\n", m.stderr[-2000:])
    sys.exit(1)
# probe
p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                    "format=duration:stream=width,height,codec_type",
                    "-of", "default=nw=1", str(final)], capture_output=True, text=True)
print("OK ->", final)
print(p.stdout)
