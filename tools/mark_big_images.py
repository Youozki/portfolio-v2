#!/usr/bin/env python3
"""给"手机上解码超过 1MB"的图打 data-big，供 js/case-doc.js 在离屏时卸掉它们的解码。

为什么只挑大图：justpaper 手机端 31.8MB 解码里，428 个文件中只有 9 个 ≥1MB，
合起来就占 26.5MB（device-hero 8.0、image_4 5.6、homepage_scroll_dark 3.1、
homepage_scroll_light 3.0、visual_scroll_1..4 各 1.4、image_7 1.2），
剩下 416 个碎图一共才 3.6MB。所以卸载只需要盯这 9 个，碰都不用碰那 400 多个碎片
（动它们只会把风险和代码复杂度放大，收益接近 0）。

判据用"手机会挑中的那一档"：srcset 里最小的候选（没有 srcset 就是原图），
按 宽 × 高 × 4 字节算解码内存。

用法：python3 tools/mark_big_images.py case-justpaper.html [--apply] [--min 1.0]
      python3 tools/mark_big_images.py case-justpaper.html --apply --trim 0.833
        └ --trim 会顺手把这些大图的手机档再缩一档（0.833 ≈ 把 1.5 倍放大余量收到 1.25 倍），
          justpaper 那 9 张实测 26.5MB → 18.6MB。只动 data-big 这几张，其余保持 1.5 倍。
"""
import os
import re
import sys
from PIL import Image

MIN_MB = 1.0
PHONE_VW = 390
PHONE_DPR = 3
QUALITY = 82


def sizes_px(sizes):
    """按 390px 视口解出 sizes 声明的显示宽度（px）。"""
    if not sizes:
        return None
    for part in sizes.split(','):
        part = part.strip()
        m = re.match(r'^(?:\(max-width:\s*(\d+)px\)\s*)?([\d.]+)(px|vw)$', part)
        if not m:
            continue
        limit, num, unit = m.group(1), float(m.group(2)), m.group(3)
        if limit and PHONE_VW > int(limit):
            continue
        return num if unit == 'px' else num * PHONE_VW / 100
    return None


def phone_candidate(tag, src):
    """手机（390px / dpr3）实际会挑中的那一档。"""
    cs = re.search(r'srcset="([^"]*)"', tag)
    if not cs:
        return src
    cands = []
    for part in cs.group(1).split(','):
        m = re.search(r'(\S+)\s+(\d+)w', part.strip())
        if m:
            cands.append((int(m.group(2)), m.group(1)))
    if not cands:
        return src
    cands.sort()
    sm = re.search(r'sizes="([^"]*)"', tag)
    disp = sizes_px(sm.group(1) if sm else None)
    if disp is None:
        return cands[0][1]
    need = disp * PHONE_DPR
    for w, path in cands:
        if w >= need:
            return path
    return cands[-1][1]


def build(src_root, w):
    """从最大的那一档（原图）重采样出 w 宽的一档。"""
    out = f'{src_root[0]}-w{w}{src_root[1]}'
    if os.path.exists(out):
        return out
    with Image.open(src_root[0] + src_root[1]) as im:
        if im.width <= w:
            return None
        h = max(1, round(im.height * w / im.width))
        mode = 'RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB'
        im.convert(mode).resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
    return out


def trim_tag(tag, cand, factor):
    """把手机会挑中的那一档换成更小的一档，并剔掉比它还小的旧候选。"""
    m = re.match(r'(.*?)(-w\d+)?(\.\w+)$', cand)
    base = m.group(1)
    ext = m.group(3)
    with Image.open(cand) as im:
        cur = im.width
    want = max(48, round(cur * factor))
    if want >= cur:
        return tag, None
    out = build((base, ext), want)
    if not out:
        return tag, None
    cs = re.search(r'srcset="([^"]*)"', tag)
    if not cs:
        return tag.replace(f'src="{cand}"', f'src="{out}"'), out
    cands = []
    for part in cs.group(1).split(','):
        mm = re.search(r'(\S+)\s+(\d+)w', part.strip())
        if mm:
            cands.append((int(mm.group(2)), mm.group(1)))
    cands = [(w, p) for w, p in cands if w > want]
    cands.append((want, out))
    cands.sort()
    parts = ', '.join(f'{p} {w}w' for w, p in cands)
    return tag.replace(cs.group(0), f'srcset="{parts}"'), out


def run(page, apply=False, min_mb=MIN_MB, trim=None):
    html = open(page, encoding='utf-8').read()
    hits = []
    made = []

    def one(m):
        tag = m.group(0)
        sm = re.search(r'\ssrc="([^"]*)"', tag)
        if not sm:
            return tag
        cand = phone_candidate(tag, sm.group(1))
        if not os.path.exists(cand):
            return tag
        try:
            with Image.open(cand) as im:
                mb = im.width * im.height * 4 / 1048576
        except Exception:
            return tag
        if mb < min_mb:
            return tag
        if trim:
            tag, out = trim_tag(tag, cand, trim)
            if out:
                made.append(out)
                with Image.open(out) as im2:
                    mb = im2.width * im2.height * 4 / 1048576
                cand = out
        hits.append((os.path.basename(cand), round(mb, 2)))
        if 'data-big' in tag:
            return tag
        return tag.replace('<img', '<img data-big', 1)

    out = re.sub(r'<img\b[^>]*?>', one, html, flags=re.S)
    if apply and out != html:
        open(page, 'w', encoding='utf-8').write(out)
    uniq = {}
    for name, mb in hits:
        uniq[name] = mb
    total = sum(uniq.values())
    print(f'{page:22} 标记 {len(hits):>2} 处 / {len(uniq)} 个文件，去重解码 {total:.1f}MB'
          f'{"（已写回）" if apply else "（未写回）"}')
    for name, mb in sorted(uniq.items(), key=lambda x: -x[1]):
        print(f'    {mb:>6.2f}MB  {name}')
    if made:
        print(f'    新生成 {len(set(made))} 档')


if __name__ == '__main__':
    flags = {'--min', '--trim'}
    vals = set()
    for f in flags:
        if f in sys.argv:
            vals.add(sys.argv[sys.argv.index(f) + 1])
    pages = [a for a in sys.argv[1:] if not a.startswith('--') and a not in vals]
    mb = float(sys.argv[sys.argv.index('--min') + 1]) if '--min' in sys.argv else MIN_MB
    tr = float(sys.argv[sys.argv.index('--trim') + 1]) if '--trim' in sys.argv else None
    for p in pages:
        run(p, apply='--apply' in sys.argv, min_mb=mb, trim=tr)
