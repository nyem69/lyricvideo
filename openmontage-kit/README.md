# OpenMontage Kit — photo + lyric montage

Custom skill, Remotion components, and project scripts for building warm photo
montage music videos (with synced bilingual lyrics) in
[OpenMontage](https://github.com/calesthio/OpenMontage). Kept **here** (in the
`lyricvideo` repo) rather than in the OpenMontage repo, which is upstream.

These files are the **canonical source**. In a working OpenMontage checkout they
are **symlinks** back into this folder, so editing them in either place keeps
both in sync. Run `install.sh` to (re)create the links on a fresh checkout.

## Contents

```
openmontage-kit/
  skills/photo-lyric-montage/SKILL.md   # the reusable recipe (Skill-tool discoverable)
  components/                           # Remotion scene components
    PhotoScene.tsx                      #   cut type "photo" — contain + quarter-res blur-fill (no face crops)
    LyricBand.tsx                       #   overlay type "lyric_band" — bilingual synced lyric line
    TitleCard.tsx                       #   cut type "title_card" — warm Playfair title/credit card
  project-scripts/                      # worked example (the karabatan-family-montage build)
    build_edit.py                       #   curation + beat arc + lyric sync -> edit_decisions.json
    render_run.py                       #   silent Remotion render + ffmpeg music mux
  patches/                             # edits to OpenMontage's OWN tracked files (apply with git apply)
    Explainer.tsx.patch                 #   wires the 3 components into the Explainer composition
    components-index.ts.patch           #   exports them
    SCENE_TYPES.md.patch                #   documents the new cut/overlay types
  install.sh                            # symlink the new files + apply the patches into a checkout
```

The SRT generator (`../make_srt.py`) and the `karabatan.*.srt` outputs live at
the repo root — they're standalone and not OpenMontage-specific.

## Symlink map (canonical here → link in OpenMontage)

| This repo | OpenMontage checkout |
|---|---|
| `skills/photo-lyric-montage/` | `.agents/skills/photo-lyric-montage` |
| `components/{PhotoScene,LyricBand,TitleCard}.tsx` | `remotion-composer/src/components/` |
| `project-scripts/{build_edit,render_run}.py` | `projects/karabatan-family-montage/` |

`projects/` is gitignored in OpenMontage, so the project scripts are only ever
tracked here.

## Install onto a checkout

```bash
./install.sh /path/to/OpenMontage   # defaults to ~/PROJECTS/LLM/OpenMontage
```

It creates the symlinks and applies the three patches (skipping any already
applied). After installing, copy your montage's images into
`remotion-composer/public/<slug>/` (Remotion can't load `file://`).

## Updating a patch

The patches are snapshots against OpenMontage's tracked files. If you change the
wiring, regenerate from the OpenMontage checkout:

```bash
cd /path/to/OpenMontage
git diff -- remotion-composer/src/Explainer.tsx > /path/to/openmontage-kit/patches/Explainer.tsx.patch
```

See `skills/photo-lyric-montage/SKILL.md` for the full workflow and the gotcha
table (file:// rejection, face-crop, the 600s render cap, blur cost, card/lyric
collision, non-Latin fonts, the apad/fade muxer trick).
