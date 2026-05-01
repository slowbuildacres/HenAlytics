"""
Henalytics app icons v2 — smoother shapes, better centering.
Sprout: stem with two opposing curved leaves.
"""
from PIL import Image, ImageDraw
import os

BG = (244, 237, 224)
INK = (44, 24, 16)
ACCENT = (200, 75, 49)   # barn red
LEAF = (90, 122, 60)     # garden green
LEAF_DARK = (66, 92, 44)

OUT = "/home/claude/v2/henalytics/public"
os.makedirs(OUT, exist_ok=True)


def make_sprout_canvas(size: int, padding_ratio: float, bg=BG):
    """Draws the sprout centered on a `size x size` canvas."""
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)

    pad = int(size * padding_ratio)
    aw = size - 2 * pad
    ah = size - 2 * pad
    sw = max(2, int(size * 0.045))   # stroke width (stem)

    def lp(nx, ny):
        return (pad + nx / 100 * aw, pad + ny / 100 * ah)

    # Ground
    d.line([lp(25, 92), lp(75, 92)], fill=ACCENT, width=sw)

    # Stem
    stem_top = lp(50, 28)
    stem_mid = lp(50, 60)
    stem_bot = lp(50, 92)
    d.line([stem_bot, stem_mid, stem_top], fill=ACCENT, width=sw)

    # Left leaf (lower)
    leaf_w_left = int(aw * 0.42)
    leaf_h_left = int(ah * 0.18)
    leaf_left = Image.new("RGBA", (leaf_w_left, leaf_h_left), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leaf_left)
    ld.ellipse((0, 0, leaf_w_left - 1, leaf_h_left - 1), fill=LEAF, outline=LEAF_DARK, width=max(2, sw // 2))
    ld.line(
        (leaf_w_left * 0.1, leaf_h_left // 2, leaf_w_left * 0.9, leaf_h_left // 2),
        fill=LEAF_DARK, width=max(1, sw // 3),
    )
    leaf_left = leaf_left.rotate(20, resample=Image.BICUBIC, expand=True)
    anchor_x = int(lp(50, 62)[0]) - leaf_left.width + int(sw / 1.5)
    anchor_y = int(lp(50, 62)[1]) - leaf_left.height // 2
    img.paste(leaf_left, (anchor_x, anchor_y), leaf_left)

    # Right leaf (upper)
    leaf_w_right = int(aw * 0.46)
    leaf_h_right = int(ah * 0.20)
    leaf_right = Image.new("RGBA", (leaf_w_right, leaf_h_right), (0, 0, 0, 0))
    rd = ImageDraw.Draw(leaf_right)
    rd.ellipse((0, 0, leaf_w_right - 1, leaf_h_right - 1), fill=LEAF, outline=LEAF_DARK, width=max(2, sw // 2))
    rd.line(
        (leaf_w_right * 0.1, leaf_h_right // 2, leaf_w_right * 0.9, leaf_h_right // 2),
        fill=LEAF_DARK, width=max(1, sw // 3),
    )
    leaf_right = leaf_right.rotate(-25, resample=Image.BICUBIC, expand=True)
    anchor_x = int(lp(50, 35)[0]) - int(sw / 1.5)
    anchor_y = int(lp(50, 35)[1]) - leaf_right.height // 2
    img.paste(leaf_right, (anchor_x, anchor_y), leaf_right)

    # Re-stroke stem on top
    d.line([stem_bot, stem_mid, stem_top], fill=ACCENT, width=sw)

    return img


print("Generating Henalytics icons...")

make_sprout_canvas(192, padding_ratio=0.10).save(f"{OUT}/icon-192.png", "PNG", optimize=True)
make_sprout_canvas(512, padding_ratio=0.10).save(f"{OUT}/icon-512.png", "PNG", optimize=True)
make_sprout_canvas(512, padding_ratio=0.22).save(f"{OUT}/icon-maskable-512.png", "PNG", optimize=True)
make_sprout_canvas(180, padding_ratio=0.10).save(f"{OUT}/apple-touch-icon.png", "PNG", optimize=True)
make_sprout_canvas(32, padding_ratio=0.04).save(f"{OUT}/favicon-32.png", "PNG", optimize=True)

print("All icons generated.")
for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    print(f"  {f} ({os.path.getsize(p)} bytes)")
