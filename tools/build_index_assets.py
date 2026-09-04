#!/usr/bin/env python3
"""索引页素材：首屏主视觉 + 两个公司 logo。

首屏主视觉原图底色是 rgb(207,205,201)，比站内纸色 #EDEDEA 暗一档，直接放上去
会像贴了一块灰板。这里用分段 LUT 把「底色→纸色」，暗部保持不动，所以主体不会被
洗白；再切掉 2% 的暗角并做一圈羽化，边缘和纸张之间不留接缝。

（项目预览图那套样机卡片已按反馈撤掉，相关代码一并删了。）
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.expanduser('~/Documents/所有的图')
PAPER = (237, 237, 234)
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


def build_logos():
    """联想 / 百度 logo。用户自己文件里的原图，只做尺寸归一，不重绘。

    两张原图的留白量完全不同（Lenovo 是带红底的整块 lockup，百度是透明底、
    四周还留了一圈空白），按图片高度缩放就会一大一小。所以先各自裁到实心边界
    （alpha > 8），再统一缩到同一个高度——这样"看得见的那部分"才是等高的。"""
    src = os.path.join(SRC, '简历', '作品集')
    out_dir = os.path.join(ROOT, 'assets', 'logos')
    os.makedirs(out_dir, exist_ok=True)
    H = 96                                   # 48px 显示，二倍
    for name, rel in [('lenovo', 'Lenovo_idDXuX8rvi_0 1.png'),
                      ('baidu', 'Baidu 1.png')]:
        path = os.path.join(src, rel)
        if not os.path.exists(path):
            print('缺 logo %s' % rel)
            continue
        im = Image.open(path).convert('RGBA')
        alpha = im.getchannel('A').point(lambda v: 255 if v > 8 else 0)
        box = alpha.getbbox()
        if box:
            im = im.crop(box)
            alpha = alpha.crop(box)
        # 按"墨水重心"而不是外框中心对齐：百度的爪子高出字母一截，
        # 只按外框居中会让字母整体偏低，和旁边的公司名对不齐。
        rows = [sum(1 for x in range(0, im.width, 2) if alpha.getpixel((x, y)))
                for y in range(im.height)]
        total = sum(rows) or 1
        cy = sum(y * n for y, n in enumerate(rows)) / total
        pad = int(round(abs(im.height / 2 - cy) * 2))
        if pad:
            top = pad if cy > im.height / 2 else 0
            plate = Image.new('RGBA', (im.width, im.height + pad), (0, 0, 0, 0))
            plate.alpha_composite(im, (0, top))
            im = plate
        im = im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS)
        dst = os.path.join(out_dir, name + '.webp')
        im.save(dst, 'WEBP', quality=92, method=6)
        print('logo %-7s %dx%d（实心区等高）  %.1f KB'
              % (name, im.width, im.height, os.path.getsize(dst) / 1024))


if __name__ == '__main__':
    build_hero()
    build_logos()

