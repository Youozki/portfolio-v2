#!/usr/bin/env python3
"""把 Companion 案例用到的原始设计稿切成网页用的 webp。

原始图在 ~/Documents/所有的图/项目1 下，多数是带透明通道的 Figma 导出，
必须按将要放置的色带底色合成，否则透明处会露出错误的底。
重跑安全：同名文件直接覆盖。

JOBS 第五项是可选的后处理：
  'lift'  源图本身就是深底深线（voice-flow 的可见像素只有 rgb48–67），
          合成到墨色带上几乎看不见。这里把那一段亮度抬到 200 附近，
          背景保持不动，等于只提亮线条和文字。
"""
import os
from PIL import Image

SRC = os.path.expanduser('~/Documents/所有的图/项目1')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'assets', 'cases', 'companion')
PAPER = (237, 237, 234)
INK = (14, 15, 17)

# (输出名, 源文件相对 SRC 的路径, 目标宽度, 底色 None 表示保留透明, 可选后处理)
JOBS = [
    ('hero-lens', '作品集 2/319ca93760e78f0dd174da287a5edaaa 1.png', 2560, INK),
    ('laptop-tiko', '作品1集/Group 2134285544.png', 2400, PAPER),
    ('pb-desktop', '作品集/2645ae07ec55c48d1ac8153f956a7e44 1.png', 1347, PAPER),
    ('pb-panel', '作品集/1e0cca7067ae5dc4f1427d87cb2b94f2 1.png', 589, PAPER),
    ('moodboard', '作品集/Group 2147237210.png', 2753, PAPER),
    ('emotions', '作品集/Group 2147238803.png', 3600, PAPER),
    ('expressions', '作品集/Group 2147238808.png', 3200, PAPER),
    ('emotion-model', '作品集/Group 2134285928.png', 1168, PAPER),
    ('voice-flow', '作品集/Group 2134285929.png', 2257, INK, 'lift'),
    ('tc-splash', '作品1集/233 1.png', 1004, PAPER),
    ('tc-empty', '作品1集/Container (1) 1.png', 1004, PAPER),
    ('tc-live', '作品1集/321 1.png', 1004, PAPER),
    ('tc-voice', '作品1集/dsadas 1.png', 1004, PAPER),
    ('tc-tracking', '作品1集/Container (3) 1.png', 1004, PAPER),
    ('tc-battery', '作品1集/Container (2) 1.png', 1004, PAPER),
    ('pet-cruise', '作品1集/01.png', 979, PAPER),
    ('pet-locked', '作品1集/TrackingView.png', 1209, PAPER),
    ('pet-live', '作品1集/Container-1.png', 1082, PAPER),
    ('pet-offline', '作品1集/Container.png', 747, PAPER),
    ('ces', '作品1集/fb58128416e9eb47757cdc8ae299ae35 1.png', 2560, INK),
]

# pb-collapse 原来也在这里，但那张纯形状图分辨率低、边缘发毛，已经改成
# case-companion.html 里的内联 SVG 重画，不再从原图切。
# edge-macro / orb 切过但版面上没用到，一并去掉，不留没人引用的文件。


def lift_dark(img, floor=22, knee=78, target=200):
    """把 floor–knee 这一段亮度抬到 target，背景与高光两端保持连续。"""
    table = []
    for x in range(256):
        if x <= floor:
            y = x
        elif x <= knee:
            y = floor + (x - floor) * (target - floor) / (knee - floor)
        else:
            y = target + (x - knee) * (255 - target) / (255 - knee)
        table.append(max(0, min(255, int(round(y)))))
    return img.point(table * 3)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for job in JOBS:
        name, rel, width, bg = job[:4]
        post = job[4] if len(job) > 4 else None
        src = os.path.join(SRC, rel)
        if not os.path.exists(src):
            print('缺图 %-14s %s' % (name, rel))
            continue
        im = Image.open(src).convert('RGBA')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        if bg is None:
            out = im
        else:
            out = Image.new('RGB', im.size, bg)
            out.paste(im, (0, 0), im)
        if post == 'lift':
            from PIL import ImageEnhance
            out = lift_dark(out)
            # 抬亮会把源图线条里那点暖偏色一起放大，压回接近中性
            out = ImageEnhance.Color(out).enhance(0.25)
        dst = os.path.join(OUT, name + '.webp')
        out.save(dst, 'WEBP', quality=88, method=6)
        kb = os.path.getsize(dst) // 1024
        total += kb
        print('%-14s %5dx%-5d %5d KB' % (name, out.width, out.height, kb))
    print('合计 %d KB' % total)


if __name__ == '__main__':
    main()


def build_awards():
    """CES 媒体奖项的十个媒体 logo。原图是十张零散小图，尺寸、留白、底色都不一致，
    统一做法：裁到实心边界 → 按"墨水高度"等高 → 垫同样的白色圆角板。
    这样放在墨色带上是一排规格一致的牌子，而不是十张大小不一的贴图。"""
    from PIL import ImageDraw
    files = ['image 1918.png', 'image 1919.png', 'image 1920.png', 'image 1921.png',
             'image 1922.png', 'image 1923.png', 'image 1924.png', 'image 1925.png',
             'QQ20260322-215201 1.png', 'QQ20260322-215201 2.png']
    names = ['crn', 'findarticles', 'gadgeteer', 'mashable', 'netzwelt',
             'pcwelt', 'pcworld', 'tomsguide', 'ubergizmo', 'zdnet']
    d = os.path.join(SRC, '作品1集')
    out_dir = os.path.join(OUT, 'awards')
    os.makedirs(out_dir, exist_ok=True)
    INK_H, PAD, R = 56, 22, 10
    for rel, name in zip(files, names):
        path = os.path.join(d, rel)
        if not os.path.exists(path):
            print('缺奖项图 %s' % rel)
            continue
        im = Image.open(path).convert('RGBA')
        # 白底截图没有 alpha，用"非白"当墨水
        if im.getchannel('A').getextrema()[0] == 255:
            g = im.convert('L').point(lambda v: 255 if v < 238 else 0)
        else:
            g = im.getchannel('A').point(lambda v: 255 if v > 8 else 0)
        box = g.getbbox()
        if box:
            im = im.crop(box)
        im = im.resize((max(1, round(im.width * INK_H / im.height)), INK_H), Image.LANCZOS)
        plate = Image.new('RGBA', (im.width + PAD * 2, im.height + PAD * 2), (0, 0, 0, 0))
        mask = Image.new('L', plate.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, plate.width - 1, plate.height - 1], radius=R, fill=255)
        white = Image.new('RGBA', plate.size, (255, 255, 255, 255))
        white.alpha_composite(im, (PAD, PAD))
        white.putalpha(mask)
        dst = os.path.join(out_dir, name + '.webp')
        white.save(dst, 'WEBP', quality=92, method=6)
        print('award %-13s %dx%d  %.1f KB'
              % (name, white.width, white.height, os.path.getsize(dst) / 1024))
