"""Bouwt de 3D-Maatje-vormen en -texturen uit het officiële Home-plaatje.

Gebruik: python3 scripts/maatje-3d/build.py
Vereist: numpy, opencv-python-headless, pillow. Alleen nodig als het
Home-plaatje verandert; de uitvoer staat in de repo.

Bron: assets/branding/maatje-home-c-hd.webp, het Home-plaatje (640 px)
4x vergroot met OpenCV dnn_superres (EDSR x4) en verkleind naar 2048 px,
zodat Maatje ook groot in beeld scherp blijft.
"""
import json
from pathlib import Path
import numpy as np, cv2
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/branding/maatje-home-c-hd.webp"
OUT_DIR = ROOT / "public/branding/maatje-3d"
OUT_JSON = ROOT / "src/components/maatje/maatje-model.json"
OUT_DIR.mkdir(parents=True, exist_ok=True)

im = np.array(Image.open(SRC).convert("RGBA"))
H, W = im.shape[:2]
S = W / 512
K = W / 640  # pixelmaten hieronder zijn afgesteld op 640 px
r, g, b, a = [im[..., i].astype(int) for i in range(4)]
A = a > 128
navy = A & (b > r + 25) & (r < 90) & (g < 110)
light = A & ~navy
_, lab = cv2.connectedComponents(light.astype(np.uint8), connectivity=4)

def comp(x, y):
    return (lab == lab[int(y * S), int(x * S)]).astype(np.uint8)

def fill(mask):
    out = mask.copy()
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(out, cnts, -1, 1, -1)
    return out

def disk(px):
    k = int(round(px * K)) * 2 + 1
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))

body = fill(comp(260, 330))
hands = [fill(comp(95, 320)), fill(comp(430, 330))]
sparks = [fill(comp(x, y)) for x, y in [(80, 185), (50, 215), (440, 175), (460, 215)]]

# Rand-dikte meten boven de handjes: eerste dekkende pixel tot eerste lichte bodypixel.
rims = []
for y in range(int(95 * S), int(140 * S)):
    xs_a = np.where(A[y])[0]
    xs_b = np.where(body[y])[0]
    if len(xs_a) and len(xs_b):
        rims.append(xs_b.min() - xs_a.min())
rim = float(np.median(rims))

# Achter de handjes is de rand van het lijf niet zichtbaar: lineair doortrekken.
for side, hand in zip(("left", "right"), hands):
    hy = np.where(hand.any(axis=1))[0]
    y0, y1 = hy.min() - int(rim * 2), hy.max() + int(rim * 2)
    def edge(y):
        xs = np.where(body[y])[0]
        return xs.min() if side == "left" else xs.max()
    e0, e1 = edge(y0), edge(y1)
    for y in range(y0 + 1, y1):
        x = int(round(e0 + (e1 - e0) * (y - y0) / (y1 - y0)))
        xs = np.where(body[y])[0]
        if side == "left":
            body[y, x:xs.max() + 1] = 1
        else:
            body[y, xs.min():x + 1] = 1
body = cv2.morphologyEx(body, cv2.MORPH_CLOSE, disk(3))

def outer(mask, grow):
    return cv2.dilate(mask, disk(grow))

def contour(mask, eps=0.3):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, eps * S, True)[:, 0, :].astype(float)
    # Naar modelcoördinaten: beeldvierkant = -1..1, y omhoog.
    pts = [[round((x + .5) / W * 2 - 1, 4), round(1 - (y + .5) / H * 2, 4)] for x, y in c]
    return pts

body_outer = outer(body, rim / K)
# Handjes: de hand plus zijn eigen blauwe rand. Blauwe pixels tussen hand en
# papier horen bij wat het dichtstbij ligt, anders krijgt het handje een
# stukje van de rand van het lijf mee.
visible_paper = fill(comp(260, 330))
paper_distance = cv2.distanceTransform((visible_paper == 0).astype(np.uint8), cv2.DIST_L2, 5)
def own_outline(hand):
    hand_distance = cv2.distanceTransform((hand == 0).astype(np.uint8), cv2.DIST_L2, 5)
    grown = (A & (hand_distance <= rim) & (hand_distance <= paper_distance)).astype(np.uint8)
    n, parts = cv2.connectedComponents(grown)
    biggest = max(range(1, n), key=lambda i: (parts == i).sum())
    return cv2.morphologyEx((parts == biggest).astype(np.uint8), cv2.MORPH_OPEN, disk(7))
hand_outer = [own_outline(h) for h in hands]
spark_outer = [outer(s, 1.5) for s in sparks]

# Gezichtsdelen: donkerblauwe vlakken binnen het lijf.
holes = (fill(comp(260, 330)) > 0) & navy
n, hl = cv2.connectedComponents(holes.astype(np.uint8))
blobs = []
for i in range(1, n):
    m = (hl == i).astype(np.uint8)
    if m.sum() < 300 * K * K: continue
    ys, xs = np.where(m)
    blobs.append((xs.mean(), ys.mean(), m))
blobs.sort(key=lambda t: t[2].sum(), reverse=True)
# Grootste drie: ogen en mond; mond ligt het laagst.
big = sorted(blobs[:3], key=lambda t: t[1])
mouth = big[-1]
eyes = sorted(big[:2], key=lambda t: t[0])
brows = sorted(blobs[3:5], key=lambda t: t[0])
parts = {"eyeL": eyes[0], "eyeR": eyes[1], "mouth": mouth, "browL": brows[0], "browR": brows[1]}

parts_rgba = np.zeros_like(im)
erase = np.zeros((H, W), np.uint8)
meta = {}
for name, (_, _, m) in parts.items():
    pm = cv2.dilate(fill(m), disk(2.5))
    alpha = cv2.GaussianBlur(pm.astype(np.float32), (0, 0), 0.8 * K)
    parts_rgba[..., :3] = np.where(pm[..., None] > 0, im[..., :3], parts_rgba[..., :3])
    parts_rgba[..., 3] = np.maximum(parts_rgba[..., 3], (alpha * 255).astype(np.uint8))
    erase |= cv2.dilate(pm, disk(3))
    ys, xs = np.where(pm)
    to = lambda x, y: [round((x + .5) / W * 2 - 1, 4), round(1 - (y + .5) / H * 2, 4)]
    x0, y0 = to(xs.min(), ys.max())
    x1, y1 = to(xs.max(), ys.min())
    meta[name] = {"min": [x0, y0], "max": [x1, y1], "contour": contour(pm, 0.5)}

front = im.copy()
front[..., :3] = cv2.inpaint(np.ascontiguousarray(im[..., :3]), erase, int(6 * K), cv2.INPAINT_TELEA)

# Achter de handjes: papier binnen het lijf, blauwe rand erbuiten. De
# handjes zelf gebruiken het originele plaatje als textuur.
paper = np.median(im[..., :3][(body > 0) & ~navy & (cv2.dilate(erase, disk(20)) == 0)], axis=0)
rim_colour = np.median(im[..., :3][navy & (body_outer > 0) & (body == 0)], axis=0)
covered = (np.maximum(*hand_outer) > 0) & (body_outer > 0)
fill_colour = np.where((body > 0)[..., None], paper, rim_colour)
front[..., :3] = np.where(covered[..., None], fill_colour, front[..., :3])
front[..., 3] = np.where(covered, 255, front[..., 3])

# Achterkant: zelfde blauwe rand, verder egaal wit papier.
back = front.copy()
inner = cv2.erode(body, disk(1))
back[..., :3] = np.where(inner[..., None] > 0, paper, back[..., :3])

for name, arr in {"front": front, "back": back, "parts": parts_rgba, "original": im}.items():
    Image.fromarray(arr).save(OUT_DIR / f"{name}.webp", lossless=False, quality=92, method=6)

model = {
    "rim": round(rim / W * 2, 4),
    "body": contour(body_outer),
    "hands": [contour(h) for h in hand_outer],
    "sparks": [contour(s) for s in spark_outer],
    "parts": meta,
}
OUT_JSON.write_text(json.dumps(model, separators=(",", ":")) + "\n")
print("rim px", rim, "body pts", len(model["body"]), [len(h) for h in model["hands"]], {k: len(v["contour"]) for k, v in meta.items()})
