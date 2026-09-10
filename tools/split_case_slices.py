#!/usr/bin/env python3
"""把画布切成几段，让离屏的段不参与渲染。

为什么：内页是 1920px 坐标画布 + transform: scale() 缩到视口宽。scale 是绘制期变换，
层的栅格化按【布局尺寸】算，也就是 1920 × span：terabox 6722、companion 8525、
justpaper 8536、oreate 10281，换成贴图是 49–75MB，而且整段常驻。首页没有画布，所以
只有内页会在 iOS 上被 jetsam 回收（表现为"滚动时页面自己刷新"），而且五个内页都会，
跟图片多少无关——terabox 只有 10 张图、4.6MB 解码，照样犯。

做法：一段画布拆成若干段，每段一个 .case-doc-wrap，段内元素照旧用全局画布坐标，
靠 slice 的 --y0 平移进各自的段里（这套机制本来就有，之前每页只用了一段）。
每个 wrap 再挂 content-visibility: auto，离屏的段浏览器直接跳过渲染与栅格化，
常驻贴图就只剩视口附近那一两段。

切点只能落在"没有任何元素跨越"的空隙里，否则元素会被 wrap 的 overflow: hidden 切两半。
空隙由 /tmp/kids-<page>.json（浏览器量出来的每个直接子元素 y 区间）算出来。

用法：python3 tools/split_case_slices.py case-terabox.html [--apply] [--target 2000]
"""
import json
import os
import re
import sys

VOID = {'img', 'br', 'hr', 'input', 'source', 'meta', 'link'}


def split_children(inner):
    """把 slice 的内容切成"直接子元素"的 HTML 片段列表。"""
    out = []
    i = 0
    depth = 0
    start = None
    while i < len(inner):
        if inner.startswith('<!--', i):
            j = inner.find('-->', i)
            i = (j + 3) if j > -1 else len(inner)
            continue
        if inner[i] != '<':
            i += 1
            continue
        m = re.match(r'</\s*([a-zA-Z0-9]+)\s*>', inner[i:])
        if m:
            depth -= 1
            i += m.end()
            if depth == 0 and start is not None:
                out.append(inner[start:i])
                start = None
            continue
        m = re.match(r'<([a-zA-Z0-9]+)([^>]*?)(/?)>', inner[i:], re.S)
        if not m:
            i += 1
            continue
        tag, attrs, selfclose = m.group(1).lower(), m.group(2), m.group(3)
        if depth == 0:
            start = i
        opens = not (selfclose == '/' or tag in VOID)
        i += m.end()
        if opens:
            depth += 1
        elif depth == 0:
            out.append(inner[start:i])
            start = None
    return out


def find_close(s, pos, depth=1):
    """从 pos 起按标签配对找到把 depth 降到 0 的那个闭合标签，返回它结束后的下标。"""
    i = pos
    while i < len(s) and depth > 0:
        if s.startswith('<!--', i):
            j = s.find('-->', i)
            i = (j + 3) if j > -1 else len(s)
            continue
        if s[i] != '<':
            i += 1
            continue
        m = re.match(r'</\s*([a-zA-Z0-9]+)\s*>', s[i:])
        if m:
            depth -= 1
            i += m.end()
            continue
        m = re.match(r'<([a-zA-Z0-9]+)([^>]*?)(/?)>', s[i:], re.S)
        if not m:
            i += 1
            continue
        tag, selfclose = m.group(1).lower(), m.group(3)
        i += m.end()
        if not (selfclose == '/' or tag in VOID):
            depth += 1
    return i


def pick_cuts(kids, y0, span, target):
    """在没有元素跨越的空隙里挑切点，间隔尽量接近 target。"""
    spans = sorted(((k['top'], k['bottom']) for k in kids), key=lambda x: x[0])
    merged = []
    for a, b in spans:
        if not merged or a > merged[-1][1] + 0.5:
            merged.append([a, b])
        else:
            merged[-1][1] = max(merged[-1][1], b)
    cuts = []
    last = y0
    for i in range(1, len(merged)):
        gap_from, gap_to = merged[i - 1][1], merged[i][0]
        if gap_to - gap_from < 4:
            continue
        mid = (gap_from + gap_to) / 2
        if mid - last >= target * 0.8 and (y0 + span) - mid >= target * 0.5:
            cuts.append(round(mid, 2))
            last = mid
    return cuts


def run(page, apply=False, target=2000.0):
    data = json.load(open(f'/tmp/kids-{page[:-5]}.json'))
    y0 = float(data['y0'])
    span = float(data['span'])
    # childspans.js 多加了一次 y0，这里减回来
    kids = [{'i': k['i'], 'top': k['top'] - y0, 'bottom': k['bottom'] - y0} for k in data['kids']]

    html = open(page, encoding='utf-8').read()
    m = re.search(r'<div class="case-doc-wrap"[^>]*>\s*<div class="case-doc">\s*'
                  r'(<div class="case-slice"[^>]*>)', html)
    if not m:
        print(f'{page}: 找不到画布结构，跳过')
        return
    slice_open = m.group(1)
    wrap_start = m.start()
    slice_end = find_close(html, m.end())          # slice 的 </div> 之后
    inner = html[m.end():slice_end - len('</div>')]
    doc_end = find_close(html, slice_end)          # .case-doc 的 </div>
    tail = find_close(html, doc_end)               # .case-doc-wrap 的 </div>
    kids_html = split_children(inner)
    if len(kids_html) != len(kids):
        print(f'{page}: 子元素数不一致（HTML {len(kids_html)} vs 量到 {len(kids)}），跳过')
        return

    cuts = pick_cuts(kids, y0, span, target)
    if not cuts:
        print(f'{page}: 没有可用切点，跳过')
        return
    bounds = [y0] + cuts + [y0 + span]

    parts = []
    for s in range(len(bounds) - 1):
        lo, hi = bounds[s], bounds[s + 1]
        idxs = [k['i'] for k in kids if lo <= k['top'] < hi or (s == 0 and k['top'] < lo)]
        body = ''.join(kids_html[i] for i in idxs)
        h = round(hi - lo, 2)
        parts.append(
            f'<div class="case-doc-wrap" data-span="{h}" style="--span:{h}">\n'
            f'    <div class="case-doc">\n'
            f'      <div class="case-slice" style="--y0:{round(lo, 2)}px">{body}</div>\n'
            f'    </div>\n'
            f'  </div>'
        )
        print(f'    段 {s + 1}: y {lo:.0f}–{hi:.0f}（{h:.0f}px） 元素 {len(idxs)}')

    out = html[:wrap_start] + '\n  '.join(parts) + html[tail:]
    if apply:
        open(page, 'w', encoding='utf-8').write(out)
    print(f'{page}: 切成 {len(parts)} 段，整层栅格化上限 '
          f'{1920 * span * 4 / 1048576:.0f}MB → 每段最多 '
          f'{1920 * max(bounds[i + 1] - bounds[i] for i in range(len(bounds) - 1)) * 4 / 1048576:.0f}MB'
          f'{"（已写回）" if apply else "（未写回）"}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    t = 2000.0
    if '--target' in sys.argv:
        t = float(sys.argv[sys.argv.index('--target') + 1])
    for p in args:
        run(p, apply='--apply' in sys.argv, target=t)
