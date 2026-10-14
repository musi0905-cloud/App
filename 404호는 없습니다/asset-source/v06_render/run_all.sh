#!/bin/sh
# Renders NPC02-NPC10 with render_v06.js into <outRoot>, three at a time. usage: sh run_all.sh <outRoot> [extra args]
out="$1"; [ -n "$out" ] || { echo "usage: sh run_all.sh <outRoot>"; exit 2; }; shift
for n in 02 03 04 05 06 07 08 09 10; do echo "NPC$n"; done | xargs -P 3 -I{} node --expose-gc render_v06.js {} "$out/{}" "$@"
