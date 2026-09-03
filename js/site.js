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

  /* ---- 入场：只动 transform 和 opacity ------------------------------- */
  function revealAll() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!hasGsap || reduced) {
      items.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
      document.querySelectorAll('.line-inner').forEach((el) => { el.style.transform = 'none'; });
      return;
    }

    // 标题按行上推：行容器 clip，内层从 105% 推上来
    gsap.utils.toArray('.line-clip').forEach((clip) => {
      const inner = clip.querySelector('.line-inner');
      if (!inner) return;
      gsap.to(inner, {
        y: '0%',
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: { trigger: clip, start: 'top 88%', once: true },
      });
    });

    items.forEach((el) => {
      const mode = el.dataset.reveal;
      const delay = parseFloat(el.dataset.revealDelay || '0');
      gsap.to(el, {
        opacity: 1,
        y: mode === 'up' ? 0 : undefined,
        duration: 0.9,
        delay,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
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

  window.SITE = { lenis, reduced, hasGsap, scrollTo, revealAll, navBehaviour };
})();

