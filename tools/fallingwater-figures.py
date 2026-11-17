#!/usr/bin/env python3 -I
# Copies the screenshots of tests/example-fallingwater.cjs into the site as JPEG figures for the research article.
# Usage: python3 -I tools/fallingwater-figures.py <dir with fallingwater-*.png>
import json, os, sys
from PIL import Image
src = sys.argv[1]; out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mvp', 'img', 'research', 'fallingwater'); os.makedirs(out, exist_ok=True)
figs = json.load(open(os.path.join(src, 'figures.json')))
for f in figs:
    name = f['file'][:-4]; png = os.path.join(src, 'fallingwater-' + name + '.png')
    im = Image.open(png).convert('RGB'); w = 1200; im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(out, f['file']), 'JPEG', quality=78, optimize=True, progressive=True)
print(len(figs), 'figures ->', out, sum(os.path.getsize(os.path.join(out, f['file'])) for f in figs) // 1024, 'KB')
