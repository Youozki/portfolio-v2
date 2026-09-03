#!/usr/bin/env python3
"""把 Companion 案例用到的原始设计稿切成网页用的 webp。

原始图在 ~/Documents/所有的图/项目1 下，多数是带透明通道的 Figma 导出，
必须按将要放置的色带底色合成，否则透明处会露出错误的底。
重跑安全：同名文件直接覆盖。
"""
import os
from PIL import Image

SRC = os.path.expanduser('~/Documents/所有的图/项目1')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'assets', 'cases', 'companion')
PAPER = (237, 237, 234)
INK = (14, 15, 17)

# (输出名, 源文件相对 SRC 的路径, 目标宽度, 底色 None 表示保留透明)
JOBS = [
    ('hero-lens', '作品集 2/319ca93760e78f0dd174da287a5edaaa 1.png', 2560, INK),
    ('laptop-tiko', '作品1集/Group 2134285544.png', 2400, PAPER),
    ('edge-macro', '作品集 2/image 3.png', 2000, INK),
    ('orb', '作品集/球.png', 556, None),
    ('pb-desktop', '作品集/2645ae07ec55c48d1ac8153f956a7e44 1.png', 1347, PAPER),
    ('pb-panel', '作品集/1e0cca7067ae5dc4f1427d87cb2b94f2 1.png', 589, PAPER),
    ('pb-collapse', '作品集/Group 2147237199.png', 1352, PAPER),
    ('moodboard', '作品集/Group 2147237210.png', 2753, PAPER),
    ('emotions', '作品集/Group 2147238803.png', 3600, PAPER),
    ('expressions', '作品集/Group 2147238808.png', 3200, PAPER),
    ('emotion-model', '作品集/Group 2134285928.png', 1168, PAPER),
    ('voice-flow', '作品集/Group 2134285929.png', 2257, INK),
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


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, rel, width, bg in JOBS:
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
        dst = os.path.join(OUT, name + '.webp')
        out.save(dst, 'WEBP', quality=88, method=6)
        kb = os.path.getsize(dst) // 1024
        total += kb
        print('%-14s %5dx%-5d %5d KB' % (name, out.width, out.height, kb))
    print('合计 %d KB' % total)


if __name__ == '__main__':
    main()
