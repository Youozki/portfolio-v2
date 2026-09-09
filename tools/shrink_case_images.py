#!/usr/bin/env python3
"""内页图片按真实显示尺寸补一档小图，解决 iOS Safari 的解码内存崩溃。

背景：画布是 1920px 固定坐标 + transform: scale() 缩到视口宽。scale 是合成变换，
不会减少解码内存——1254x700 的图在手机上只显示 63px 宽，照样按 1254x700 解码（3.3MB）。
oreate 页 105 个 <img> 合起来 188MB，其中非 lazy 的就有 151MB，一进页面全量解码，
iOS Safari 的 WebContent 进程直接被 jetsam 杀掉（"网页已崩溃"）。

做法：
  1. 每个 <img> 从 style 里读画布坐标下的宽度 cw。图片的实际 CSS 宽度是
     cw * (100vw / 1920)，所以 sizes 写成 (cw/19.2)vw 就精确描述了任何视口下的显示宽度。
     浏览器按 sizes * DPR 选候选，于是手机自动拿小图。注意浏览器【不看】祖先的
     transform scale，只看 sizes 声明值——这正是这里必须手写 sizes 的原因。
  2. srcset 给两档：sm = cw*0.8（手机 3x 够用），md = cw*2（桌面 2x 够用），
     再挂上原图作为最大档。只在源图明显超采样时才生成。
  3. 非首屏的图补 loading="lazy" decoding="async"；首屏判据沿用 eager_first_screen
     （第一段画布 y0..y0+900），那几张仍旧 eager + fetchpriority=high。

用法：python3 tools/shrink_case_images.py case-oreate.html [--apply]
不带 --apply 只打印计划。
"""
import os
import re
import sys
from PIL import Image

CANVAS = 1920
QUALITY = 82
MIN_GAIN = 1.35          # 源宽 / 目标宽 小于这个倍数就不值得再生成一档
MIN_TARGET = 48          # 小于这个宽度的图不折腾


def first_screen_span(html):
    m = re.search(r'class="case-slice" style="--y0:([\d.]+)px', html)
    return float(m.group(1)) if m else None


def img_top(tag):
    m = re.search(r'top:(-?[\d.]+)px', tag)
    return float(m.group(1)) if m else None


def style_width(tag):
    m = re.search(r'width:\s*([\d.]+)px', tag)
    return float(m.group(1)) if m else None


def variant_path(src, w):
    root, ext = os.path.splitext(src)
    return f'{root}-w{w}{ext}'


def build(src, w):
    out = variant_path(src, w)
    if os.path.exists(out):
        return out, 0
    with Image.open(src) as im:
        if im.width <= w:
            return None, 0
        h = max(1, round(im.height * w / im.width))
        im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB') \
          .resize((w, h), Image.LANCZOS) \
          .save(out, 'WEBP', quality=QUALITY, method=6)
    return out, os.path.getsize(out)


def natural_size(src):
    with Image.open(src) as im:
        return im.width, im.height


def rewrite(page, apply=False):
    html = open(page, encoding='utf-8').read()
    y0 = first_screen_span(html)
    made = {}
    stat = {'srcset': 0, 'lazy': 0, 'skip': 0, 'before': 0.0, 'after_sm': 0.0}

    def one(m):
        tag = m.group(0)
        src_m = re.search(r'src="([^"]*)"', tag)
        if not src_m:
            return tag
        src = src_m.group(1)
        if not os.path.exists(src) or 'srcset=' in tag:
            return tag
        try:
            ow, oh = natural_size(src)
        except Exception:
            stat['skip'] += 1
            return tag
        cw = style_width(tag)
        stat['before'] += ow * oh * 4 / 1048576

        # 首屏那几张保持 eager，其余补 lazy + async 解码
        top = img_top(tag)
        on_first = y0 is not None and top is not None and y0 <= top <= y0 + 900
        if not on_first and 'loading=' not in tag:
            tag = tag.replace('<img', '<img loading="lazy"', 1)
            stat['lazy'] += 1
        if 'decoding=' not in tag:
            tag = tag.replace('<img', '<img decoding="async"', 1)

        if cw is None or cw < MIN_TARGET:
            stat['after_sm'] += ow * oh * 4 / 1048576
            return tag

        sm = max(MIN_TARGET, round(cw * 0.8))
        md = round(cw * 2)
        cands = []
        for w in sorted({sm, md}):
            if ow / w < MIN_GAIN:
                continue
            out, size = build(src, w)
            if out:
                cands.append((w, out))
                made[out] = size
        if not cands:
            stat['after_sm'] += ow * oh * 4 / 1048576
            return tag

        parts = [f'{p} {w}w' for w, p in cands] + [f'{src} {ow}w']
        sizes = f'{cw / (CANVAS / 100):.2f}vw'
        tag = tag.replace('<img', f'<img srcset="{", ".join(parts)}" sizes="{sizes}"', 1)
        stat['srcset'] += 1
        w0, p0 = cands[0]
        with Image.open(p0) as im:
            stat['after_sm'] += im.width * im.height * 4 / 1048576
        return tag

    out_html = re.sub(r'<img\b[^>]*?>', one, html, flags=re.S)
    if apply:
        open(page, 'w', encoding='utf-8').write(out_html)
    print(f'{page}: srcset {stat["srcset"]} 张、补 lazy {stat["lazy"]} 张、跳过 {stat["skip"]}')
    print(f'  解码内存：原 {stat["before"]:.0f} MB → 手机档 {stat["after_sm"]:.0f} MB')
    print(f'  新生成 {len(made)} 个文件，合计 {sum(made.values())/1024:.0f} KB')
    print('  ' + ('已写回' if apply else '未写回（加 --apply 生效）'))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    rewrite(args[0], apply='--apply' in sys.argv)
