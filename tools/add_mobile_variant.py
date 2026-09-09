#!/usr/bin/env python3
"""补"手机档"：给画布图按【手机上的真实物理像素需求】再加一档小图。

上一轮 shrink_case_images.py 的判据是"源宽 / 画布坐标宽度"，那个比值看不出手机的真实
需求，于是漏掉了几张最重的：
  device-hero.webp 1400×1752 = 9.4MB，画布宽 1418（≈源宽），比值 0.99 < 1.35 被跳过；
  image_4.webp      969×2100 = 7.8MB，同理。
但手机上画布整体缩到 390/1920 = 0.203，device-hero 实际只显示 288 CSS px、dpr3 下是
864 物理像素——1400 是 1.6 倍超采样，image_4 更是 3.4 倍。这两张就占 justpaper 手机端
31.1MB 解码里的 17.1MB（55%）。

所以这里换判据：手机物理需求 = 画布坐标宽度 × (390/1920) × 3 ≈ 画布宽 × 0.61。
低于这个需求的档不生成（会发虚），高于需求 1.2 倍的源图就补一档。
"""
import os
import re
import sys
from PIL import Image

CANVAS = 1920
MOBILE_VW = 390
MOBILE_DPR = 3
NEED = MOBILE_VW / CANVAS * MOBILE_DPR      # ≈ 0.609
MIN_GAIN = 1.2
MIN_W = 48
QUALITY = 82


def build(src, w):
    root, ext = os.path.splitext(src)
    out = f'{root}-w{w}{ext}'
    if os.path.exists(out):
        return out
    with Image.open(src) as im:
        if im.width <= w:
            return None
        h = max(1, round(im.height * w / im.width))
        mode = 'RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB'
        im.convert(mode).resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
    return out


def run(page, apply=False):
    html = open(page, encoding='utf-8').read()
    saved = [0.0]
    made = []

    def one(m):
        tag = m.group(0)
        sm = re.search(r'\ssrc="([^"]*)"', tag)
        wm = re.search(r'width:\s*([\d.]+)px', tag)
        if not sm or not wm:
            return tag
        src, cw = sm.group(1), float(wm.group(1))
        if not os.path.exists(src) or cw < MIN_W:
            return tag
        try:
            with Image.open(src) as im:
                ow, oh = im.size
        except Exception:
            return tag

        need = max(MIN_W, round(cw * NEED))
        # 已有的候选里最小那一档；没有 srcset 就把源图当唯一候选
        cands = []
        cs = re.search(r'srcset="([^"]*)"', tag)
        if cs:
            for part in cs.group(1).split(','):
                mm = re.search(r'(\S+)\s+(\d+)w', part.strip())
                if mm:
                    cands.append((int(mm.group(2)), mm.group(1)))
        else:
            cands.append((ow, src))
        cands.sort()
        smallest = cands[0][0]
        if smallest / need < MIN_GAIN:
            return tag

        out = build(src, need)
        if not out:
            return tag
        made.append(out)
        with Image.open(out) as im2:
            saved[0] += (smallest * round(oh * smallest / ow) - im2.width * im2.height) * 4 / 1048576
        cands.insert(0, (need, out))
        parts = ', '.join(f'{p} {w}w' for w, p in cands)
        sizes = f'{cw / (CANVAS / 100):.2f}vw'
        if cs:
            tag = tag.replace(cs.group(0), f'srcset="{parts}"')
        else:
            tag = tag.replace('<img', f'<img srcset="{parts}" sizes="{sizes}"', 1)
        if 'sizes=' not in tag:
            tag = tag.replace('<img', f'<img sizes="{sizes}"', 1)
        return tag

    out_html = re.sub(r'<img\b[^>]*?>', one, html, flags=re.S)
    if apply and out_html != html:
        open(page, 'w', encoding='utf-8').write(out_html)
    print(f'{page:22} 补手机档 {len(made):>3} 张，手机端解码预计省 {saved[0]:.1f}MB'
          f'{"（已写回）" if apply else "（未写回）"}')
    for f in made[:6]:
        print('    +', f)


if __name__ == '__main__':
    pages = [a for a in sys.argv[1:] if not a.startswith('--')]
    for p in pages:
        run(p, apply='--apply' in sys.argv)
