/* 索引页：五个项目并列直达。顺序承载信息，但任何一个都能一步点进去。 */
(() => {
  'use strict';
  const S = window.SITE;

  /* 全部文案与年份均取自第一版，未作改写；标签来自各案例正文里我自己写的参与范围。 */
  const PROJECTS = [
    { id: 'companion', no: '0.1', title: 'Companion App', year: '2025', team: 'IDG UI/UX 组',
      desc: 'Tiko 是一位智能协作助手，能够帮助用户更快速地获取信息、完成决策并简化日常工作流程，为用户带来更顺畅的使用体验。',
      tags: ['交互体验', '视觉', '表情动效'], href: 'case-companion.html' },
    { id: 'justpaper', no: '0.2', title: 'Just Paper', year: '2026', team: 'IDG UI/UX 组',
      desc: '原生笔记软件，结合双屏的产品特点为用户构建笔记使用新体验。',
      tags: ['组件库', '设计规范', '双屏交互'], href: '' },
    { id: 'oreate', no: '0.3', title: 'Oreate AI', year: '2026', team: 'PSIG 海外产品创新组',
      desc: 'AI 全模态内容，快速生成 AI 图像、视频等多元需求，支持 PPT、助力深度研究与写作。',
      tags: ['多模态', '视觉范式', '模型交互'], href: '' },
    { id: 'terabox', no: '0.4', title: 'Terabox', year: '2026', team: 'PSIG 海外产品创新组',
      desc: '百度网盘海外版本，主打内容 + AI，海外方向强化多模态与 AI 能力。',
      tags: ['AI 编辑器', 'Agent', '海外迁移'], href: '' },
    { id: 'practices', no: '0.5', title: 'Practices', year: '—', team: '个人练习',
      desc: '个人技能练习作品，包括 UI 页面、MG 动效／三维动效（静帧展示）、建模视觉等。',
      tags: ['UI', 'MG 动效', '三维'], href: '' },
  ];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---- 渲染作品索引行 ------------------------------------------------- */
  const list = document.getElementById('workList');
  if (list) {
    list.innerHTML = PROJECTS.map((p) => {
      const live = !!p.href;
      const tag = live ? 'a' : 'div';
      const attrs = live ? `href="${p.href}"` : '';
      return `<li class="work__item" id="row-${p.id}">
  <${tag} class="work__row${live ? '' : ' is-wip'}" ${attrs} data-id="${p.id}" data-reveal="up">
    <span class="work__meta">
      <span class="t-num work__no">${esc(p.no)}</span>
      <span class="t-cap work__year">${esc(p.year)}</span>
      <span class="t-cap work__team">${esc(p.team)}</span>
    </span>
    <span class="work__main">
      <span class="t-h1 work__name">${esc(p.title)}${live ? '' : '<em class="work__wip">即将上线</em>'}</span>
      <span class="t-body work__desc">${esc(p.desc)}</span>
      <span class="work__tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
    </span>
  </${tag}>
</li>`;
    }).join('');
  }

  /* ---- 关于：只放第一版里已有的事实，不新增任何履历信息 --------------- */
  const aboutRows = document.getElementById('aboutRows');
  if (aboutRows) {
    const ROWS = [
      ['Experiences', [['联想', '体验设计实习生', '2025.9 – 2026.4'],
        ['百度', 'AI 产品经理实习生（设计侧）', '2026.4 – 至今']]],
      ['Education', [['湖南城市学院', '环境设计 学士', '2022 – 2024'],
        ['湖南师范大学', '数字媒体设计 硕士', '2024 – 2027']]],
    ];
    aboutRows.innerHTML = ROWS.map(([head, items]) => `<div class="about__block">
  <p class="t-label">${esc(head)}</p>
  ${items.map(([a, b, c]) => `<div class="row about__row">
    <span class="t-cap">${esc(c)}</span>
    <span><span class="t-lead">${esc(a)}</span><span class="t-cap about__sub">${esc(b)}</span></span>
  </div>`).join('')}
</div>`).join('');
  }

  /* ---- 联系方式：与第一版一致，纯文本，不猜测链接 --------------------- */
  const contactList = document.getElementById('contactList');
  if (contactList) {
    const C = [['Tel', '18817076170'], ['Wechat', 'IfiGottA'],
      ['Email', '670156618@qq.com'], ['小红书', 'Youozki']];
    contactList.innerHTML = C.map(([k, v]) => `<li class="contact__item" data-reveal="up">
  <span class="t-label contact__key">${esc(k)}</span>
  <span class="t-h2 contact__val">${esc(v)}</span>
</li>`).join('');
  }

  /* ---- 悬停预览：跟随光标，用 quickTo 做插值，手感要黏而不迟滞 -------- */
  function hoverPreview() {
    if (!S || S.reduced || !S.hasGsap || matchMedia('(hover: none)').matches) return;

    const card = document.createElement('div');
    card.className = 'peek';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = PROJECTS.map((p) =>
      `<img class="peek__img" data-for="${p.id}" src="assets/preview/${p.id}.webp"
            alt="" width="1040" height="660" loading="lazy" />`).join('');
    document.body.appendChild(card);

    const xTo = gsap.quickTo(card, 'x', { duration: 0.55, ease: 'power3.out' });
    const yTo = gsap.quickTo(card, 'y', { duration: 0.55, ease: 'power3.out' });
    const imgs = card.querySelectorAll('.peek__img');
    let shown = false;

    const move = (e) => { xTo(e.clientX); yTo(e.clientY); };

    document.querySelectorAll('.work__row').forEach((row) => {
      row.addEventListener('pointerenter', (e) => {
        const id = row.dataset.id;
        imgs.forEach((im) => im.classList.toggle('is-on', im.dataset.for === id));
        if (!shown) { gsap.set(card, { x: e.clientX, y: e.clientY }); shown = true; }
        gsap.to(card, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
      });
      row.addEventListener('pointerleave', () => {
        gsap.to(card, { autoAlpha: 0, scale: 0.94, duration: 0.35, ease: 'power2.out' });
      });
      row.addEventListener('pointermove', move);
    });
  }

  hoverPreview();
  if (S) { S.revealAll(); S.navBehaviour(); }
})();
