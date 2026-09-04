#!/usr/bin/env python3
"""索引页素材：首屏主视觉 + 五张项目预览图的调性归一。

两件事：
1. 首屏主视觉。原图底色是 rgb(207,205,201)，比站内纸色 #EDEDEA 暗一档，
   直接放上去会像贴了一块灰板。这里用分段 LUT 把「底色→纸色」，暗部保持不动，
   所以主体不会被洗白，而图的边缘和纸张无缝相接，不需要再做羽化遮罩。
2. 五张预览图来源差异极大（实拍笔记本、UI 截图、营销页、三维场景），
   放在一起配色和明度都打架。统一裁成 16:10，再做同一套白点归一 + 轻微降饱和，
   剩下的形状统一交给 CSS 的样机卡片去做。
"""
import os

from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.expanduser('~/Documents/所有的图')
PAPER = (237, 237, 234)
CARD = (244, 244, 242)      # --paper-2，样机窗口里的底
KNEE = 110                  # 这个亮度以下原样保留，避免主体被提亮


def lut_to(img, frm, to):
    """分段线性 LUT：暗部不动，把 frm 精确映到 to，亮部压回 255。"""
    tables = []
    for c in range(3):
        f, t = frm[c], to[c]
        row = []
        for x in range(256):
            if x <= KNEE:
                y = x
            elif x <= f:
                y = KNEE + (x - KNEE) * (t - KNEE) / max(1, f - KNEE)
            else:
                y = t + (x - f) * (255 - t) / max(1, 255 - f)
            row.append(max(0, min(255, int(round(y)))))
        tables.extend(row)
    return img.point(tables)


def border_colour(img, pad=10):
    """取四边一圈的中位色当作这张图的「纸底」。
    用中位数而不是均值——边缘常常压到主体或阴影，均值会被拉偏几个色阶，
    映射完就会留下一块比纸张亮一点的板子，肉眼看得出来。"""
    w, h = img.size
    strips = [img.crop((0, 0, w, pad)), img.crop((0, h - pad, w, h)),
              img.crop((0, 0, pad, h)), img.crop((w - pad, 0, w, h))]
    out = []
    for c in range(3):
        hist = [0] * 256
        for s in strips:
            for i, n in enumerate(s.getchannel(c).histogram()):
                hist[i] += n
        total = sum(hist)
        acc = 0
        for i, n in enumerate(hist):
            acc += n
            if acc >= total / 2:
                out.append(i)
                break
    return tuple(out)


def crop_to(img, ratio):
    w, h = img.size
    if w / h > ratio:
        nw = int(round(h * ratio))
        box = ((w - nw) // 2, 0, (w - nw) // 2 + nw, h)
    else:
        nh = int(round(w / ratio))
        box = (0, (h - nh) // 2, w, (h - nh) // 2 + nh)
    return img.crop(box)


def desaturate(img, factor):
    from PIL import ImageEnhance
    return ImageEnhance.Color(img).enhance(factor)


def feather(img, px):
    """给四边做一圈线性透明羽化。
    主视觉原图带一点暗角，即使把中位底色精确映到纸色，最外面一两个像素还是会
    留下一道能看见的接缝。羽化成 RGBA 之后边界由浏览器混合，接缝就不存在了。"""
    from PIL import ImageDraw
    w, h = img.size
    mask = Image.new('L', (w, h), 255)
    d = ImageDraw.Draw(mask)
    for i in range(px):
        v = int(round(255 * i / px))
        d.rectangle([i, i, w - 1 - i, h - 1 - i], outline=v)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def build_hero():
    src = os.path.join(SRC, 'IMG_7739.png')
    out = os.path.join(ROOT, 'assets', 'graphics', 'hero-key.webp')
    im = Image.open(src).convert('RGB')
    pad = int(im.width * 0.02)                          # 原图四边有暗角，切掉 2%
    im = im.crop((pad, pad, im.width - pad, im.height - pad))
    im = lut_to(im, border_colour(im), PAPER)
    im = im.resize((2880, int(round(2880 * im.height / im.width))), Image.LANCZOS)
    im = feather(im, 40)
    im.save(out, 'WEBP', quality=88, method=6)
    print('主视觉 %s  %dx%d  %.0f KB'
          % (os.path.basename(out), im.width, im.height, os.path.getsize(out) / 1024))


def build_previews():
    d = os.path.join(ROOT, 'assets', 'preview')
    for name in ('companion', 'justpaper', 'oreate', 'terabox', 'practices'):
        path = os.path.join(d, name + '.webp')
        im = Image.open(path).convert('RGB')
        im = crop_to(im, 1.6)
        im = im.resize((2080, 1300), Image.LANCZOS)
        im = lut_to(im, border_colour(im), CARD)
        im = desaturate(im, 0.88)
        im.save(path, 'WEBP', quality=86, method=6)
        print('预览 %-11s %dx%d  %.0f KB'
              % (name, im.width, im.height, os.path.getsize(path) / 1024))


if __name__ == '__main__':
    build_hero()
    build_previews()

