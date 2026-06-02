#!/usr/bin/env bash
# Install the OpenMontage photo-lyric-montage kit into a checkout: symlink the
# new files back to this (canonical) folder and apply the wiring patches.
# Usage: ./install.sh [/path/to/OpenMontage]
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OM="${1:-$HOME/PROJECTS/LLM/OpenMontage}"

if [ ! -d "$OM/remotion-composer" ]; then
  echo "error: '$OM' doesn't look like an OpenMontage checkout (no remotion-composer/)." >&2
  exit 1
fi

link() {  # link <canonical-in-kit> <path-in-OM>
  local target="$1" linkpath="$2"
  mkdir -p "$(dirname "$linkpath")"
  rm -rf "$linkpath"
  ln -s "$target" "$linkpath"
  echo "linked  $linkpath -> $target"
}

# 1) Components
for c in PhotoScene LyricBand TitleCard; do
  link "$KIT/components/$c.tsx" "$OM/remotion-composer/src/components/$c.tsx"
done

# 2) Skill (whole folder)
link "$KIT/skills/photo-lyric-montage" "$OM/.agents/skills/photo-lyric-montage"

# 3) Project scripts (projects/ is gitignored in OpenMontage)
for s in build_edit.py render_run.py; do
  link "$KIT/project-scripts/$s" "$OM/projects/karabatan-family-montage/$s"
done

# 4) Patches to OpenMontage's own tracked files (skip if already applied)
cd "$OM"
for p in "$KIT"/patches/*.patch; do
  if git apply --reverse --check "$p" >/dev/null 2>&1; then
    echo "patch already applied: $(basename "$p")"
  elif git apply --check "$p" >/dev/null 2>&1; then
    git apply "$p" && echo "applied patch: $(basename "$p")"
  else
    echo "WARN: cannot apply $(basename "$p") cleanly (upstream may have changed) — apply by hand." >&2
  fi
done

echo
echo "Done. Next: copy your montage images into remotion-composer/public/<slug>/ (Remotion can't load file://)."
