#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性脚本：把首页四块 JS 渲染的内容烤进 index.html。

为什么要烤：这四块（作品行、经历/学历、技能、联系方式）原来由 js/index.js 用
innerHTML 渲染。后果是首次绘制时文档只有一屏高（900px），带 ?row= 从内页返回时
landOnHash() 想落位也没地方落——实测首屏图会先停 611ms，等行渲染出来才跳。
写进 HTML 之后第一帧文档就是全高，落位可以在第一帧完成。

数据与模板逐字取自 js/index.js 改动前的版本，只去掉了 innerHTML 拼接。
跑完这个脚本后 index.js 里那四段渲染和对应数据就删掉，index.html 成为唯一来源。
"""
import io
import re
import sys

PROJECTS = [
    ('companion', '1', 'Companion App', '2025', 'IDG UI/UX 组',
     'Tiko 是一位智能协作助手，能够帮助用户更快速地获取信息、完成决策并简化日常工作流程，为用户带来更顺畅的使用体验。',
     ['交互体验', '视觉', '表情动效'], 'case-companion.html'),
    ('justpaper', '2', 'Just Paper', '2026', 'IDG UI/UX 组',
     '原生笔记软件，结合双屏的产品特点为用户构建笔记使用新体验。',
     ['组件库', '设计规范', '双屏交互'], 'case-justpaper.html'),
    ('oreate', '3', 'KOOKO', '2026', 'PSIG 海外产品创新组',
     'AI 全模态内容，快速生成 AI 图像、视频等多元需求，支持 PPT、助力深度研究与写作。',
     ['多模态', '视觉范式', '模型交互'], 'case-oreate.html'),
    ('terabox', '4', 'Terabox', '2026', 'PSIG 海外产品创新组',
     '百度网盘海外版本，主打内容 + AI，海外方向强化多模态与 AI 能力。',
     ['AI 编辑器', 'Agent', '海外迁移'], 'case-terabox.html'),
    ('practices', '5', 'Practices', '—', '个人练习',
     '个人技能练习作品，包括 UI 页面、MG 动效／三维动效（静帧展示）、建模视觉等。',
     ['UI', 'MG 动效', '三维'], 'case-practices.html'),
]

ABOUT = [
    ('Experiences', [('联想', '体验设计实习生', '2025.9 – 2026.4', 'lenovo'),
                     ('百度', 'AI 产品经理实习生（设计侧）', '2026.4 – 至今', 'baidu')]),
    ('Education', [('湖南城市学院', '环境设计 学士', '2022 – 2024', None),
                   ('湖南师范大学', '数字媒体设计 硕士', '2024 – 2027', None)]),
]

SKILLS = [
    ('产品', '多模态 / 用户心理 / 模型推动 / 功能迭代 / 需求挖掘 / 服务蓝图 / 用户体验地图…'),
    ('视频', 'AfterEffects / Premiere / Protopie / Spline / Rive'),
    ('二维', 'Figma / Illustrator / Photoshop'),
    ('三维', 'Zbrush / Blender / 3DS Max'),
    ('AI', 'IDE 类 / 视觉生成类'),
]

CONTACT = [('Tel', '18817076170'), ('Wechat', 'IfiGottA'),
           ('Email', '670156618@qq.com'), ('小红书', 'Youozki')]


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def work_html():
    out = []
    for pid, no, title, year, team, desc, tags, href in PROJECTS:
        tg = ''.join('<span class="tag">%s</span>' % esc(t) for t in tags)
        out.append(
            '        <li class="work__item" id="row-%s">\n'
            '          <a class="work__row" href="%s" data-id="%s" data-reveal="up">\n'
            '            <span class="work__meta">\n'
            '              <span class="t-num work__no">%s</span>\n'
            '              <span class="t-cap work__year">%s</span>\n'
            '              <span class="t-cap work__team">%s</span>\n'
            '            </span>\n'
            '            <span class="work__main">\n'
            '              <span class="t-h1 work__name">%s</span>\n'
            '              <span class="t-body work__desc">%s</span>\n'
            '              <span class="work__tags">%s</span>\n'
            '            </span>\n'
            '          </a>\n'
            '        </li>\n'
            % (pid, href, pid, esc(no), esc(year), esc(team), esc(title), esc(desc), tg))
    return ''.join(out)


def about_html():
    out = []
    for head, items in ABOUT:
        out.append('        <div class="about__block">\n'
                   '          <p class="t-label">%s</p>\n' % esc(head))
        for org, sub, when, logo in items:
            img = ('<img class="about__logo" data-logo="%s" src="assets/logos/%s.webp"'
                   ' alt="%s" width="294" height="96" loading="lazy" />' % (logo, logo, esc(org))
                   ) if logo else ''
            out.append(
                '          <div class="row about__row" data-reveal="up">\n'
                '            <span class="t-cap">%s</span>\n'
                '            <span><span class="t-lead about__org">%s%s</span>'
                '<span class="t-cap about__sub">%s</span></span>\n'
                '          </div>\n' % (esc(when), img, esc(org), esc(sub)))
        out.append('        </div>\n')
    return ''.join(out)


def skills_html():
    out = ['        <p class="t-label">Skills</p>\n']
    for k, v in SKILLS:
        out.append('        <div class="row about__row" data-reveal="up">\n'
                   '          <span class="t-lead">%s</span>\n'
                   '          <span class="t-body about__skillval">%s</span>\n'
                   '        </div>\n' % (esc(k), esc(v)))
    return ''.join(out)


def contact_html():
    out = []
    for k, v in CONTACT:
        out.append('        <li class="contact__item" data-reveal="up">\n'
                   '          <span class="t-label contact__key">%s</span>\n'
                   '          <span class="t-h2 contact__val">%s</span>\n'
                   '        </li>\n' % (esc(k), esc(v)))
    return ''.join(out)


FILLS = [
    ('workList', 'ol', work_html),
    ('aboutRows', 'div', about_html),
    ('aboutSkills', 'div', skills_html),
    ('contactList', 'ul', contact_html),
]

if __name__ == '__main__':
    s = open('index.html', encoding='utf-8').read()
    for cid, tag, fn in FILLS:
        # 只填空容器；已经有内容就跳过，免得重复跑一次塞两份
        pat = re.compile(r'(<%s\b[^>]*id="%s"[^>]*>)\s*(</%s>)' % (tag, cid, tag))
        m = pat.search(s)
        if not m:
            print('跳过 %s（没找到空容器，可能已经烤过）' % cid)
            continue
        s = s[:m.start()] + m.group(1) + '\n' + fn() + '      ' + m.group(2) + s[m.end():]
        print('已填 %s' % cid)
    open('index.html', 'w', encoding='utf-8').write(s)
    print('index.html 现在 %d 行' % s.count('\n'))
