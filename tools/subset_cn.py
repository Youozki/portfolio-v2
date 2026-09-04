#!/usr/bin/env python3
"""扫描站内实际用到的中日韩字符，从思源黑变量字体裁一份最小子集。

内容是静态的，所以可以精确子集——不必像常规站点那样按 unicode-range 分片。
每次改完文案就重跑一次：
    python3 tools/subset_cn.py
主字体（17.7MB，不进仓库）放在 MASTER 指的位置，没有时脚本会告诉你去哪下。

为什么裁成两个静态实例而不是保留变量轴：
思源黑在同一个 font-weight 上比 Geist 看起来更重（CJK 笔画多、字面密度高），
混排时就会出现"英文正常、中文发黑"的粗细不齐。所以这里把 CJK 单独按
WEIGHTS 里的数值实例化，再映射到 CSS 的 300 / 400 两档，让中英光学上齐平。
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.expanduser('~/.local/share/fonts-src/NotoSansSC[wght].ttf')
FONT_DIR = os.path.join(ROOT, 'fonts')
SCAN_EXT = ('.html', '.js', '.css', '.svg')
SKIP_DIRS = {'vendor', 'fonts', 'assets', '.git', 'tools'}

# CSS 里声明的字重 -> 实际实例化的思源黑字重。中文比 Geist 各降一档左右。
WEIGHTS = {300: 300, 400: 365}

# 中日韩统一表意文字 + 常用扩展 + 中文标点 + 全角字符
CJK = re.compile(
    r'[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]'
)


def collect():
    chars = set()
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if not name.endswith(SCAN_EXT):
                continue
            path = os.path.join(base, name)
            with open(path, encoding='utf-8', errors='ignore') as fh:
                chars.update(CJK.findall(fh.read()))
    # 兜底：常见标点即使当前文案没用到也留着，改文案时不至于立刻掉字
    chars.update('，。、；：？！“”‘’（）《》—…·　')
    return chars


def main():
    if not os.path.exists(MASTER):
        sys.exit(
            '缺少主字体：%s\n'
            '下载：mkdir -p ~/.local/share/fonts-src && curl -fsSL -o '
            "'%s' "
            'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/'
            'NotoSansSC%%5Bwght%%5D.ttf' % (MASTER, MASTER)
        )

    chars = collect()
    print('用到的 CJK 字符数：%d' % len(chars))
    text = ''.join(sorted(chars))

    for css_weight, real_weight in sorted(WEIGHTS.items()):
        inst = os.path.join('/tmp', 'notosanssc-%d.ttf' % real_weight)
        subprocess.run([
            sys.executable, '-m', 'fontTools.varLib.instancer', MASTER,
            'wght=%d' % real_weight, '-o', inst,
        ], check=True, stdout=subprocess.DEVNULL)

        out = os.path.join(FONT_DIR, 'notosanssc-%d.woff2' % css_weight)
        subprocess.run([
            sys.executable, '-m', 'fontTools.subset', inst,
            '--text=%s' % text,
            '--output-file=%s' % out,
            '--flavor=woff2',
            '--layout-features=kern,vert,vrt2,ccmp,locl,mark,mkmk',
            '--name-IDs=1,2,3,4,6',
            '--drop-tables+=DSIG',
            '--no-hinting',
            '--desubroutinize',
        ], check=True)
        os.remove(inst)
        print('输出 %s（思源黑 wght=%d）  %.1f KB'
              % (out, real_weight, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
