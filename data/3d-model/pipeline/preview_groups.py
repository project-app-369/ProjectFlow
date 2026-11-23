"""Side, front and top views of a model with every leaf in the colour of its group: python preview_groups.py jacket|linkbridge"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
M = Path(__file__).parent / "out" / "m"
sys.path.insert(0, str(Path(__file__).parent))
import classify_models as cm
model = sys.argv[1]
groups = {"jacket": cm.JACKET_GROUPS, "linkbridge": cm.BRIDGE_GROUPS}[model]
assign = np.array((M / f"{model}_assign.txt").read_text().split("\n"), dtype=object)
cs = np.load(M / f"{model}_cent.npy"); li = np.load(M / f"{model}_li.npy")
def rgb(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
w, h = 700, 560
def panel(axes, zr, title):
    a, b = axes
    keep = (cs[:, 2] > zr[0]) & (cs[:, 2] < zr[1])
    x, y = cs[keep, a], cs[keep, b]
    lo = np.array([x.min(), y.min()]); hi = np.array([x.max(), y.max()])
    s = min((w - 20) / (hi[0] - lo[0]), (h - 30) / (hi[1] - lo[1]))
    img = np.full((h, w, 3), 255, np.uint8)
    g = assign[li[keep]]
    order = [k for k, _, _ in groups]
    for k in order[::-1] if False else order:
        sel = g == k
        px = ((x[sel] - lo[0]) * s + 10).astype(int); py = (h - 15 - (y[sel] - lo[1]) * s).astype(int)
        col = rgb(dict((i, c) for i, _, c in groups)[k])
        if k == order[0]: col = (205, 205, 205)
        ok = (px >= 0) & (px < w) & (py >= 0) & (py < h); img[py[ok], px[ok]] = col
    im = Image.fromarray(img); ImageDraw.Draw(im).text((8, 3), title, fill=(0, 0, 0)); return im
zr = (-1e9, 1e9) if model != "jacket" else (-62, 40)
ims = [panel((0, 2), zr, "side"), panel((1, 2), zr, "front"), panel((0, 1), zr, "top")]
W = Image.new('RGB', (1400, 1120), 'white')
for i, im in enumerate(ims): W.paste(im, ((i % 2) * 700, (i // 2) * 560))
d = ImageDraw.Draw(W)
for i, (k, n, c) in enumerate(groups): d.rectangle((720 + (i//4)*0, 580 + i*16, 732, 592 + i*16), fill=rgb(c)); d.text((740, 579 + i*16), n, fill=(0, 0, 0))
W.save(M / f"{model}_groups.png"); print('ok')
