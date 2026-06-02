#!/usr/bin/env python3
"""Build edit_decisions / scene_plan / asset_manifest for the Karabatan montage.

Data-driven curation: each beat names index ranges (into the 190 contact-sheet
indices) + a target count. We evenly sample within the concatenated ranges to
thin near-duplicate bursts, order beats into the song's emotional arc, and lay
photos on a uniform grid with a small crossfade overlap. The hero group-photo
beat is placed to land on the song's ~2:00 loudness peak.

Emits FULL and a short TEST edit. Photos render via the `photo` cut type
(blur-fill + contain) so faces are never cropped.
"""
import json
import re
from pathlib import Path

ROOT = Path("/Users/azmi/PROJECTS/LLM/OpenMontage/projects/karabatan-family-montage")
IMG = ROOT / "assets/images/full"
MUSIC = str(ROOT / "assets/music/Karabatan.mp3")
ART = ROOT / "artifacts"
LYRICS_SRC = Path("/Users/azmi/PROJECTS/UTILITIES/lyricvideo/extracted-ec0e721d-clean.txt")

ANIMS = ["ken-burns", "ken-burns-slow-zoom", "zoom-in", "pan-right", "pan-left", "zoom-out"]


def src(i):
    # Relative path under remotion-composer/public/ -> resolved via staticFile().
    # Chrome blocks file:// local resources, so images MUST be served from public/.
    return f"karabatan/{i:03d}.jpg"


def sample(ranges, n):
    """Evenly sample n indices from concatenated inclusive ranges (thins bursts)."""
    pool = []
    for a, b in ranges:
        pool.extend(range(a, b + 1))
    pool = [i for i in pool if (IMG / f"{i:03d}.jpg").exists()]
    if n >= len(pool):
        return pool
    step = len(pool) / n
    return [pool[int(k * step)] for k in range(n)]


# Beat order = emotional arc. kenduri ends ~the 2:00 peak so hero lands on it.
BEATS = [
    ("arrival",            "Verse 1",   [(136, 150), (151, 156)], 15),
    ("greetings_embraces", "Verse 1",   [(91, 107)],              13),
    ("kenduri_meals",      "Chorus 1",  [(51, 68), (1, 10)],      15),
    ("hero_groups",        "Chorus 2 (peak)", [(108, 120)],        9),
    ("mingling_joy",       "Verse 2",   [(69, 90)],               12),
    ("outings",            "Verse 2",   [(37, 44), (16, 36)],     14),
    ("portraits_couples",  "Bridge",    [(121, 135)],             11),
    ("farewell",           "Outro",     [(169, 187), (157, 168)], 11),
]

# Faithful per-line Malay translation, one entry per Javanese line in the
# timestamped source (LYRICS_SRC), in order. Javanese text + word-level timing
# is parsed from the source so on-screen text always matches the synced track.
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

_TS = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")


def parse_lyrics():
    """Parse LYRICS_SRC -> [(start, last_word, javanese)] per non-empty line."""
    lines = []
    for raw in LYRICS_SRC.read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        times = [int(m) * 60 + float(s) for m, s in _TS.findall(raw)]
        if not times:
            continue
        text = re.sub(r"\[[^\]]*\]", "", raw)
        text = re.sub(r"\s+", " ", text).strip()
        lines.append((times[0], times[-1], text))
    return lines

TITLE_OPEN = "Karabatan"
TITLE_OPEN_SUB = "Keluarga Malaysia × Sidomoro, Kebumen"
TITLE_CLOSE = "Sehingga Bertemu Lagi"
TITLE_CLOSE_SUB = "Kita pulang ke rumah jiwa yang satu"
CREDIT_TITLE = "“Karabatan”"
CREDIT_SUB = "Lagu — Maznah Moktar"

THEME = {
    "primaryColor": "#C8772E",
    "accentColor": "#D8A657",
    "backgroundColor": "#160E07",
    "surfaceColor": "#221710",
    "textColor": "#F6ECD2",
    "mutedTextColor": "#C9B79A",
    "headingFont": "Playfair Display",
    "bodyFont": "Inter",
    "chartColors": ["#D8A657", "#C8772E", "#A9C47F"],
    "springConfig": {"damping": 24, "stiffness": 120, "mass": 1},
    "transitionDuration": 0.6,
}

OPEN_DUR = 6.0
CLOSE_DUR = 5.0   # closing "Sehingga Bertemu Lagi" card (after lyrics end)
CREDIT_DUR = 3.5  # final minimal song-credit card
STEP_TEST = 2.5   # fixed per-photo step for the short test edit
OVERLAP = 0.7     # crossfade overlap
MUSIC_LEN = 267.2
PHOTO_TAIL = 0.3  # photos run this long past the last lyric before the close card
LYRIC_LEAD = 0.0  # band appears on the vocal onset
LYRIC_TAIL = 1.8  # hold after last word when the next line is far off
LYRIC_GAP = 0.25  # min gap before the next band so two never stack


def build_curated():
    """Return ordered list of (index, beat, section)."""
    seq = []
    seen = set()
    for name, section, ranges, n in BEATS:
        picks = sample(ranges, n)
        for i in picks:
            if i in seen:
                continue
            seen.add(i)
            seq.append((i, name, section))
    return seq


def make_photo_cut(cid, i, beat, section, t_in, t_out, k):
    return {
        "id": cid,
        "type": "photo",
        "source": src(i),
        "in_seconds": round(t_in, 2),
        "out_seconds": round(t_out, 2),
        "animation": ANIMS[k % len(ANIMS)],
        "reason": f"{beat} ({section}) — photo {i:03d}",
        "narrative_role": beat,
        "shot_intent": section,
        "hero_moment": beat == "hero_groups",
    }


def title_cut(cid, text, sub, t_in, t_out):
    return {
        "id": cid,
        "type": "title_card",
        "title": text,
        "subtitle": sub,
        "accentColor": "#D8A657",
        "backgroundColor": "#160E07",
        "in_seconds": round(t_in, 2),
        "out_seconds": round(t_out, 2),
        "reason": "title card",
    }


def lyric_overlays(end_clamp):
    """Full karaoke-style synced lyric bands: every Javanese line over its
    faithful Malay translation, timed from the word-level source. A band holds
    from the vocal onset until just before the next line (or fades during long
    instrumental gaps), and is clamped to the video end."""
    timed = parse_lyrics()
    if len(timed) != len(MALAY):
        raise SystemExit(
            f"lyric line mismatch: source has {len(timed)} lines, MALAY has {len(MALAY)}"
        )
    ov = []
    for i, (start, last, jw) in enumerate(timed):
        next_in = timed[i + 1][0] if i + 1 < len(timed) else None
        t_in = max(0.0, start - LYRIC_LEAD)
        t_out = last + LYRIC_TAIL
        if next_in is not None:
            t_out = min(t_out, next_in - LYRIC_GAP)
        t_out = min(t_out, end_clamp)
        if t_out - t_in < 0.4:  # too short to read; skip
            continue
        ov.append({
            "type": "lyric_band",
            "in_seconds": round(t_in, 3),
            "out_seconds": round(t_out, 3),
            "text": jw,
            "subtitle": MALAY[i],
            "bottomY": 0.84,
            "accentColor": "rgba(216, 166, 87, 0.92)",
        })
    return ov


def assemble(seq, music_fade_out=4.0, step=None):
    # Lyric bands are time-absolute; size the photo section so it runs UNDER every
    # lyric line (the farewell + credit cards then come after the last line, so a
    # subtitled card never collides with the bottom lyric band).
    lyrics = lyric_overlays(MUSIC_LEN)
    lyrics_end = max((o["out_seconds"] for o in lyrics), default=OPEN_DUR)
    photos_end_target = lyrics_end + PHOTO_TAIL
    if step is None:
        step = max(1.5, (photos_end_target - OPEN_DUR) / max(1, len(seq)))

    cuts = [title_cut("title_open", TITLE_OPEN, TITLE_OPEN_SUB, 0, OPEN_DUR)]
    t = OPEN_DUR
    for k, (i, beat, section) in enumerate(seq):
        t_in = t
        t_out = t + step + OVERLAP
        cuts.append(make_photo_cut(f"p{k:03d}", i, beat, section, t_in, t_out, k))
        t += step
    photos_end = t
    close_in = photos_end
    close_out = close_in + CLOSE_DUR
    cuts.append(title_cut("title_close", TITLE_CLOSE, TITLE_CLOSE_SUB, close_in, close_out))
    credit_in = close_out
    credit_out = credit_in + CREDIT_DUR
    cuts.append(title_cut("song_credit", CREDIT_TITLE, CREDIT_SUB, credit_in, credit_out))
    total = credit_out
    # Lyrics clamp to where the photos end so none bleed onto the closing cards.
    lyrics = lyric_overlays(photos_end)

    ed = {
        "schema_version": "1.0",
        "render_runtime": "remotion",
        "renderer_family": "animation-first",
        "delivery_promise": {"motion_required": False, "tone_mode": "warm", "quality_floor": "polished"},
        "themeConfig": THEME,
        "playbook": "clean-professional",
        "cuts": cuts,
        "overlays": lyrics,
        "audio": {
            "music": {
                "src": MUSIC,
                "volume": 1.0,
                "offsetSeconds": 0.0,
                "fadeInSeconds": 1.5,
                "fadeOutSeconds": music_fade_out,
                "loop": False,
            }
        },
        "metadata": {
            "project": "karabatan-family-montage",
            "total_duration_seconds": round(total, 2),
            "photo_count": len(seq),
            "render_runtime": "remotion",
            "proposal_render_runtime": "remotion",
        },
    }
    return ed, total


def asset_manifest(seq):
    assets = []
    for i, beat, section in seq:
        assets.append({
            "id": f"img_{i:03d}",
            "path": src(i),
            "type": "image",
            "scene": beat,
            "provenance": {"provider": "user_photo", "source": "Pictures/family/sidomerene"},
        })
    return {"schema_version": "1.0", "assets": assets,
            "metadata": {"count": len(assets), "source": "user-supplied family photos"}}


def main():
    seq = build_curated()
    ed_full, total = assemble(seq)
    (ART / "edit_decisions.json").write_text(json.dumps(ed_full, indent=2))
    (ART / "asset_manifest.json").write_text(json.dumps(asset_manifest(seq), indent=2))

    # Scene plan (record)
    sp = {"schema_version": "1.0",
          "scenes": [{"id": f"s{k:03d}", "index": i, "beat": b, "section": s} for k, (i, b, s) in enumerate(seq)],
          "metadata": {"total_duration_seconds": round(total, 2), "photo_count": len(seq),
                       "beats": [{"name": n, "section": sec, "target": t} for n, sec, _, t in BEATS]}}
    (ART / "scene_plan.json").write_text(json.dumps(sp, indent=2))

    # TEST edit — 6 varied photos (portrait+landscape across beats) + 1 lyric + titles
    test_idx = [(145, "arrival", "Verse 1"), (95, "greetings_embraces", "Verse 1"),
                (60, "kenduri_meals", "Chorus 1"), (115, "hero_groups", "Chorus 2 (peak)"),
                (40, "outings", "Verse 2"), (175, "farewell", "Outro")]
    test_idx = [(i, b, s) for (i, b, s) in test_idx if (IMG / f"{i:03d}.jpg").exists()]
    ed_test, ttotal = assemble(test_idx, music_fade_out=2.0, step=STEP_TEST)
    # one lyric band over the test (force it into range at ~12s)
    ed_test["overlays"] = [{
        "type": "lyric_band", "in_seconds": 11.0, "out_seconds": 17.5,
        "text": "Malaysia lan Jawa nyawiji", "subtitle": "Malaysia dan Jawa bersua kembali",
        "bottomY": 0.84, "accentColor": "rgba(216, 166, 87, 0.92)",
    }]
    (ART / "edit_decisions_test.json").write_text(json.dumps(ed_test, indent=2))

    n_lyrics = len(ed_full["overlays"])
    photos_end = ed_full["cuts"][-2]["in_seconds"]  # close card start == photos end
    step = (photos_end - OPEN_DUR) / max(1, len(seq))
    print(f"FULL: {len(seq)} photos, {total:.1f}s ({total/60:.1f} min), step {step:.2f}s")
    print(f"      {n_lyrics} lyric bands; photos end {photos_end:.1f}s, music ends {MUSIC_LEN:.1f}s")
    print(f"TEST: {len(test_idx)} photos, {ttotal:.1f}s")
    print("beats:")
    cum = OPEN_DUR
    for n, sec, _, tgt in BEATS:
        got = len([1 for (_, b, _) in seq if b == n])
        print(f"  {n:20s} {sec:18s} target {tgt:2d} got {got:2d}  ~start {cum:6.1f}s")
        cum += got * step


if __name__ == "__main__":
    main()
