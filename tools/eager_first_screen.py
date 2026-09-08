"""把每页首屏那两三张画布图从 lazy 改回 eager。

为什么要改：lazy 的图不进预扫描（preload scanner），要等布局算完才排队，而画布
的布局又要等 case-doc.js 把 --cs 缩放系数写进去——那已经在 gsap/lenis 下载完之后。
于是"点进内页还要等图"。首屏那几张改成 eager + fetchpriority=high，解析到就开抓。

判据用画布坐标而不是"文件里第几张"：第一段画布的 y0 就是首屏第一张图的高度基准，
落在 [y0, y0+900] 里的才是首屏（+900 约等于首屏往下一屏半）。嵌套在 mockup／
跑马灯里的图 top 是相对各自父容器的小数值（0.02、16.57 这种），一律小于 y0，
自然被这条窗口排除掉——按"top 小于某个阈值"筛会把它们全捞进来（实测 301 张）。
"""
import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WINDOW = 900.0


def eager_first_screen(page):
    m = re.search(r'class="case-slice" style="--y0:([\d.]+)px', page)
    if not m:
        return page, []
    y0 = float(m.group(1))
    hit = []

    def one(im):
        tag = im.group(0)
        t = re.search(r'top:(-?[\d.]+)px', tag)
        if not t or not (y0 <= float(t.group(1)) <= y0 + WINDOW):
            return tag
        if 'loading="lazy"' not in tag:
            return tag
        tag = re.sub(r'\s*loading="lazy"', '', tag)
        tag = tag.replace('<img', '<img fetchpriority="high"', 1)
        hit.append(re.search(r'src="([^"]+)"', tag).group(1))
        return tag
    return re.sub(r'<img\b[^>]*?>', one, page, flags=re.S), hit


if __name__ == '__main__':
    for f in ['case-companion.html', 'case-justpaper.html', 'case-oreate.html', 'case-terabox.html']:
        p = os.path.join(ROOT, f)
        s = open(p, encoding='utf-8').read()
        out, hit = eager_first_screen(s)
        print('%-22s %d 张转 eager  %s' % (f, len(hit), [h.split('/')[-1] for h in hit]))
        if '--apply' in sys.argv and out != s:
            open(p, 'w', encoding='utf-8').write(out)
