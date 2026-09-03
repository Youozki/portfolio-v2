/* 全站共用：平滑滚动、入场、导航行为。
   有意写成 UMD 全局脚本，这样 file:// 直接双击 index.html 也能跑。 */
(() => {
  'use strict';

  const html = document.documentElement;
  html.classList.add('js');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---- Lenis：唯一的滚动权威，ScrollTrigger 挂在它后面 ---------------- */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.1,            // 惯性时长，越大越"重"
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
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
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 });
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
     参数来自 mandandan.cn 的实测：它的 journey-screen-reveal 是
     opacity .08→1 / blur(4px)→0 / translateY 82px→0 / scale .955→1，
     缓动 cubic-bezier(0.22,1,0.36,1)，时长 0.72–0.92s。
     模糊+缩放一起给，比单纯位移"贵"很多，这是它高级感的主要来源。 */
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
        y: '0%', duration: 1.15, ease: 'expo.out',
        scrollTrigger: { trigger: clip, start: 'top 90%', once: true },
      });
    });

    items.forEach((el) => {
      const mode = el.dataset.reveal;
      const delay = parseFloat(el.dataset.revealDelay || '0');
      gsap.fromTo(el,
        { opacity: 0.08, y: mode === 'soft' ? 34 : 68, scale: 0.972, filter: 'blur(4px)' },
        {
          opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
          duration: 0.92, delay, ease: 'reveal', overwrite: 'auto',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
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

  /* ---- 导航：向下滚收起，向上滚出现 ---------------------------------- */
  function navBehaviour() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 160 && y > last + 6) nav.classList.add('is-hidden');
      else if (y < last - 6 || y <= 160) nav.classList.remove('is-hidden');
      last = y;
    };
    if (lenis) lenis.on('scroll', onScroll);
    else addEventListener('scroll', onScroll, { passive: true });
  }

  window.SITE = { lenis, reduced, hasGsap, scrollTo, revealAll, navBehaviour, navInvert, marquee, EASE_REVEAL };
})();

