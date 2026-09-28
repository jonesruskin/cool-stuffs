# python3 tools/sheet.py out.png cols w file... (labels with file name)
import sys, os
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
h = w * 9 // 16; rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h)); d = ImageDraw.Draw(S)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * h; S.paste(im, (x, y))
    lab = os.path.basename(f).split('.')[0]
    d.rectangle([x, y, x + 8 * len(lab) + 8, y + 14], fill='black'); d.text((x + 3, y + 1), lab, fill='yellow')
S.save(out)
