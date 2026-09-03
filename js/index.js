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
    <span class="work__thumb" aria-hidden="true">
      <img src="assets/preview/${p.id}.webp" alt="" width="1040" height="660" loading="lazy" />
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

  /* ---- 技能：与第一版逐字一致，只调整了排版分组 ----------------------- */
  const skillsBox = document.getElementById('aboutSkills');
  if (skillsBox) {
    const SKILLS = [
      ['产品', '多模态 / 用户心理 / 模型推动 / 功能迭代 / 需求挖掘 / 服务蓝图 / 用户体验地图…'],
      ['视频', 'AfterEffects / Premiere / Protopie / Spline / Rive'],
      ['二维', 'Figma / Illustrator / Photoshop'],
      ['三维', 'Zbrush / Blender / 3DS Max'],
      ['AI', 'IDE 类 / 视觉生成类'],
    ];
    skillsBox.innerHTML = `<p class="t-label">Skills</p>
${SKILLS.map(([k, v]) => `<div class="row about__row" data-reveal="up">
  <span class="t-lead">${esc(k)}</span>
  <span class="t-body about__skillval">${esc(v)}</span>
</div>`).join('')}`;
  }

  /* ---- 行内缩略图：贴着行右端揭开，不再用跟随光标的大卡片 ------------- */
  function rowThumbs() {
    if (!S || S.reduced || !S.hasGsap || matchMedia('(hover: none)').matches) return;

    document.querySelectorAll('.work__row').forEach((row) => {
      const thumb = row.querySelector('.work__thumb');
      const img = thumb && thumb.querySelector('img');
      if (!thumb || !img) return;

      // 揭开：从右向左抹开 + 图片本身反向位移，做出"被推出来"的错位感
      const open = gsap.timeline({ paused: true })
        .to(thumb, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.62, ease: 'expo.out' }, 0)
        .fromTo(img, { xPercent: 12 }, { xPercent: 0, duration: 0.78, ease: 'expo.out' }, 0)
        .to(thumb, { autoAlpha: 1, duration: 0.2, ease: 'none' }, 0);

      // 轻微视差：光标在行内横向移动时缩略图反向偏一点，量很小，只做"活"的感觉
      const px = gsap.quickTo(thumb, 'x', { duration: 0.7, ease: 'power3.out' });
      const py = gsap.quickTo(thumb, 'y', { duration: 0.7, ease: 'power3.out' });

      row.addEventListener('pointerenter', () => open.play());
      row.addEventListener('pointerleave', () => { open.reverse(); px(0); py(0); });
      row.addEventListener('pointermove', (e) => {
        const r = row.getBoundingClientRect();
        px(((e.clientX - r.left) / r.width - 0.5) * -18);
        py(((e.clientY - r.top) / r.height - 0.5) * -12);
      });
    });
  }

  /* ---- 焦点阶梯：悬停一行，其余行按距离递增虚化 ------------------------ */
  function focusLadder() {
    if (!S || S.reduced || matchMedia('(hover: none)').matches) return;
    const listEl = document.getElementById('workList');
    if (!listEl) return;
    const items = [...listEl.children];
    items.forEach((item, i) => {
      item.addEventListener('pointerenter', () => {
        listEl.classList.add('is-focusing');
        items.forEach((o, j) => { o.dataset.far = String(Math.min(4, Math.abs(j - i))); });
      });
    });
    listEl.addEventListener('pointerleave', () => {
      listEl.classList.remove('is-focusing');
      items.forEach((o) => { delete o.dataset.far; });
    });
  }

  /* ---- 铝板随滚动缓慢下沉：只是一层很轻的视差，别抢注意力 -------------- */
  function heroParallax() {
    if (!S || S.reduced || !S.hasGsap) return;
    const obj = document.querySelector('.hero__object');
    if (!obj) return;
    gsap.to(obj, {
      yPercent: 16, rotate: -2.5, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
    });
  }

  rowThumbs();
  focusLadder();
  heroParallax();
  if (S) { S.revealAll(); S.navBehaviour(); S.navInvert(); }
})();
