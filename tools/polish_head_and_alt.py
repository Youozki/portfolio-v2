#!/usr/bin/env python3
"""上线前静态修复：补 meta/og、补 alt、清重复属性、统一 site.js 版本号。

只做零视觉影响的修补，不动任何布局、动效参数与文案事实。
description / og:description 全部取自页面里已经存在的第一句定位文案，不新编内容。
"""
import os
import re

OG_IMAGE = 'assets/graphics/og-cover.jpg'
SITE = 'https://ptfchy.xyz/'
SITE_VER = '1788838294'          # js/site.js 以内页那一版为准，首页原来落后

DESC = {
    'index.html': None,          # 首页已经有 description，不动
    'case-companion.html': 'Tiko 是 ThinkBook Plus Gen7 中的智能协作助手。我参与了主要的交互体验与视觉部分，'
                           '包括表情动效的制作与交互、Twist Center 页的视觉优化及 OOBE 页工作。',
    'case-justpaper.html': 'Just Paper 是联想 35 周年纪念双屏笔记本 ThinkPad Tizio 中的原生笔记软件。'
                           '我参与了核心视觉系统、100+ Icon 组件库、设计规范与第二屏幕创新交互的定义设计。',
    'case-oreate.html': 'Oreate AI 是百度文库 AI 版的海外产品，海外用户已达百万级。我参与了多模态场景的'
                        '视觉范式设计与基础建设更新，优化图与视频场景下的模型交互体验。',
    'case-terabox.html': 'Terabox 是百度网盘海外版本，主打内容 + AI。我参与了图片编辑器场景的海外迁移，'
                         '为 Terabox 相册丰富可用的编辑能力。',
    'case-practices.html': None,  # 已有
}


def dedupe_attrs(tag):
    """同名属性只留第一个。Chrome 也是取第一个，所以留第一个才和渲染结果一致。"""
    for attr in ('alt', 'loading', 'decoding', 'src', 'srcset', 'sizes', 'style', 'fetchpriority', 'width', 'height'):
        hits = list(re.finditer(rf'\s{attr}="[^"]*"', tag))
        for m in reversed(hits[1:]):
            tag = tag[:m.start()] + tag[m.end():]
    return tag


def fix_imgs(html):
    stat = {'alt': 0, 'dup': 0}

    def one(m):
        tag = m.group(0)
        before = tag
        tag = dedupe_attrs(tag)
        if tag != before:
            stat['dup'] += 1
        if 'alt=' not in tag and re.search(r'\ssrc="', tag):
            # 图墙里的图都是画布上的装饰性截图，空 alt 才是对的：
            # 有屏幕阅读器时会跳过，而不是把文件名念出来
            tag = tag.replace('<img', '<img alt=""', 1)
            stat['alt'] += 1
        return tag

    return re.sub(r'<img\b[^>]*?>', one, html, flags=re.S), stat


def page_title(html):
    m = re.search(r'<title>([^<]*)</title>', html)
    return m.group(1).strip() if m else ''


def page_desc(html):
    m = re.search(r'name="description"\s+content="([^"]*)"', html)
    return m.group(1).strip() if m else ''


def fix_head(page, html):
    """补 description 与分享卡片。插在 <title> 之后，顺序稳定、好读。"""
    added = []
    if not page_desc(html) and DESC.get(page):
        html = re.sub(r'(<title>[^<]*</title>)',
                      rf'\1\n<meta name="description" content="{DESC[page]}" />',
                      html, count=1)
        added.append('description')

    if 'og:title' not in html:
        title = page_title(html)
        desc = page_desc(html)
        url = SITE + ('' if page == 'index.html' else page)
        block = '\n'.join([
            f'<meta property="og:type" content="website" />',
            f'<meta property="og:site_name" content="朱晨宇 · 作品集" />',
            f'<meta property="og:title" content="{title}" />',
            f'<meta property="og:description" content="{desc}" />',
            f'<meta property="og:url" content="{url}" />',
            f'<meta property="og:image" content="{SITE}{OG_IMAGE}" />',
            f'<meta property="og:image:width" content="1200" />',
            f'<meta property="og:image:height" content="630" />',
            f'<meta name="twitter:card" content="summary_large_image" />',
        ])
        html = re.sub(r'(<title>[^<]*</title>)', rf'\1\n{block}', html, count=1)
        added.append('og/twitter')
    return html, added


def main():
    pages = [p for p in sorted(os.listdir('.')) if p.endswith('.html')]
    for page in pages:
        html = open(page, encoding='utf-8').read()
        orig = html
        html, stat = fix_imgs(html)
        html, added = fix_head(page, html)
        n = len(re.findall(r'js/site\.js\?v=\d+', html))
        html = re.sub(r'js/site\.js\?v=\d+', f'js/site.js?v={SITE_VER}', html)
        if html != orig:
            open(page, 'w', encoding='utf-8').write(html)
        print(f'{page:22} 补 alt {stat["alt"]:>4}、清重复 {stat["dup"]:>3}、head +{",".join(added) or "无"}'
              f'、site.js 引用 {n}')


main()
