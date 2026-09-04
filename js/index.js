/* 索引页：五个项目并列直达。顺序承载信息，但任何一个都能一步点进去。 */
(() => {
  'use strict';
  const S = window.SITE;

  /* 全部文案与年份均取自第一版，未作改写；标签来自各案例正文里我自己写的参与范围。 */
  const PROJECTS = [
    { id: 'companion', no: '1', title: 'Companion App', year: '2025', team: 'IDG UI/UX 组',
      desc: 'Tiko 是一位智能协作助手，能够帮助用户更快速地获取信息、完成决策并简化日常工作流程，为用户带来更顺畅的使用体验。',
      tags: ['交互体验', '视觉', '表情动效'], href: 'case-companion.html' },
    { id: 'justpaper', no: '2', title: 'Just Paper', year: '2026', team: 'IDG UI/UX 组',
      desc: '原生笔记软件，结合双屏的产品特点为用户构建笔记使用新体验。',
      tags: ['组件库', '设计规范', '双屏交互'], href: '' },
    { id: 'oreate', no: '3', title: 'Oreate AI', year: '2026', team: 'PSIG 海外产品创新组',
      desc: 'AI 全模态内容，快速生成 AI 图像、视频等多元需求，支持 PPT、助力深度研究与写作。',
      tags: ['多模态', '视觉范式', '模型交互'], href: '' },
    { id: 'terabox', no: '4', title: 'Terabox', year: '2026', team: 'PSIG 海外产品创新组',
      desc: '百度网盘海外版本，主打内容 + AI，海外方向强化多模态与 AI 能力。',
      tags: ['AI 编辑器', 'Agent', '海外迁移'], href: '' },
    { id: 'practices', no: '5', title: 'Practices', year: '—', team: '个人练习',
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

  /* ---- 关于：只放第一版里已有的事实，不新增任何履历信息 ---------------
     两个 logo 是用户自己文件里的原图，只做了尺寸与底色处理，没有重绘。 */
  const aboutRows = document.getElementById('aboutRows');
  if (aboutRows) {
    const ROWS = [
      ['Experiences', [['联想', '体验设计实习生', '2025.9 – 2026.4', 'lenovo'],
        ['百度', 'AI 产品经理实习生（设计侧）', '2026.4 – 至今', 'baidu']]],
      ['Education', [['湖南城市学院', '环境设计 学士', '2022 – 2024'],
        ['湖南师范大学', '数字媒体设计 硕士', '2024 – 2027']]],
    ];
    aboutRows.innerHTML = ROWS.map(([head, items]) => `<div class="about__block">
  <p class="t-label">${esc(head)}</p>
  ${items.map(([a, b, c, logo]) => `<div class="row about__row">
    <span class="t-cap">${esc(c)}</span>
    <span><span class="t-lead about__org">${logo
      ? `<img class="about__logo" src="assets/logos/${logo}.webp" alt="${esc(a)}" width="236" height="76" loading="lazy" />`
      : ''}${esc(a)}</span><span class="t-cap about__sub">${esc(b)}</span></span>
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

  /* ---- 首屏：先图，后字，最后图形 --------------------------------------
     顺序照 augen：主视觉先从模糊到清晰、把画面立起来；等它基本清楚了文字才
     模糊到清晰跟上；胶囊最后做位移。三段错开而不是一起淡入，才有"先看到画面
     再读到字"的层次。 */
  function heroIntro() {
    if (!S || !S.hasGsap) return;
    const fig = document.getElementById('heroKey');
    const img = fig && fig.querySelector('img');
    const texts = document.querySelectorAll('[data-hero="text"]');
    const moves = document.querySelectorAll('[data-hero="move"]');
    if (!img) return;

    if (S.reduced) return;

    const tl = gsap.timeline({ delay: 0.1 });
    tl.fromTo(img,
      { filter: 'blur(26px)', scale: 1.09, opacity: 0.35 },
      { filter: 'blur(0px)', scale: 1, opacity: 1, duration: 1.5, ease: 'expo.out' }, 0);
    tl.fromTo(texts,
      { filter: 'blur(10px)', opacity: 0, y: 14 },
      { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.09 },
      0.75);
    tl.fromTo(moves,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: 'expo.out', stagger: 0.055 },
      1.05);
  }

  /* ---- 作品行：入场时发丝线自己画出来，标签错落跟上 -------------------- */
  function rowIntro() {
    if (!S || S.reduced || !S.hasGsap) return;
    gsap.utils.toArray('.work__item').forEach((item) => {
      const row = item.querySelector('.work__row');
      const tags = item.querySelectorAll('.tag');
      if (!row) return;
      gsap.timeline({ scrollTrigger: { trigger: item, start: 'top 88%', once: true } })
        .fromTo(row, { '--rule-scale': 0 }, { '--rule-scale': 1, duration: 0.9, ease: 'expo.out' }, 0)
        .fromTo(tags, { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.05 }, 0.18);
    });
  }

  focusLadder();
  heroIntro();
  rowIntro();
  if (S) { S.revealAll(); S.navBehaviour(); S.navInvert(); }
})();
