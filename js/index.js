/* 索引页：五个项目并列直达。顺序承载信息，但任何一个都能一步点进去。 */
(() => {
  'use strict';
  const S = window.SITE;

  /* ---- 先把返回落位的目标摘下来自己保管 ---------------------------------
     内页的返回按钮带的是 index.html?row=<id>。用查询参数而不是 #row-<id>：
     作品行是脚本渲染出来的，地址栏里留着 hash，浏览器就会在行插进 DOM 之后
     自己滚一次，而且那一下发生在文档还没长够的时候，滚动量被截短，行最后停在
     半空中；replaceState 把 hash 摘掉也取消不了这次跳转（目标是跟着导航记的，
     不看 location.hash）。而且这一下正好插在建 ScrollTrigger 的中间，refresh
     会递归到自己崩，入场动画整批建不出来，[data-reveal] 停在 opacity:0，
     看到的就是"整页空白"。
     参数在这里立刻消费掉，位置由 landOnHash() 在动画建好之后自己落——顺带
     也就解决了"回到首页再刷新还停在那一行"：地址栏里已经没有那一行了。
     旧的 #row-<id> 链接继续认，直接打开或收藏过的地址不至于失效。 */
  const landing = (() => {
    let id = '';
    try {
      id = new URLSearchParams(location.search).get('row') || '';
    } catch (e) { /* 老浏览器没有 URLSearchParams */ }
    if (!/^[a-z]+$/.test(id)) id = '';
    if (!id && /^#row-[a-z]+$/.test(location.hash)) id = location.hash.slice(5);
    if (!id) return '';
    try {
      history.replaceState(history.state, '', location.pathname);
    } catch (e) { /* file:// 下 replaceState 会被拒，落位本身不受影响 */ }
    return '#row-' + id;
  })();

  const navType = (() => {
    try {
      const entry = performance.getEntriesByType('navigation')[0];
      return entry ? entry.type : '';
    } catch (e) { return ''; }
  })();

  /* 作品行、经历/学历、技能、联系方式这四块原来在这里用 innerHTML 渲染，
     现在直接写在 index.html 里。改成静态的原因：首次绘制时文档必须已经是全高，
     否则带 ?row= 从内页返回时 landOnHash() 无处可落——实测会先在首屏图停 611ms，
     等这四块渲染出来才跳到那一行。数据的唯一来源现在是 index.html，别再在这里加回来。
     （首页四块的 HTML 由 tools/bake_index_rows.py 一次性生成，脚本留档在 tools/ 里。）*/

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
      { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.09 },
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

  /* ---- 关于／技能的信息行：文字先出，分隔线随后从左延伸出来 ------------
     线是 .row::before，按 --rule-scale 缩放。延迟 0.3s 起手，让 data-reveal
     的文字先站住，读起来是"字落定、线画出来"，不是一起亮。 */
  function aboutIntro() {
    if (!S || S.reduced || !S.hasGsap) return;
    gsap.utils.toArray('.about__row').forEach((row, i) => {
      gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 92%', once: true } })
        .fromTo(row, { '--rule-scale': 0 },
          { '--rule-scale': 1, duration: 0.85, ease: 'expo.out' }, 0.3);
    });
  }

  /* ---- 关于的头像与那两句话：只从模糊到清晰，不位移 --------------------
     和下面的引言（data-reveal="fog"）是同一套参数：三句话并排站着，一起往上
     顶反而看得出是三块在动；只让字从雾里慢慢显出来。时长 1.3s、缓动收得慢，
     "慢慢出现"这四个字全靠这两个值。 */
  function aboutHead() {
    if (!S || S.reduced || !S.hasGsap) return;
    const items = document.querySelectorAll('[data-about-head]');
    if (!items.length) return;
    gsap.fromTo(items, { opacity: 0, filter: 'blur(8px)' },
      { opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'power1.out',
        stagger: 0.18,
        scrollTrigger: { trigger: '#about', start: 'top 72%', once: true } });
  }

  /* ---- 过场带 · 铰链线框 ------------------------------------------------
     图不是位图而是现画的 SVG，所以能跟着滚动动：滚动进度同时驱动上盖的角度、
     沿途残影的浮现、蓝色弧线的绘制，以及右边三句话逐句出现。
     重复的细节（散热孔、键位、轴上的垫片）用循环生成，手写太长也容易错。 */
  function blueprint() {
    const svg = document.getElementById('wf');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const put = (host, tag, attrs) => {
      if (!host) return;
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      host.appendChild(el);
    };
    // 侧面散热孔：一排等距短线
    const vents = svg.querySelector('#wfVents');
    for (let x = 536; x <= 668; x += 11) put(vents, 'line', { x1: x, y1: 470, x2: x, y2: 479 });
    // 键盘床：一排键位缝
    const keys = svg.querySelector('#wfKeys');
    for (let x = 308; x <= 676; x += 23) put(keys, 'line', { x1: x, y1: 455.5, x2: x, y2: 458.5 });
    // 轴上的垫片与卡簧，高度错落
    const shaft = svg.querySelector('#wfShaft');
    [[312, 26], [332, 15], [352, 31], [368, 11], [388, 34], [406, 18], [426, 26], [444, 13]]
      .forEach(([x, h]) => put(shaft, 'rect',
        { x, y: 590 - h / 2, width: 6, height: h, rx: 1.5 }));

    const lid = svg.querySelector('.wf-lid');
    const ghosts = [...svg.querySelectorAll('.wf-ghost')];
    const arc = svg.querySelector('.wf-arc');
    const arrow = svg.querySelector('.wf-arrow');
    const lines = [...document.querySelectorAll('.interlude__line')];
    const MAX = 105;
    // 弧线不用 stroke-dashoffset 画：这些线开了 non-scaling-stroke，
    // 虚线长度按屏幕像素算而不是用户单位，缩放之后画出来的比例就不对了
    // （用户看到的"蓝线超出打开角度"就是这么来的）。改成每帧重画路径，
    // 末端严格等于上盖当前角度，绝不可能跑到前面去。
    const AR = 300;
    const RAD = Math.PI / 180;

    const set = (p) => {
      const a = MAX * p;
      lid.setAttribute('transform', 'translate(250 470) rotate(' + (-a).toFixed(2) + ')');
      // 残影：过了那一档才浮出来，越早经过的越淡，读起来就是"走过的痕迹"
      ghosts.forEach((g, i) => {
        const at = Number(g.dataset.a);
        const t = Math.max(0, Math.min(1, (a - at) / 14));
        g.style.opacity = (t * (0.2 + i * 0.07)).toFixed(3);
      });
      if (arc) {
        const x = 250 + AR * Math.cos(a * RAD);
        const y = 470 - AR * Math.sin(a * RAD);
        arc.setAttribute('d', a < 0.6 ? 'M550 470'
          : 'M550 470 A ' + AR + ' ' + AR + ' 0 0 0 ' + x.toFixed(2) + ' ' + y.toFixed(2));
      }
      if (arrow) {
        arrow.setAttribute('transform', 'rotate(' + (-a).toFixed(2) + ' 250 470)');
        arrow.style.opacity = Math.max(0, Math.min(1, (a - 6) / 10)).toFixed(3);
      }
      lines.forEach((el, i) => {
        const t = Math.max(0, Math.min(1, (p - (0.1 + i * 0.25)) / 0.15));
        el.style.opacity = t.toFixed(3);
        el.style.transform = 'translateY(' + ((1 - t) * 14).toFixed(2) + 'px)';
      });
    };

    // 窄屏这一段不钉住（CSS 里已改成静态），没有可用的滚动量，
    // 直接给完全展开的终态：图和三句话都在，只是不跟着滚动演。
    if (!S || S.reduced || !S.hasGsap || matchMedia('(max-width: 767px)').matches) {
      set(1);
      return;
    }

    ScrollTrigger.create({
      trigger: '.interlude', start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => set(self.progress),
    });
    set(0);
  }

  /* ---- 过场带的纵向对齐：末行基线压在图纸最下面那条地线上 ---------------
     顶对齐时文字整块偏上——线框上半部只有几条残影，视觉重量全在下半部的机身、
     爆炸图和闭合参照上；数学居中又谁也不挨着谁。落到"底边对齐"才有真的对齐
     关系：图纸最下面那条地线（y=682）本来就一路伸到文字栏底下，末行的基线
     正好压在它的延长线上，两栏的下沿于是齐平。文字块的高度取决于换行，纯 CSS
     算不出来，所以这一段位置在这里量。用 transform 而不是 padding：padding 会
     把文字栏撑高，栏高一超过线框，整组内容在钉住区里就被顶得偏上。 */
  function interludeAlign() {
    const lines = document.querySelector('.interlude__lines');
    const ground = document.getElementById('wfGround');
    if (!lines || !ground) return;
    const last = lines.lastElementChild;
    const fit = () => {
      if (matchMedia('(max-width: 767px)').matches) { lines.style.transform = ''; return; }
      lines.style.transform = 'none';
      const cs = getComputedStyle(last);
      const fs = parseFloat(cs.fontSize);
      const lh = parseFloat(cs.lineHeight) || fs * 1.5;
      const box = last.getBoundingClientRect();
      // 行框底 → 基线：去掉行距的下半，再去掉降部（中文字面几乎没有降部，取 .12em）
      const baseline = box.bottom - (lh - fs) / 2 - fs * 0.12;
      const g = ground.getBoundingClientRect();
      lines.style.transform = 'translateY(' + (g.top + g.height / 2 - baseline).toFixed(1) + 'px)';
    };
    fit();
    let t = 0;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fit, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* ---- 首屏胶囊：悬停时文字向上滚一格就停住，不回滚 -------------------- */
  function pillRoll() {
    const arm = (el, roll) => {
      if (!el || !roll) return;
      const start = () => el.classList.add('is-rolling');
      el.addEventListener('pointerenter', start);
      el.addEventListener('focus', start);
      roll.addEventListener('animationend', () => el.classList.remove('is-rolling'));
    };
    document.querySelectorAll('.pill--roll').forEach((el) => {
      arm(el, el.querySelector('.pill__roll'));
    });
    // 右下角那个箭头同一套机制，方向在 CSS 里反过来（往下滚）
    const cue = document.querySelector('.hero__cue');
    if (cue) arm(cue, cue.querySelector('.cue__roll'));
  }

  /* ---- 兜底 -------------------------------------------------------------
     上面这些入场都建立在"GSAP 一定会把 [data-reveal] 放出来"上。真炸了
     （ScrollTrigger 递归崩、脚本没加载、浏览器太老），内容不能跟着一起没。 */
  function fallback(err) {
    document.documentElement.classList.add('motion-fallback');
    if (window.console && console.warn) console.warn('首页入场退到可读状态：', err);
  }

  /* 刷新（且只有刷新）时位置恢复被 index.html 接管成 manual 了，这里把 Lenis
     的内部值也归零，让首页从顶上完整重演一遍。普通换页和前进后退不碰：那两种
     情况下位置该由浏览器还原，硬拉回顶部会把人从原来的位置上甩走。 */
  function startAtTop() {
    if (navType !== 'reload') return;
    if (S && S.lenis) S.lenis.scrollTo(0, { immediate: true, force: true });
    else scrollTo(0, 0);
  }

  /* ---- 从项目内页返回：直接落在那一行的入口上 --------------------------
     上方留出约 14vh，行不至于贴在导航底下。这一步必须排在所有入场动画建好
     之后：trigger 要在 scroll 0 这个安定的位置上建，建完再跳。
     跳完只 update() 不 refresh()——trigger 的位置是文档坐标，滚动并没有改
     布局，而在非零位置上调 refresh() 正是那条递归崩溃的老路。 */
  function landOnHash() {
    if (!landing) return;
    const el = document.querySelector(landing);
    if (!el) return;

    /* 人一动就不再纠正位置——剩下的校准都是为了追字体和图片入位带来的位移，
       不是为了把人按在这一行上。 */
    let done = false;
    const stop = () => { done = true; };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((type) => {
      addEventListener(type, stop, { once: true, passive: true });
    });

    /* 判据是"这一行离视口顶还有多远"，不是"我们把滚动量设成了多少"：文档
       在字体和图片入位过程中会一直变长，只盯滚动量就会把长出来的那一段
       误判成用户自己滚过了，行也就停在半空中（移动端尤其明显）。 */
    const jump = () => {
      if (done) return;
      const want = innerHeight * 0.14;      // 上方留一档，行不至于贴在导航底下
      const top = el.getBoundingClientRect().top;
      if (Math.abs(top - want) < 8) return;
      const cur = S && S.lenis ? S.lenis.scroll : scrollY;
      const y = Math.max(0, top + cur - want);
      if (S && S.lenis) S.lenis.scrollTo(y, { immediate: true });
      else scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
    };

    jump();
    requestAnimationFrame(jump);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(jump);
    // 图片解码完文档还会再长一次，load 之后再校一次
    if (document.readyState === 'complete') jump();
    else addEventListener('load', jump, { once: true });

    /* 只在这几个时点校准接不住：字体子集、懒加载的 logo、画布图片是陆续入位的，
       文档一段一段往下长，行也就跟着往下走（移动端实测行最后停在半空，差了
       将近九百像素）。所以在头一秒多里盯着 body 的高度变化反复校，人一动就撤。 */
    [120, 300, 700, 1200].forEach((ms) => setTimeout(jump, ms));
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (done) ro.disconnect();
        else jump();
      });
      ro.observe(document.body);
      setTimeout(() => ro.disconnect(), 2500);
    }
  }

  /* 过场那一段（现画的 SVG 细节、纵向对齐）在四屏之下，但它建 DOM、读布局的
     开销全压在首屏入场那 1.6s 里——实测首屏开头一个 96ms、一个 64ms 的长任务，
     左下角那组字和项目胶囊就是在这儿掉帧。挪到入场之后再做，看不出差别。 */
  function later(fn) {
    const run = () => { try { fn(); } catch (err) { fallback(err); } };
    if ('requestIdleCallback' in window) setTimeout(() => requestIdleCallback(run, { timeout: 800 }), 1700);
    else setTimeout(run, 1700);
  }

  try {
    // 没有 GSAP 就没人来解开 .js 挂上的那些隐藏态（首屏图现在也在其中），
    // 而这条路不抛异常，所以要显式退到可读状态
    if (!S || !S.hasGsap) fallback('没有 GSAP');
    startAtTop();
    focusLadder();
    heroIntro();
    rowIntro();
    aboutIntro();
    aboutHead();
    pillRoll();
    if (S) { S.revealAll(); S.navInvert(); }
    landOnHash();
    later(() => { blueprint(); interludeAlign(); });
  } catch (err) {
    fallback(err);
  }
})();
