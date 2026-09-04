/* Companion 项目页：四幕滚动叙事。
   钉住段落只在 768px 以上启用，移动端由 CSS 摊平成纵向直读，
   所以这里统一用 gsap.matchMedia 收口，避免手动加/删 ScrollTrigger。 */
(() => {
  'use strict';

  const S = window.SITE || {};
  const { hasGsap, reduced } = S;

  S.revealAll && S.revealAll();
  S.navInvert && S.navInvert();

  /* ---- 顶部进度：整页阅读进度，ease:none 才跟手 ----------------------- */
  const bar = document.querySelector('#progress > span');
  if (bar && hasGsap && !reduced) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.25 },
    });
  }

  /* ---- 导航当前章 ------------------------------------------------------ */
  if (hasGsap) {
    const links = [...document.querySelectorAll('.nav__link')];
    links.forEach((a) => {
      const sec = document.querySelector(a.getAttribute('href'));
      if (!sec) return;
      const set = (on) => { if (on) links.forEach((l) => l.removeAttribute('aria-current')); if (on) a.setAttribute('aria-current', 'true'); };
      ScrollTrigger.create({
        trigger: sec, start: 'top 45%', end: 'bottom 45%',
        onToggle: (self) => set(self.isActive),
      });
    });
  }

  if (!hasGsap || reduced) return;

  const mm = gsap.matchMedia();

  mm.add('(min-width: 768px)', () => {
    /* ---- 幕一 · 舞台：镜片缓推近，两句话依次接管 ---------------------- */
    const stage = document.getElementById('scene');
    if (stage) {
      const bg = stage.querySelector('.stage__bg');
      const [l1, l2] = stage.querySelectorAll('.stage__line');
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: stage, start: 'top top', end: 'bottom bottom', scrub: 0.25 },
      });
      // 背景只做很小的推近，1.0→1.12，多了就显廉价
      tl.fromTo(bg, { scale: 1, yPercent: 0 }, { scale: 1.12, yPercent: -4, duration: 1 }, 0);

      // 两句话：进—停—退。最后一句不退，留在屏上交给下一段
      const line = (el, out) => {
        const t = gsap.timeline()
          .fromTo(el,
            { opacity: 0, y: 46, filter: 'blur(6px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.16, ease: 'reveal' })
          .to(el, { duration: 0.2 });
        if (out) t.to(el, { opacity: 0, y: -34, filter: 'blur(6px)', duration: 0.12, ease: 'power2.in' });
        return t;
      };

      if (l1) tl.add(line(l1, true), 0.06);
      if (l2) tl.add(line(l2, false), 0.5);
    }

    /* ---- 招牌二 · 六屏接管同一个位置 ---------------------------------- */
    const deck = document.getElementById('tcDeck');
    if (deck) {
      const cards = gsap.utils.toArray('.deck__card', deck);
      const idx = gsap.utils.toArray('.deck__idx', deck);
      const step = 1 / Math.max(1, cards.length - 1);

      gsap.set(cards.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(cards[0], { clipPath: 'inset(0% 0% 0% 0%)' });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: deck, start: 'top top', end: 'bottom bottom',
          scrub: 0.25,
          onUpdate: (self) => {
            const on = Math.round(self.progress * (cards.length - 1));
            idx.forEach((li, i) => li.classList.toggle('is-on', i === on));
          },
        },
      });

      // 后一张从下方裁进来接管，前一张原地不动——错位缩放会露出双重边框，反而脏
      cards.forEach((card, i) => {
        if (i === 0) return;
        const at = (i - 1) * step;
        tl.to(card, { clipPath: 'inset(0% 0% 0% 0%)', duration: step * 0.86 }, at)
          .fromTo(card, { y: 28 }, { y: 0, duration: step * 0.86 }, at)
          .to(cards[i - 1], { opacity: 0.55, duration: step * 0.86 }, at);
      });
      idx[0] && idx[0].classList.add('is-on');
    }

    // gsap.matchMedia 会在断点失配时自动回滚上面创建的所有动画与 ScrollTrigger
  });


  /* ---- 推演线上的光点：沿轨道跑一遍，三列依次点亮 ----------------------
     只在这一段出现（整页进度条是另一条细横条）。轨道左右各留 8%，
     所以光点的行程也按 84% 算，末端正好停在最后一个节点上。 */
  function stackSpark() {
    if (!hasGsap || reduced) return;
    const stack = document.getElementById('stack');
    const rail = stack && stack.querySelector('.stack__rail');
    const spark = stack && stack.querySelector('.stack__spark');
    if (!rail || !spark) return;
    const nodes = gsap.utils.toArray('.stack__node', stack);

    gsap.timeline({ scrollTrigger: { trigger: stack, start: 'top 78%', once: true } })
      .fromTo(spark, { x: 0, opacity: 0 },
        { x: () => rail.clientWidth * 0.84, opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0)
      .to(spark, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.35)
      .fromTo(nodes, { opacity: 0.3, y: 10 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out', stagger: 0.42 }, 0.15);
  }

  stackSpark();

  ScrollTrigger.refresh();
})();
