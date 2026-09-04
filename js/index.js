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
      <span class="work__win"><img src="assets/preview/${p.id}.webp" alt="" width="2080" height="1300" loading="lazy" /></span>
      <span class="work__plate">
        <span class="t-num">${esc(p.no)}</span>
        <span class="work__dots"><i></i><i></i><i></i></span>
      </span>
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

  /* ---- 样机卡片：常显，悬停时抬起 + 里面的图轻微推近 -------------------
     不再用"从右抹开"那种揭示动作——卡片常显更有信息量，悬停要做的只是
     把它从版面里抬出来一点，并且让图有一点被推近的错位感。 */
  function rowThumbs() {
    if (!S || S.reduced || !S.hasGsap || matchMedia('(hover: none)').matches) return;

    document.querySelectorAll('.work__row').forEach((row) => {
      const thumb = row.querySelector('.work__thumb');
      const img = thumb && thumb.querySelector('img');
      if (!thumb || !img) return;

      const lift = gsap.timeline({ paused: true })
        .to(thumb, { y: -8, scale: 1.035, duration: 0.55, ease: 'expo.out' }, 0)
        .to(img, { scale: 1.07, duration: 0.9, ease: 'expo.out' }, 0);

      // 轻微视差：光标横向移动时卡片反向偏一点，量很小，只做"活"的感觉
      const px = gsap.quickTo(thumb, 'x', { duration: 0.7, ease: 'power3.out' });
      const rot = gsap.quickTo(thumb, 'rotate', { duration: 0.8, ease: 'power3.out' });

      row.addEventListener('pointerenter', () => lift.play());
      row.addEventListener('pointerleave', () => { lift.reverse(); px(0); rot(0); });
      row.addEventListener('pointermove', (e) => {
        const r = row.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        px(nx * -14);
        rot(nx * 1.4);
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

  /* ---- 首屏主视觉：进场是「揭幕」，不是淡入 ----------------------------
     从下往上把 clip-path 拉开，同时图本身稍微退比例并去掉模糊——三条曲线叠在
     一起才有"揭幕"的重量感，单做淡入就是普通过渡。 */
  function heroKey() {
    if (!S || !S.hasGsap) return;
    const fig = document.getElementById('heroKey');
    const img = fig && fig.querySelector('img');
    if (!fig || !img) return;

    if (S.reduced) { gsap.set(fig, { clipPath: 'inset(0%)' }); return; }

    gsap.timeline({ delay: 0.15 })
      .fromTo(fig, { clipPath: 'inset(14% 6% 0% 6%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.out' }, 0)
      .fromTo(img, { scale: 1.14, filter: 'blur(14px)', opacity: 0.5 },
        { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 1.7, ease: 'expo.out' }, 0);

    // 滚动时极缓地压下去并轻微失焦，把注意力交给下一段
    gsap.to(img, {
      yPercent: 9, scale: 1.04, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
    });
  }

  /* ---- 尘点：24 个 3px 的点在主视觉上做无规律漂移 ----------------------
     不用 canvas——数量这么少时 DOM + transform 更省，而且能跟着 GSAP 的
     ticker 一起走，不会和 Lenis 抢帧。位置和时长按索引错开，不用随机数，
     这样每次加载的节奏一致，也方便排查。 */
  function dust() {
    if (!S || S.reduced || !S.hasGsap) return;
    const box = document.getElementById('heroDust');
    if (!box) return;
    const N = 24;
    box.innerHTML = new Array(N).fill('<i></i>').join('');
    [...box.children].forEach((dot, i) => {
      const x = ((i * 37) % 100), y = ((i * 61) % 100);
      const span = 26 + (i % 5) * 9;          // 漂移幅度 26–62px
      gsap.set(dot, { left: x + '%', top: y + '%', scale: 0.6 + (i % 4) * 0.25 });
      gsap.to(dot, {
        opacity: 0.1 + (i % 3) * 0.06,
        duration: 1.4, delay: 0.6 + i * 0.05, ease: 'sine.out',
      });
      gsap.to(dot, {
        x: (i % 2 ? span : -span), y: (i % 3 ? -span * 0.7 : span * 0.7),
        duration: 9 + (i % 7) * 2.4, ease: 'sine.inOut',
        repeat: -1, yoyo: true, delay: i * 0.18,
      });
    });
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

  rowThumbs();
  focusLadder();
  heroKey();
  dust();
  rowIntro();
  if (S) { S.revealAll(); S.navBehaviour(); S.navInvert(); }
})();
