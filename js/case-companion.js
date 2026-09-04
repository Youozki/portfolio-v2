/* Companion 项目页：四幕滚动叙事。
   钉住段落只在 768px 以上启用，移动端由 CSS 摊平成纵向直读，
   所以这里统一用 gsap.matchMedia 收口，避免手动加/删 ScrollTrigger。 */
(() => {
  'use strict';

  const S = window.SITE || {};
  const { hasGsap, reduced } = S;

  S.revealAll && S.revealAll();
  S.navBehaviour && S.navBehaviour();
  S.navInvert && S.navInvert();

  /* ---- 顶部进度：整页阅读进度，ease:none 才跟手 ----------------------- */
  const bar = document.querySelector('#progress > span');
  if (bar && hasGsap && !reduced) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.25 },
    });
  } else if (bar) {
    bar.style.transform = 'scaleX(0)';
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
        scrollTrigger: { trigger: stage, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
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

    /* ---- 招牌一 · 四种情绪横向铺开，滚动即横移 ------------------------ */
    const strip = document.getElementById('emotionStrip');
    if (strip) {
      const track = strip.querySelector('.hstrip__track');
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 64);
      gsap.fromTo(track, { x: 0 }, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: strip, start: 'top top', end: 'bottom bottom',
          scrub: 0.55, invalidateOnRefresh: true,
        },
      });
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
          scrub: 0.5,
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

  /* ---- 转轴实验台 ------------------------------------------------------
     屏幕组绕铰链点 (300,354) 旋转。画出来的姿态就是 120° 开合角，所以旋转量
     = 目标角 − 120。空闲时做极缓的呼吸和眨眼，一上手立刻交出控制权，松手后
     回到呼吸——顺不顺的关键是这三段互不打断，位置全部走 quickTo。 */
  function hingeLab() {
    const stage = document.getElementById('labStage');
    const screen = document.getElementById('labScreen');
    const eyes = document.getElementById('labEyes');
    const arc = document.getElementById('labArc');
    const out = document.getElementById('labAngle');
    if (!stage || !screen) return;

    const HX = 400, HY = 300;
    const DRAWN = 90;                       // SVG 里画出来的姿态就是 90° 直立
    const BASE = 112, MIN = 95, MAX = 150;  // 静止停在 112°，也是呼吸的中心
    let angle = BASE;

    // 角度弧：从键盘方向（+x）逆时针量到屏幕方向
    const arcPath = (deg) => {
      const r = 74, a = deg * Math.PI / 180;
      const x2 = HX + r * Math.cos(a), y2 = HY - r * Math.sin(a);
      return `M${HX + r} ${HY}A${r} ${r} 0 0 0 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };

    if (arc) arc.setAttribute('d', arcPath(BASE));
    if (!hasGsap || reduced) return;

    // 开合角变大 = 屏幕往后倒 = 屏幕上沿朝左，也就是逆时针，所以旋转量取负
    const rotTo = gsap.quickTo(screen, 'rotation', {
      duration: 0.55, ease: 'power3.out', svgOrigin: HX + ' ' + HY,
    });
    const eyeX = gsap.quickTo(eyes, 'x', { duration: 0.7, ease: 'power3.out' });
    const eyeY = gsap.quickTo(eyes, 'y', { duration: 0.7, ease: 'power3.out' });

    const render = (deg) => {
      angle = gsap.utils.clamp(MIN, MAX, deg);
      rotTo(-(angle - DRAWN));
      if (arc) arc.setAttribute('d', arcPath(angle));
      if (out) out.textContent = String(Math.round(angle));
      stage.setAttribute('aria-valuenow', String(Math.round(angle)));
    };
    render(BASE);

    let drag = false, startX = 0, startAngle = BASE;

    /* 空闲呼吸：±2.5° 的极缓摆动，拖动时暂停 */
    const idle = gsap.to({ v: 0 }, {
      v: 1, duration: 5.4, ease: 'sine.inOut', repeat: -1, yoyo: true,
      onUpdate() { if (!drag) render(BASE + (this.targets()[0].v - 0.5) * 5); },
    });

    /* 眨眼：两只眼睛各自绕自身中心压扁再弹回，间隔按次数递变，不用随机数。
       缩放放在 rect 上而不是外层 group——外层要留给"视线跟随"的位移，
       两者共用一个元素会互相干扰变换原点。 */
    let blinks = 0;
    const blink = () => {
      blinks += 1;
      gsap.timeline({ onComplete: () => gsap.delayedCall(3.2 + (blinks % 4), blink) })
        .to(eyes.children, {
          scaleY: 0.12, duration: 0.09, ease: 'power2.in', transformOrigin: '50% 50%',
        })
        .to(eyes.children, { scaleY: 1, duration: 0.26, ease: 'back.out(2.4)' });
    };
    gsap.delayedCall(2.4, blink);

    /* 拖动：横向位移直接映射到角度，纵向留给页面滚动 */
    const span = () => Math.max(240, stage.getBoundingClientRect().width * 0.7);

    stage.addEventListener('pointerdown', (e) => {
      drag = true; startX = e.clientX; startAngle = angle;
      idle.pause();
      stage.classList.add('is-dragging');
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      // 视线跟随指针：不拖动时也生效，这是这一段想说明的"跟随"
      eyeX(((e.clientX - r.left) / r.width - 0.5) * 26);
      eyeY(((e.clientY - r.top) / r.height - 0.5) * 14);
      if (!drag) return;
      render(startAngle + (e.clientX - startX) / span() * (MAX - MIN));
    });
    const release = () => {
      if (!drag) return;
      drag = false;
      stage.classList.remove('is-dragging');
      // 从当前角度平滑接回呼吸，而不是跳回 120
      gsap.to({ v: angle }, {
        v: BASE, duration: 1.1, ease: 'power2.inOut',
        onUpdate() { render(this.targets()[0].v); },
        onComplete: () => idle.play(),
      });
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('pointerleave', () => { eyeX(0); eyeY(0); });

    /* 键盘：左右方向键各 5°，Home 回到 120° */
    stage.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home') return;
      e.preventDefault();
      idle.pause();
      render(k === 'Home' ? BASE : angle + (k === 'ArrowRight' ? 5 : -5));
    });

    /* 进入视口时先自己开一次，告诉用户这里是能动的 */
    ScrollTrigger.create({
      trigger: stage, start: 'top 75%', once: true,
      onEnter() {
        idle.pause();
        gsap.to({ v: 99 }, {
          v: 144, duration: 1.5, ease: 'expo.out', delay: 0.2,
          onUpdate() { render(this.targets()[0].v); },
          onComplete() {
            gsap.to({ v: 144 }, {
              v: BASE, duration: 0.9, ease: 'power2.inOut',
              onUpdate() { render(this.targets()[0].v); },
              onComplete: () => idle.play(),
            });
          },
        });
      },
    });
  }

  /* ---- 重画的线框图：进入视口时把笔画画出来 ----------------------------
     rect 也是 SVGGeometryElement，getTotalLength() 能直接拿周长，所以不用
     手工换算。填充块单独淡入，晚一点进，先看清结构再看到面。 */
  function drawWire() {
    if (!hasGsap || reduced) return;
    gsap.utils.toArray('.wire').forEach((svg) => {
      const strokes = [...svg.querySelectorAll('rect, path')]
        .filter((el) => !el.classList.contains('wire__fill'));
      const fills = svg.querySelectorAll('.wire__fill');

      strokes.forEach((el) => {
        const len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
        if (len) gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      });
      gsap.set(fills, { opacity: 0 });

      gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 85%', once: true } })
        .to(strokes, {
          strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.05,
        }, 0)
        .to(fills, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.04 }, 0.45);
    });
  }

  drawWire();
  hingeLab();

  ScrollTrigger.refresh();
})();
