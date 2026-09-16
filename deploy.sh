#!/bin/zsh
set -euo pipefail

project_dir=${0:A:h}
public_dir=${PIXELFORGE_PUBLIC_DIR:-"$HOME/Sites/pixelforge"}

if [[ ! -f "$project_dir/dist/index.html" ]]; then
  print -u2 "Kan dist/index.html niet vinden in: $project_dir"
  exit 1
fi

mkdir -p "$public_dir"
cp "$project_dir/dist/index.html" "$public_dir/index.html"

print "PixelForge bijgewerkt in $public_dir"
curl -fsS -I --max-time 3 http://127.0.0.1:8088/ | head -n 1
