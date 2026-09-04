/* 全站共用：平滑滚动、入场、导航行为。
   有意写成 UMD 全局脚本，这样 file:// 直接双击 index.html 也能跑。 */
(() => {
  'use strict';

  const html = document.documentElement;
  html.classList.add('js');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---- Lenis：唯一的滚动权威，ScrollTrigger 挂在它后面 ----------------
     用 lerp 而不是 duration。duration 模式是「每次滚轮事件都跑一条固定时长的
     补间」，1.1s 的曲线堆起来就是明显的拖尾和不跟手；lerp 是每帧朝目标插值，
     响应立刻开始，只在尾巴上收得软。0.12 ≈ 120ms 内走完 ~63%，跟手且不生硬。 */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      lerp: 0.12,
      wheelMultiplier: 1,
      smoothWheel: true,
      touchMultiplier: 1.6,
      syncTouch: false,          // 触屏交回系统，原生滚动比模拟的跟手
    });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  const scrollTo = (target) => {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 0.9 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  /* 站内锚点交给 Lenis，避免原生跳转和惯性打架 */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    scrollTo(el);
  });

  /* ---- 入场 -----------------------------------------------------------
     参数原型来自 mandandan.cn（opacity .08→1 / blur(4px)→0 / y / scale，
     缓动 cubic-bezier(0.22,1,0.36,1)），但时长按反馈砍短了：原来 0.92s 起手
     太晚、收得太慢，滚到文字跟前模糊还没散。现在 0.5s 并且提前到 top 97%
     触发，等视线落上去就已经清楚了。 */
  const EASE_REVEAL = 'cubic-bezier(0.22, 1, 0.36, 1)';

  function revealAll() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!hasGsap || reduced) {
      items.forEach((el) => {
        el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none';
      });
      document.querySelectorAll('.line-inner').forEach((el) => { el.style.transform = 'none'; });
      return;
    }
    if (window.CustomEase && !gsap.parseEase('reveal')) {
      gsap.registerPlugin(CustomEase);
      CustomEase.create('reveal', '0.22, 1, 0.36, 1');
    }

    gsap.utils.toArray('.line-clip').forEach((clip) => {
      const inner = clip.querySelector('.line-inner');
      if (!inner) return;
      gsap.to(inner, {
        y: '0%', duration: 0.7, ease: 'expo.out',
        scrollTrigger: { trigger: clip, start: 'top 95%', once: true },
      });
    });

    items.forEach((el) => {
      const mode = el.dataset.reveal;
      const delay = parseFloat(el.dataset.revealDelay || '0');
      gsap.fromTo(el,
        { opacity: 0.08, y: mode === 'soft' ? 24 : 44, scale: 0.984, filter: 'blur(3px)' },
        {
          opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
          duration: 0.5, delay: delay * 0.6, ease: 'reveal', overwrite: 'auto',
          scrollTrigger: { trigger: el, start: 'top 97%', once: true },
        });
    });
  }

  /* ---- 导航随身下色带反色（augen 的做法：切 class，不是改内联样式） ---- */
  function navInvert() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const bands = [...document.querySelectorAll('.band')];
    if (!bands.length) return;
    const probeY = () => nav.getBoundingClientRect().bottom - 8;
    const apply = () => {
      const y = probeY();
      let cur = null;
      for (const b of bands) {
        const r = b.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) cur = b;
      }
      const dark = cur && (cur.classList.contains('band--ink') || cur.classList.contains('band--accent'));
      nav.classList.toggle('is-inverted', !!dark);
    };
    if (lenis) lenis.on('scroll', apply);
    else addEventListener('scroll', apply, { passive: true });
    addEventListener('resize', apply);
    apply();
  }

  /* ---- 无限漂移带：两条不同速度，做出层次（mandandan 用 46s / 58s） ---- */
  function marquee(el) {
    if (!el || reduced) return;
    const row = el.querySelector('.drift__row');
    if (!row) return;
    row.innerHTML = row.innerHTML + row.innerHTML;   // 复制一份才能无缝首尾相接
  }

  /* ---- 换页过渡 + 导航形变 --------------------------------------------
     augen 的做法：胶囊自己伸长/缩短，导航文字一条条从下往上滚进来，
     旧的那批则往上滚出去。跨页是真实的文档加载，所以拆成两半来演：
     离场——文字逐条上滚出去 + 胶囊收到只剩图标的宽度；
     进场——胶囊从图标宽度伸到自然宽度，文字再逐条从下滚上来。
     两半首尾相接，看起来就是一个连续动作。
     胶囊宽度得先量：先让它 auto 布局拿到自然宽，再从窄的一端补起来。 */
  /* ---- 导航文字滚动 ---------------------------------------------------
     跨页的位移与胶囊伸缩已经交给 View Transition（见 base.css），这里只负责
     文字：新页面的标签逐条从下往上滚进来。旧标签不用管——浏览器的旧快照会
     自己淡出，再手动做一遍离场就是两套动画打架，也正是之前卡顿的来源。
     不支持 View Transition 的浏览器退化成"只滚文字"，不做胶囊裁切：
     宁可少一个效果，也不要一个会闪的效果。 */
  const NAV_STEP = 0.055;
  const hasVT = typeof document.startViewTransition === 'function';

  function navEnter() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const texts = [...nav.querySelectorAll('.nav__text')];
    if (reduced || !hasGsap || !texts.length) { nav.classList.add('is-ready'); return; }

    nav.classList.add('is-ready');
    gsap.set(texts, { yPercent: 110 });
    gsap.to(texts, {
      yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: NAV_STEP,
      // View Transition 期间不要抢帧：等浏览器把快照过渡跑完再滚文字
      delay: hasVT ? 0.34 : 0.12,
    });
  }

  /* 站内跳转不再拦截——拦下来手动淡出再 location.href 就是"整页刷新 + 导航
     跳一帧"的直接原因。原生跨文档过渡由 @view-transition 接管。
     唯一要做的是离开项目页时把返回箭头滚回站点标记，让前后两页的图标对得上。 */
  function navHandoff() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) return;
      const home = document.getElementById('navHome');
      if (home) home.classList.remove('is-back');
    });
  }

  /* 项目页：进场后把顶栏图标向上滚一格，换成返回箭头。
     延迟 420ms 是等换页渐显走完，让人看得见"换"这个动作。 */
  function navGlyph() {
    const home = document.getElementById('navHome');
    if (!home || !document.body.classList.contains('is-case')) return;
    if (reduced) { home.classList.add('is-back'); return; }
    setTimeout(() => home.classList.add('is-back'), 420);
  }

  navEnter();
  navHandoff();
  navGlyph();

  window.SITE = { lenis, reduced, hasGsap, scrollTo, revealAll, navInvert, marquee, EASE_REVEAL };
})();

