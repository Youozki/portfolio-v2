#!/usr/bin/env python3
"""扫描站内实际用到的中日韩字符，从思源黑变量字体裁一份最小子集。

内容是静态的，所以可以精确子集——不必像常规站点那样按 unicode-range 分片。
每次改完文案就重跑一次：
    python3 tools/subset_cn.py
主字体（17.7MB，不进仓库）放在 MASTER 指的位置，没有时脚本会告诉你去哪下。
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.expanduser('~/.local/share/fonts-src/NotoSansSC[wght].ttf')
OUT = os.path.join(ROOT, 'fonts', 'notosanssc-subset.woff2')
SCAN_EXT = ('.html', '.js', '.css', '.svg')
SKIP_DIRS = {'vendor', 'fonts', 'assets', '.git', 'tools'}

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

    cmd = [
        sys.executable, '-m', 'fontTools.subset', MASTER,
        '--text=%s' % text,
        '--output-file=%s' % OUT,
        '--flavor=woff2',
        '--layout-features=kern,vert,vrt2,ccmp,locl,mark,mkmk',
        '--name-IDs=1,2,3,4,6',
        '--drop-tables+=DSIG',
        '--no-hinting',
        '--desubroutinize',
    ]
    subprocess.run(cmd, check=True)
    print('输出 %s  %.1f KB' % (OUT, os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
