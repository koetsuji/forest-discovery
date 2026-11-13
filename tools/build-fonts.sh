#!/bin/sh
# Rebuilds the font subsets in styles/fonts/ from the Geist package on npm.
# Only needed when the fonts or the character set change.
# Needs: npm, and Python with fonttools and brotli (pip install fonttools brotli).
set -e
VERSION=1.9.2
WORK=$(mktemp -d)
OUT="$(cd "$(dirname "$0")/.." && pwd)/styles/fonts"
(cd "$WORK" && npm pack "geist@$VERSION" --silent && tar -xzf "geist-$VERSION.tgz")
SRC="$WORK/package/dist/fonts"
# Printable ASCII: every character an English interface, a seed or a count can show.
RANGE="U+0020-007E"
pyftsubset "$SRC/geist-sans/Geist-Variable.ttf" --unicodes=$RANGE --flavor=woff2 --layout-features=kern,liga,calt --output-file="$OUT/geist-sans.woff2"
pyftsubset "$SRC/geist-mono/GeistMono-Variable.ttf" --unicodes=$RANGE --flavor=woff2 --layout-features=kern --output-file="$OUT/geist-mono.woff2"
pyftsubset "$SRC/geist-pixel/GeistPixel-Square.woff2" --unicodes=$RANGE --flavor=woff2 --layout-features=kern --output-file="$OUT/geist-pixel-square.woff2"
cp "$WORK/package/LICENSE.txt" "$OUT/LICENSE.txt"
rm -rf "$WORK"
ls -l "$OUT"
