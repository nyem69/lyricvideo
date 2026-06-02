#!/usr/bin/env python3
"""Collapse word-timestamped lyrics into YouTube-ready SRT subtitle files.

Source: extracted-ec0e721d-clean.txt — each non-empty line is one lyric line
with inline [mm:ss.xxx] word timestamps. We take the first timestamp as the
cue start and the last word as the reference for the cue end, holding each line
until just before the next one (and fading out across long instrumental gaps so
a lyric never lingers over silence).

Emits three tracks (upload whichever you want as a YouTube caption track):
  karabatan.jv.srt        Javanese only
  karabatan.ms.srt        Malay only
  karabatan.bilingual.srt Javanese over Malay (two lines per cue)
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "extracted-ec0e721d-clean.txt"

# Faithful per-line Malay translation, one entry per Javanese line, in order.
# (Kept identical to the montage video's lyric track.)
MALAY = [
    # Verse 1
    "Kita berasal dari satu asal yang sama",
    "Luhurnya rasa bersatu dalam sanubari",
    "Bukan sekadar darah, bukan sekadar jasad",
    "Tetapi rasa yang bersinar sejati",
    "Dari sunyi kita belajar memahami",
    "Bahawa hidup itu pada yang sejati",
    "Rasa yang tumbuh tanpa pamrih",
    "Menuntun hati pulang kepada yang suci",
    # Chorus 1
    "Semoga kita dipertemukan lagi",
    "Dalam ikatan rasa tanpa batas",
    "Malaysia dan Jawa menyatu",
    "Dalam cahaya kesejahteraan yang sejati",
    "Satu rasa, satu panggilan",
    "Satu cahaya, satu perjalanan",
    "Dalam syurga rasa yang abadi",
    "Kita semua takkan terpisah",
    # Verse 2
    "Dalam sunyi hati menyebut nama-Nya",
    "Alam rasa menyatu dalam jiwa",
    "Tiada batas antara negara",
    "Bila rasa telah menjadi satu",
    "Keturunan ini bukan pemisah",
    "Tetapi jambatan persaudaraan",
    "Dari timur hingga ke seberang",
    "Menyatu dalam cahaya kebersamaan",
    # Chorus 2
    "Semoga kita dipertemukan lagi",
    "Dalam ikatan rasa tanpa batas",
    "Malaysia dan Jawa menyatu",
    "Dalam cahaya kesejahteraan yang sejati",
    "Satu rasa, satu panggilan",
    "Satu cahaya, satu perjalanan",
    "Dalam syurga rasa yang abadi",
    "Kita semua takkan terpisah",
    # Outro
    "Tanpa pisah… tanpa batas…",
    "Hanya rasa yang tetap menyatu…",
    "Dalam cahaya… dalam kesejahteraan…",
    "Kita pulang… kepada yang satu…",
]

TS = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
GAP = 0.08    # leave this much before the next cue (no overlaps)
TAIL = 2.2    # hold after the last word when the next line is far off
LAST_TAIL = 3.5  # hold the final line a touch longer


def parse(path):
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        times = [int(m) * 60 + float(s) for m, s in TS.findall(raw)]
        if not times:
            continue
        text = re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", raw)).strip()
        lines.append((times[0], times[-1], text))
    return lines


def fmt(t):
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms == 1000:  # rounding spill
        s += 1
        ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def cues(lines):
    out = []
    for i, (start, last, jw) in enumerate(lines):
        nxt = lines[i + 1][0] if i + 1 < len(lines) else None
        if nxt is not None:
            end = min(nxt - GAP, last + TAIL)
        else:
            end = last + LAST_TAIL
        end = max(end, start + 0.6)  # never shorter than 0.6s
        out.append((start, end, jw, MALAY[i]))
    return out


def write_srt(path, cues_, mode):
    blocks = []
    for n, (start, end, jw, ms) in enumerate(cues_, 1):
        if mode == "jv":
            body = jw
        elif mode == "ms":
            body = ms
        else:
            body = f"{jw}\n{ms}"
        blocks.append(f"{n}\n{fmt(start)} --> {fmt(end)}\n{body}\n")
    path.write_text("\n".join(blocks), encoding="utf-8")


def main():
    lines = parse(SRC)
    if len(lines) != len(MALAY):
        raise SystemExit(f"line mismatch: source {len(lines)} vs MALAY {len(MALAY)}")
    c = cues(lines)
    write_srt(HERE / "karabatan.jv.srt", c, "jv")
    write_srt(HERE / "karabatan.ms.srt", c, "ms")
    write_srt(HERE / "karabatan.bilingual.srt", c, "both")
    print(f"{len(c)} cues -> karabatan.jv.srt, karabatan.ms.srt, karabatan.bilingual.srt")
    print(f"first cue: {fmt(c[0][0])} --> {fmt(c[0][1])}  {c[0][2]}")
    print(f"last cue:  {fmt(c[-1][0])} --> {fmt(c[-1][1])}  {c[-1][2]}")


if __name__ == "__main__":
    main()
