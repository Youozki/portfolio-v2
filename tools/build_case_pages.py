#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把第一版的项目内页原封不动搬进 portfolio-v2。

第一版内页是一张 1920px 宽的坐标定位画布（元素全是 position:absolute，数值直接
来自设计稿导出）。这套排版是用户认可的版本，所以不重排、不改数值，只做三件事：

1. **切段**：按第一版左侧边栏的章节坐标（data-sec）把画布切成若干段，
   每段单独套一个色块，做出 augen updates 页那种「章节之间用色块分开」的效果。
   切段是按顶层元素各自的 top 归属，段高按该段元素的实际底边算，所以不会裁掉东西。
2. **换头**：画布自带的标题／年份／团队／简介段落删掉，换成 v2 的内页头版式，
   但正文字号跟画布正文对齐（画布正文 20px @1920 → 用 vw 表达，缩放后完全一致）。
3. **去尾**：删掉原稿底部那张「下一项目」大卡片、它上面的标签、以及末尾结语，
   换成 v2 的结语色带与下一项目行。

其余一个坐标、一个颜色都没动。
"""
import json
import os
import re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1 = os.path.join(os.path.dirname(ROOT), 'portfolio')
CANVAS_W = 1920

# 顶层元素里 top 小于这个值的就是画布自带的页头（logo 107.8 / 标题与年份 173 /
# 简介 267），一律删掉换成 v2 的头。往下最近的元素在 457，所以 400 是安全阈值。
HEAD_CUT = 400

# 章节之间额外拉开的距离（画布坐标）。260 试过一轮，用户反馈"中间空太多"——
# 区分章节靠的是章节头的层次（发丝线 + 序号 + 放大的章节名，见 css/case-doc.css），
# 不是靠拉空，所以这里只留一档能透气的距离。
CHAPTER_GAP = 140

# 章节头自己再往上提这么多，给放大后的章节名和它上面那根线腾出地方。
# 章节内部其它元素不动，所以头与正文之间的相对距离反而变宽了。
CHAPTER_HEAD_LIFT = 74

# 章节标题的 top 到该章第一个正文元素的 top 之间的固定距离（画布坐标，指最终
# 渲染出来的距离，已经算进标题的提升量）。第一版这个值每章都不一样
# （82 / 119 / 274…），统一到一个数，规范才立得住。
HEAD_TO_BODY = 250


def bump_top(frag, delta):
    """把一个顶层元素整体下移 delta。只改它自己开标签上的 top，
       后代的 top 是相对它算的，跟着走，不用动。"""
    m = re.match(r'<[a-zA-Z0-9]+\b[^>]*>', frag)
    if not m:
        return frag
    tag = m.group(0)
    new = re.sub(r'top:(-?[\d.]+)px',
                 lambda t: 'top:%.2fpx' % (float(t.group(1)) + delta), tag, count=1)
    return new + frag[m.end():]


def load_doc(path):
    """第一版正文存成 window.CASE_DOC_X = "…"; 这里取出并还原成真 HTML。"""
    s = open(path, encoding='utf-8').read()
    a, b = s.index('"'), s.rindex('"')
    html = json.loads(s[a:b + 1])
    m = re.match(r'\s*<div[^>]*>', html)
    inner = html[m.end():]
    return inner[:inner.rindex('</div>')]


def top_children(src):
    """按标签深度扫出顶层子元素。画布是扁平的一层，所以这样切最稳。"""
    out, i, n = [], 0, len(src)
    while i < n:
        j = src.find('<', i)
        if j < 0:
            if src[i:].strip():
                out.append(('text', src[i:]))
            break
        if src[i:j].strip():
            out.append(('text', src[i:j]))
        mm = re.match(r'<([a-zA-Z0-9]+)', src[j:])
        if not mm:
            i = j + 1
            continue
        name = mm.group(1)
        pat = re.compile(r'<(/?)' + name + r'\b[^>]*?(/?)>', re.I)
        depth, k = 0, j
        while k < n:
            t = pat.search(src, k)
            if not t:
                k = n
                break
            if t.group(1) == '/':
                depth -= 1
                if depth == 0:
                    k = t.end()
                    break
            else:
                if t.group(2) == '/' or name.lower() == 'img':
                    if depth == 0:
                        k = t.end()
                        break
                    depth += 1
                else:
                    depth += 1
            k = t.end()
        out.append((name, src[j:k]))
        i = k
    return out


_natural = {}


def img_height(src_rel, width):
    """图只写了 width 时按原图比例算出显示高度——段高要靠它才不会把图裁掉。"""
    if src_rel not in _natural:
        p = os.path.join(V1, src_rel)
        try:
            _natural[src_rel] = Image.open(p).size
        except Exception:
            _natural[src_rel] = None
    nat = _natural[src_rel]
    if not nat or not nat[0]:
        return 0.0
    return width * nat[1] / nat[0]


def _extent(tag, rest):
    """一个元素自身占多高。写了 height/min-height 就用它；没写就看后代——
       后代的 top 是相对本元素算的，所以取 max(子 top + 子高) 当自身高度。"""
    hm = re.search(r'(?:min-)?height:([\d.]+)px', tag)
    if hm:
        return float(hm.group(1))
    im = re.match(r'<img\b', tag)
    if im:
        w = re.search(r'width:([\d.]+)px', tag)
        s = re.search(r'src="([^"]+)"', tag)
        if w and s:
            return img_height(s.group(1), float(w.group(1)))
        return 0.0
    ext = 0.0
    for mm in re.finditer(r'<[a-zA-Z0-9]+\b[^>]*>', rest):
        t = re.search(r'top:(-?[\d.]+)px', mm.group(0))
        if not t:
            continue
        ext = max(ext, float(t.group(1)) + _extent(mm.group(0), ''))
    return ext


def box(frag):
    """量出一个顶层元素的 top 与底边。"""
    m = re.match(r'<[a-zA-Z0-9]+\b[^>]*>', frag)
    if not m:
        return None, None
    tag = m.group(0)
    tm = re.search(r'top:(-?[\d.]+)px', tag)
    if not tm:
        return None, None
    top = float(tm.group(1))
    return top, top + _extent(tag, frag[m.end():])


# ---- 每页的配置 --------------------------------------------------------
# chapters 的坐标就是第一版左侧边栏 .case-nav__item 的 data-sec，逐字照抄；
# tone 是该章节色块的底色档位，顺序上让相邻章节不同色，做出色块分章的效果。
# intro / lines / meta 是 v2 内页头要用的文案，全部取自第一版原文，未改写。
CASES = [
    dict(
        id='companion', no='1', src='case-companion.js', key='COMPANION',
        title='Companion App', lines=['Companion', 'App'],
        year='2025', team='IDG UI/UX 组',
        tags=['交互体验', '视觉', '表情动效'],
        intro=['Tiko 是 Thinkbook Plus Gen7 中的智能协作助手，能够帮助用户更快速地获取信息、'
               '完成决策并简化日常工作流程，为用户带来更顺畅的使用体验。此外，Tiko 也需要在 '
               'Ces2026 展上取得吸睛的作用。',
               '我参与了 TIKO 主要的交互体验与视觉部分，包括 TIKO 表情动效的制作与交互、'
               'Twist Center 页的视觉优化及 OOBE 页工作。'],
        chapters=[('intro', 'Intro', 0, 'paper'), ('problem', 'Problem', 1281, 'white'),
                  ('strategy', 'Strategy', 2392, 'ink'), ('design', 'Design', 3288, 'white'),
                  # 侧边栏写的是 7788（Outcome 那段文字），但 CES 的获奖清单在
                  # 7484 就开始了，那些奖项本来就是 Outcome 的一部分。
                  # 章节起点提到 7484，奖项才归到 Outcome 名下。
                  ('outcome', 'Outcome', 7484, 'paper')],
        next=('case-justpaper.html', '2', 'Just Paper',
              '原生笔记软件，结合双屏的产品特点为用户构建笔记使用新体验。'),
        coda='当然，一个完整的项目肯定不止这些，这仅是我所参与的部分，感兴趣的话找我聊聊。',
    ),
    dict(
        id='justpaper', no='2', src='case-justpaper.js', key='JUSTPAPER',
        title='Just Paper', lines=['Just', 'Paper'],
        year='2026', team='IDG UI/UX 组',
        tags=['组件库', '设计规范', '双屏交互'],
        intro=['Just Paper 是联想 35 周年纪念双屏笔记本 Thinkpad Tizio 中的原生笔记软件，'
               '我们旨在结合双屏的产品特点为用户构建笔记使用新体验。',
               '我参与了包括其核心视觉系统的 100+ 数量的 Icon 组件库搭建、设计规范制定、'
               '智能硬件协同及第二屏幕创新交互与产品体验的核心定义设计。'],
        chapters=[('intro', 'Intro', 0, 'paper'), ('problem', 'Problem', 1432, 'white'),
                  ('strategy', 'Strategy', 2180, 'ink'), ('design', 'Design', 3211, 'paper'),
                  ('outcome', 'Outcome', 8583, 'white')],
        next=('case-oreate.html', '3', 'Oreate AI',
              'AI 全模态内容，快速生成 AI 图像、视频等多元需求，支持 PPT、助力深度研究与写作。'),
        coda='当然，一个完整的项目肯定不止这些，这仅是我所参与的部分，感兴趣的话找我聊聊。',
        dual=True,
        # 首屏原来并排两张展示图：左边那张是上下双屏的静态展示，和下面的双屏
        # 交互段重复了，去掉；右边那张设备图（image_4）留下来，单独做成陈述层。
        # 1123 那一段硬件特性的说明文字搬进上面的双屏黑段里，画布里不再重复出现。
        drop_tops=(480.0, 563.0, 528.0, 1123.0),
        statement=dict(type='TIZIO', art='assets/cases/justpaper/image_4.webp',
                       w=242, h=525,
                       alt='Thinkpad Tizio 设备正视图'),
    ),
    dict(
        id='oreate', no='3', src='case-oreate.js', key='OREATE',
        title='Oreate AI', lines=['Oreate', 'AI'],
        year='2026', team='PSIG 海外产品创新组',
        tags=['多模态', '视觉范式', '模型交互'],
        intro=['Oreate AI 是百度文库 AI 版的海外产品，海外用户已达百万级，'
               '并在海外社交媒体平台引发广泛关注。',
               '我参与了 Oreate AI 中多模态场景的视觉范式设计与基础建设更新；'
               '优化核心的图与视频场景下的模型交互体验优化，提升输出效果。'
               '构建高质量数据集，支撑案例迭代与流程自动化。'],
        chapters=[('intro', 'Intro', 0, 'paper'), ('problem', 'Problem', 1337, 'white'),
                  ('strategy', 'Strategy', 2405, 'ink'), ('solution', 'Solution', 3365, 'white'),
                  ('outcome', 'Outcome', 9359, 'paper')],
        next=('case-terabox.html', '4', 'Terabox',
              '百度网盘海外版本，主打内容 + AI，海外方向强化多模态与 AI 能力。'),
        coda='当然，一个完整的项目肯定不止这些，这仅是我所参与的部分，感兴趣的话找我聊聊。',
    ),
    dict(
        id='terabox', no='4', src='case-terabox.js', key='TERABOX',
        title='Terabox', lines=['Terabox'],
        year='2026', team='PSIG 海外产品创新组',
        tags=['AI 编辑器', 'Agent', '海外迁移'],
        intro=['Terabox 是百度网盘海外版本，主打内容 + AI，海外方向重点强化多模态与 AI 能力。',
               '我参与了 Terabox 图片编辑器场景的海外迁移，为 Terabox 相册内容丰富可用的编辑能力。'],
        chapters=[('intro', 'Intro', 0, 'paper'), ('problem', 'Problem', 1171, 'white'),
                  ('solution', 'Solution', 1627, 'accent'), ('outcome', 'Outcome', 5976, 'paper')],
        next=('case-practices.html', '5', 'Practices',
              '个人技能练习作品，包括 UI 页面、MG 动效／三维动效（静帧展示）、建模视觉等。'),
        coda='当然，一个完整的项目肯定不止这些，这仅是我所参与的部分，感兴趣的话找我聊聊。',
    ),
]

# 顶部返回：回到索引页时直接落在本项目那一行的入口上，而不是主页最顶上
NAV_HOME = '''  <a class="nav__home" id="navHome" href="index.html#row-%s" aria-label="返回作品索引">
    <span class="nav__glyphs" aria-hidden="true">
      <span class="nav__roll">
        <svg class="mark" viewBox="0 0 24 24" width="20" height="20">
          <rect class="mark__a" x="3.2" y="3.2" width="12.6" height="12.6" rx="3.6" />
          <rect class="mark__b" x="8.2" y="8.2" width="12.6" height="12.6" rx="3.6" />
        </svg>
        <svg class="mark mark--back" viewBox="0 0 24 24" width="20" height="20">
          <path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor"
                stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </span>
  </a>'''

DUAL = '''  <!-- 上下双屏开合：这一段是 v2 自己做的招牌动效，用户要求保留 -->
  <section class="band band--ink dual" id="screens" aria-label="双屏">
    <div class="dual__pin">
      <div class="page">
        <div class="dual__copy">
          <p class="t-label">双屏</p>
          <h2 class="t-h2">产品硬件特性</h2>
          <p class="t-body dual__body">Tizio 拥有上下双屏的产品硬件特性。上下双屏一体化设计，上屏专注内容呈现，
            下屏可作为交互控制区，双屏无缝协同，打破传统单屏限制。专为高效办公、创作与多任务场景打造，
            以硬件形态革新，带来更灵活、更高生产力的移动使用体验。在目标用户上，以对科技、新鲜事物抱尝试心态、
            愿为科技消费、有一定消费水平的 30–40 岁男性为主。</p>
          <p class="t-body dual__body">我们基于硬件特性，重构笔记类应用的界面逻辑与交互体验，实现「上屏专注、下屏高效、
            双屏协同」的设计目标，打造轻量化、沉浸式、高效率的双屏原生笔记体验。</p>
        </div>
        <div class="dual__stack" id="dualStack">
          <span class="dual__half dual__half--top" aria-hidden="true"><img
            src="assets/cases/justpaper/device-hero.webp" alt=""
            width="1400" height="1752" /></span>
          <span class="dual__half dual__half--bottom"><img
            src="assets/cases/justpaper/device-hero.webp"
            alt="Thinkpad Tizio 上下双屏形态，屏上运行 Just Paper"
            width="1400" height="1752" /></span>
          <span class="dual__seam" aria-hidden="true"></span>
          <p class="dual__tag dual__tag--top"><b class="t-lead">上屏</b><span>专注内容呈现</span></p>
          <p class="dual__tag dual__tag--bottom"><b class="t-lead">下屏</b><span>交互控制区</span></p>
        </div>
      </div>
    </div>
  </section>
'''


def strip_wide_rules(frag):
    """删掉贯穿整幅的发丝分割线图。

    Outcome 段上下各有一条 1475px 宽的横线（原图就是一张 5904×4 的线），
    用户要求去掉。判据是「极扁 + 声明宽度接近满幅」，所以卡片里那些短分割线
    （image_11、flow_image_9 之类）不会被误删。"""
    def kill(m):
        tag = m.group(0)
        w = re.search(r'width:([\d.]+)px', tag)
        s = re.search(r'src="([^"]+)"', tag)
        if not (w and s) or re.search(r'height:[\d.]+px', tag):
            return tag
        if float(w.group(1)) < 1400:
            return tag
        nat = _natural.get(s.group(1))
        if nat is None:
            try:
                nat = Image.open(os.path.join(V1, s.group(1))).size
            except Exception:
                nat = None
            _natural[s.group(1)] = nat
        if nat and nat[1] and nat[0] / nat[1] > 80:
            return ''
        return tag
    return re.sub(r'<img[^>]*>', kill, frag)


def prepare(cfg):
    """去掉画布自带的页头、尾部三块与满幅横线，返回 (画布 HTML, y0, 高度, 章节锚点)。

    两件事要特别小心：
    1. **绝对不能给顶层元素排序**。画布靠 DOM 顺序决定层叠：底下的卡片色块先写、
       图后写才能压在卡片上面。按 top 排过一次序，结果卡片跑到图后面，
       把图整张盖住了——用户看到的「丢了一张图」就是这么来的。
    2. 章节之间要拉开距离（用户要的「章节区分度」），做法是把每个章节起点
       之后的元素整体下移 CHAPTER_GAP。章节内部的相对位置一个都不动，
       所以排版还是原样，只是章节缝变宽了。"""
    inner = load_doc(os.path.join(V1, 'pages', cfg['src']))
    drop = set(cfg.get('drop_tops', ()))
    kids = []
    for name, frag in top_children(inner):
        if 'case-next-card' in frag:
            continue
        if name != 'text' and '看看下个项目' in frag:
            continue
        if name != 'text' and '一个完整的项目肯定不止这些' in frag:
            continue
        top, bottom = box(frag)
        if top is None or top < HEAD_CUT:
            continue
        if round(top, 1) in drop:
            continue
        kids.append([top, bottom, strip_wide_rules(frag)])

    y0 = min(k[0] for k in kids)

    # 章节名在画布里本来就有一个元素（30px / font-weight:600 / left:255）。
    # 找到它、挂上 doc-ch 与序号，样式层会把它做成 augen 那种带发丝线的章节头。
    # 不能按侧边栏的 data-sec 坐标去找——第一版有几页的 data-sec 和章节名实际的
    # top 差着一百多像素（justpaper 的 Design 写 3211，标题在 3335）。
    # 所以按内容认：文本正好等于章节名、且是那一档 30px 半粗的标题。
    labels = {c[1]: '%02d' % (i + 1) for i, c in enumerate(cfg['chapters'])}
    heads = {}          # 章节名 -> 该标题元素的 top
    for top, bottom, frag in kids:
        m = re.match(r'<div\b[^>]*>', frag)
        if not m or 'font-size:30px' not in m.group(0) or 'font-weight:600' not in m.group(0):
            continue
        txt = re.sub(r'<[^>]+>', '', frag).strip()
        if txt in labels and txt not in heads:
            heads[txt] = top

    # 章节起点：优先用标题实际所在的位置，找不到标题才退回配置里的坐标。
    chapters = []
    for cid, label, start, tone in cfg['chapters']:
        s = heads.get(label, float(start))
        if s < y0:
            continue        # Intro 那一档的文字在蓝底的头里，画布里没有标题
        chapters.append(dict(cid=cid, label=label, top=s, no=labels[label],
                             synth=label not in heads))
    chapters.sort(key=lambda c: c['top'])

    # 标题到正文的距离必须全站一个数。第一版每章都不一样（有的 82px 就接正文，
    # 有的空了 274px），放大标题之后这种不齐特别显眼。做法是量出每章标题下方
    # 第一个元素原来的距离，把差额补给「该元素及其之后的全部元素」——
    # 补的是同一个常数，所以章节内部的相对关系一个都没动。
    tops = sorted(set(k[0] for k in kids))
    for i, ch in enumerate(chapters):
        nxt = chapters[i + 1]['top'] if i + 1 < len(chapters) else float('inf')
        # 真标题要跳过它自己；补出来的标题（Outcome）那个坐标上坐的是正文，
        # 第一版就有元素正好落在章节坐标上，不跳的话距离会算错一整档。
        lo = ch['top'] + 1 if not ch['synth'] else ch['top'] - 0.5
        after = [t for t in tops if lo < t < nxt]
        ch['first'] = after[0] if after else None

    seams = [ch['top'] for ch in chapters if ch['top'] > y0]
    seam = set(round(s, 1) for s in seams)
    head_tops = {round(v, 1): labels[k] for k, v in heads.items()}
    # 只有落在章节缝上的标题会被提升，画布第一个元素就是标题的那一档不提；
    # 补距离时要把这个差别算进去，否则那一章的标题下面就比别处紧 74px。
    for ch in chapters:
        ch['lift'] = CHAPTER_HEAD_LIFT if round(ch['top'], 1) in seam else 0

    def shift_of(top):
        d = CHAPTER_GAP * sum(1 for s in seams if top >= s)
        for ch in chapters:
            if ch['first'] is not None and top >= ch['first']:
                d += HEAD_TO_BODY - ch['lift'] - (ch['first'] - ch['top'])
        return d

    out = []
    span = 0.0
    for top, bottom, frag in kids:
        key = round(top, 1)
        d = shift_of(top)
        no = head_tops.get(key)
        if no is not None:
            frag = re.sub(r'<div\b', '<div class="doc-ch" data-no="%s"' % no, frag, count=1)
            # 提升只在真正的章节缝上做（那里才有 CHAPTER_GAP 腾出来的空间）。
            # 画布第一个元素就是章节名时不提，否则会顶到上面的蓝底里。
            if key in seam:
                d -= CHAPTER_HEAD_LIFT
        if d:
            frag = bump_top(frag, d)
        span = max(span, bottom + d - y0)
        out.append(frag)

    # Outcome 这一档第一版画布里根本没有标题（只有侧边栏有这一项），
    # 所以按同一档样式补一个：字号、字重、左边缘都和画布里那几个标题一致。
    # 位置直接从该章第一个正文元素往上量 HEAD_TO_BODY，和真标题的距离完全相同。
    for ch in chapters:
        if not ch['synth'] or ch['first'] is None:
            continue
        y = ch['first'] + shift_of(ch['first']) - HEAD_TO_BODY
        ch['head_y'] = y
        out.append(
            '<div class="doc-ch" data-no="%s" style="position:absolute;top:%.2fpx;left:255px;'
            "font-family:'PingFang HK','PingFang SC',sans-serif;font-size:30px;"
            'white-space:nowrap;color:rgba(50,48,46,1);line-height:32px;'
            'font-weight:600">%s</div>' % (ch['no'], y, ch['label']))

    # 章节锚点：顶栏的章节链接跳到这里。锚点是零尺寸的空元素，不影响任何排版。
    # 位置跟着标题走，再往上留一点，跳过去时标题不会贴着顶栏。
    by_label = {ch['label']: ch for ch in chapters}

    def anchor_y(label, start):
        ch = by_label.get(label)
        if not ch:
            s = max(float(start), y0)
            return s + shift_of(s)
        if 'head_y' in ch:
            return ch['head_y'] - 90
        return ch['top'] + shift_of(ch['top']) - ch['lift'] - 90

    anchors = ''.join(
        '<span class="doc-anchor" id="%s" style="top:%.0fpx"></span>'
        % (cid, anchor_y(label, start))
        for cid, label, start, tone in cfg['chapters'])
    return anchors + ''.join(out), y0, span


TONE = {'paper': 'band--paper', 'white': 'band--white',
        'ink': 'band--ink', 'accent': 'band--accent'}


def asset_stamp():
    """样式与脚本链接上挂一个版本号。

    Chrome 对本地静态文件的缓存很凶（交接文档里记过一笔），改了 css 不加版本号
    经常刷不出来。版本号取 css/ 与 js/ 里最新的修改时间，只有真改了才会变。"""
    newest = 0
    for d in ('css', 'js'):
        p = os.path.join(ROOT, d)
        for f in os.listdir(p):
            newest = max(newest, int(os.path.getmtime(os.path.join(p, f))))
    return newest


def build(cfg):
    doc_html, y0, span = prepare(cfg)
    nav = ''.join(
        '    <li><a class="nav__link" href="#%s"><span class="nav__label">'
        '<span class="nav__text">%s</span></span></a></li>\n' % (c[0], c[1])
        for c in cfg['chapters'])

    lines = ''.join(
        '        <span class="line-clip"><span class="line-inner%s">%s</span></span>\n'
        % ('' if i == 0 else ' case-head__dim', t)
        for i, t in enumerate(cfg['lines']))
    tags = ''.join('<span class="tag">%s</span>' % t for t in cfg['tags'])
    intro = ''.join('        <p class="doc-body">%s</p>\n' % p for p in cfg['intro'])

    head = '''  <header class="band band--accent case-head doc-head">
    <div class="doc-page case-head__inner">
      <p class="t-num">%s</p>
      <h1 class="t-h1 case-head__title">
%s      </h1>
      <div class="case-head__meta">
        <span class="t-cap">%s</span>
        <span class="t-cap">%s</span>
        <span class="work__tags">%s</span>
      </div>
      <div class="case-head__intro">
%s      </div>
    </div>
  </header>
''' % (cfg['no'], lines, cfg['year'], cfg['team'], tags, intro)

    body = [head]
    if cfg.get('statement'):
        st = cfg['statement']
        body.append(
            '  <!-- 陈述层：大字在后、产品图在前，两层不同速率位移，滚过去时字从图后面漏出来。\n'
            '       全站唯一一处 140px 大字，就是这里。 -->\n'
            '  <section class="band band--ink statement statement--device" aria-label="%s">\n'
            '    <p class="t-statement statement__type">%s</p>\n'
            '    <figure class="statement__art"><img src="%s" alt="%s"\n'
            '      width="%d" height="%d" /></figure>\n'
            '  </section>\n'
            % (st['type'], st['type'], st['art'], st['alt'], st['w'], st['h']))
    if cfg.get('dual'):
        body.append(DUAL)
    # 正文＝一整张画布，不再切段。切段会把章节之间的元素连带丢掉，
    # 也会因为段高取整而裁到内容，所以退回整幅渲染。
    body.append(
        '  <div class="case-doc-wrap" data-span="%.2f">\n'
        '    <div class="case-doc">\n'
        '      <div class="case-slice" style="--y0:%.2fpx">%s</div>\n'
        '    </div>\n'
        '  </div>\n' % (span, y0, doc_html))

    href, no, title, desc = cfg['next']
    body.append('''  <section class="band band--accent act coda">
    <div class="page">
      <p class="t-body coda__line">%s</p>
    </div>
  </section>

  <section class="band band--paper act next">
    <a class="page next__link" href="%s">
      <span class="t-label">看看下个项目</span>
      <span class="next__row">
        <span class="t-num">%s</span>
        <span class="t-h1 next__title">%s</span>
        <svg class="next__arrow" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </span>
      <span class="t-body next__desc">%s</span>
    </a>
  </section>
''' % (cfg['coda'], href, no, title, desc))

    extra_css = '\n<link rel="stylesheet" href="css/kit.css" />\n' \
                '<link rel="stylesheet" href="css/signatures.css" />' \
                if (cfg.get('dual') or cfg.get('statement')) else ''
    extra_js = '\n<script src="js/kit.js"></script>' if cfg.get('statement') else ''
    if cfg.get('dual'):
        extra_js += '\n<script src="js/case-dual.js"></script>'

    page = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>%s — 朱晨宇</title>
<link rel="icon" href="assets/graphics/favicon.png" sizes="32x32" />
<link rel="apple-touch-icon" href="assets/graphics/favicon-180.png" />
<link rel="stylesheet" href="css/base.css" />
<link rel="stylesheet" href="css/case.css" />
<link rel="stylesheet" href="css/case-doc.css" />%s
</head>
<body class="is-case">

<nav class="nav" id="nav" aria-label="章节导航">
  <span class="nav__glass" aria-hidden="true"></span>
%s
  <ul class="nav__list">
%s  </ul>
</nav>
<script src="js/nav-enter.js"></script>

<div class="progress" id="progress" aria-hidden="true"><span></span></div>

<main>
%s</main>

<script src="vendor/gsap.min.js"></script>
<script src="vendor/ScrollTrigger.min.js"></script>
<script src="vendor/lenis.min.js"></script>
<script src="js/site.js"></script>
<script src="js/case-doc.js"></script>%s
</body>
</html>
''' % (cfg['title'], extra_css, NAV_HOME % cfg['id'], nav, ''.join(body), extra_js)

    out = os.path.join(ROOT, 'case-%s.html' % cfg['id'])
    page = re.sub(r'(href="css/[a-z-]+\.css)"', r'\1?v=%d"' % STAMP, page)
    page = re.sub(r'(src="js/[a-z-]+\.js)"', r'\1?v=%d"' % STAMP, page)
    open(out, 'w', encoding='utf-8').write(page)
    print('%-11s 画布 y0=%.0f 高 %.0fpx  %d KB  章节 %s'
          % (cfg['id'], y0, span, len(page) // 1024,
             '/'.join(c[1] for c in cfg['chapters'])))


if __name__ == '__main__':
    STAMP = asset_stamp()
    for c in CASES:
        build(c)
