#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 ~/Documents/所有的图 里的 Figma 导出转成站内用的 webp。

两条规矩：
1. **只搬产品设计图**。纯文字排出来的板子（色板、字阶、交互对照表、原则卡）不搬，
   在页面里用真 HTML 重排——那样字是活的、能入场、窄屏能换行，也不会是一张糊图。
   哪张属于哪类记在下面的 MANIFEST 里，classify 字段就是判断依据。
2. **同系列必须同规格**。三张 Layout Summary、四张手机屏都按同一个目标宽度导出，
   页面里再套统一容器，不靠导出尺寸凑。

导出宽度按【实测的显示宽度】给两倍图，不是按原图大小：
版心 1200，最宽的展示位 954（--tier-wide），所以满幅图 1908 就够，再大是浪费。
"""
import os
import sys
from PIL import Image

SRC = os.path.expanduser('~/Documents/所有的图')
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'cases')

# 站内纸色，透明 PNG 一律拍到它上面，避免深浅色带里漏出棋盘格
PAPER = (237, 237, 234)
INK = (14, 15, 17)

# (来源, 目标名, 目标宽, 压到什么底色)
MANIFEST = {
    'justpaper': [
        # ---- 设备 ----
        ('项目2/1/Group 2134286061.png', 'device-hero', 1400, PAPER),
        ('项目2/1/Group 2134286123.png', 'device-side', 900, PAPER),
        ('项目2/1/Group 2147237225.png', 'dock', 740, None),
        # ---- 三套布局方案，同规格 ----
        ('项目2/2/Layout Summary- Infinite Canvas 2.png', 'layout-canvas', 1120, PAPER),
        ('项目2/2/Layout Summary- File List 2.png', 'layout-list', 1120, PAPER),
        ('项目2/2/Layout Summary- thumbails Waterfall 2.png', 'layout-waterfall', 1120, PAPER),
        # ---- 最终方案与界面 ----
        ('项目2/2/Desktop.png', 'final-desktop', 1908, PAPER),
        ('项目2/2/Group 2134285839.png', 'final-canvas', 1908, PAPER),
        ('项目2/2/Group 2134286098.png', 'theme-pair', 1908, PAPER),
        ('项目2/3/Frame 2134286115 1.png', 'notes-fan', 1908, PAPER),
        ('项目2/3/5 819.png', 'paper-flip', 1908, PAPER),
        # ---- 组件库 ----
        ('项目2/2/Icon Library 1.png', 'icons-gesture', 1120, PAPER),
        ('项目2/2/GenFlow专业版图标.png', 'icons-grid', 1908, PAPER),
    ],
    'oreate': [
        # ---- Intro / existing product states ----
        ('项目3/Group 2147238854.png', 'intro-card', 1908, PAPER),
        ('项目3/Group 2147238869.png', 'intro-collage', 1100, PAPER),
        # ---- Strategy / 3C and Intent Casting source boards ----
        ('项目3/Group 2147237264.png', 'strategy-board', 1908, PAPER),
        ('项目3/Group 2147237249.png', 'intent-board', 1100, PAPER),
        ('项目3/Group 2147230493.png', 'intent-flow', 1908, PAPER),
        # ---- Solution / image and video product UI ----
        ('项目3/AI Video 首页.png', 'video-home', 1908, PAPER),
        ('项目3/图片编辑器.png', 'image-editor', 1908, PAPER),
        ('项目3/Frame 2147239179.png', 'editor-detail', 1100, PAPER),
        ('项目3/Frame 2147238924.png', 'editor-state', 1100, PAPER),
        ('项目3/Group 2147238858.png', 'template-list', 1100, PAPER),
        ('项目3/Group 2147238870.png', 'result-panel', 1100, PAPER),
        ('项目3/16.png', 'outcome-home', 1908, PAPER),
    ],
}

# 明确不搬、要在页面里用 HTML 重排的板子（留在这里当记录，别再问一遍）
TEXT_PLATES = {
    'justpaper': [
        '项目2/3/Group 2134286067.png',         # 1 核心挑战与设计目标 · 六张卡，正文逐字可取
        '项目2/3/Group 2147238935.png',         # 同上的另一版式（已改用界面图）
        '项目2/3/Group 2147237229-1.png',       # 2 设计原则 · WCAG 环 + 事件/用户 两端
        '项目2/3/Typography.png',              # 8 字阶 · Segoe UI 11 行
        '项目2/2/Colors.png',                  # 8 色板 · 主色 + 深浅两套 11 阶
        '项目2/2/Interaction list.png',        # 5 交互手势 · 15 行 × 4 种输入
        '项目2/2/Icon Design Guidlines 1.png',  # 8 图标规范 · 四原则 + 128px 栅格
        '项目2/1/Group 2147238936.png',        # 双屏 · 释放双屏生产力 + Screen 1/2 空占位
        '项目2/1/Group 2147238937.png',        # 空灰笔记本盖，低质，不用
    ],
}


def convert(src, dst, width, bg):
    im = Image.open(src)
    im = im.convert('RGBA')
    # 先按不透明区域裁掉四周的空白，否则容器里图会莫名偏小
    box = im.getchannel('A').getbbox()
    if box:
        im = im.crop(box)
    w, h = im.size
    if w > width:
        im = im.resize((width, max(1, round(h * width / w))), Image.LANCZOS)
    if bg is not None:
        flat = Image.new('RGBA', im.size, bg + (255,))
        flat.alpha_composite(im)
        im = flat.convert('RGB')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=88, method=6)
    return im.size


def main(only=None):
    for case, items in MANIFEST.items():
        if only and case != only:
            continue
        for rel, name, width, bg in items:
            src = os.path.join(SRC, rel)
            if not os.path.exists(src):
                print('缺图 %s' % rel, file=sys.stderr)
                continue
            dst = os.path.join(DST, case, name + '.webp')
            size = convert(src, dst, width, bg)
            print('%-22s %5dx%-5d %6dKB  ← %s'
                  % (name, size[0], size[1], os.path.getsize(dst) // 1024, rel))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
