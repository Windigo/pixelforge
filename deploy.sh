#!/bin/zsh
set -euo pipefail

project_dir=${0:A:h}
public_dir=${PIXELFORGE_PUBLIC_DIR:-"$HOME/Sites/pixelforge"}

cd "$project_dir"

if [[ ! -f "package.json" ]]; then
  print -u2 "package.json niet gevonden in: $project_dir"
  exit 1
fi

print "PixelForge bouwen…"
npm run build

mkdir -p "$public_dir"
rm -rf "$public_dir"/*
cp -R "$project_dir"/dist/. "$public_dir"/

print "PixelForge bijgewerkt in $public_dir"
curl -fsS -I --max-time 3 http://127.0.0.1:8088/ | head -n 1
