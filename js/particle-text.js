/* 粒子文字。做法照 mandandan.cn 的实现（我把它的 bundle 拉下来读过）：
   离屏 canvas 按元素自己的 computed font 画一遍字 → getImageData 按步长取样 →
   alpha 过阈值的像素各成一个粒子 → 每帧弹簧回位 + 指针半径内斥力 → fillRect 画方点。

   几个不能省的细节：
   - 取样步长与字号成比例（不是定值），否则大字稀、小字糊成一团。
   - 入场按 atan2(粒子, 画面中心) 向外散开，纵向乘 0.6——散成横向的一片而不是一个圆。
   - 全部落位后必须停掉 rAF，否则一直空转烧电。
   - 原文字留在 DOM 里（视觉隐藏但读屏能读到），canvas 只是它的一层皮；
     没有 canvas、prefers-reduced-motion、或元素还没进视口时都退回纯文字。

   用法：<span class="pt" data-pt>要拆的这句话</span>，然后 window.PT.init()。 */
(() => {
  'use strict';

  // 步长决定颗粒粗细。mandandan 在大字上用的是 max(3, 字号×0.055)，
  // 但我们这句只有 h1 档（38px），沿用 3 会粗成像素字体，反而抢内容。
  // 压到 2 之后颗粒数约翻倍，读起来是"字在聚拢"而不是"字变成了马赛克"。
  const STRIDE_MIN = 2;          // 最小取样步长（px）
  const STRIDE_RATIO = 0.05;     // 步长 = 字号 × 这个比例
  const DOT_RATIO = 0.72;        // 方点边长 = 步长 × 这个比例
  const ALPHA = 128;             // 取样阈值
  const STIFF = 0.014;           // 弹簧刚度
  const DAMP = 0.86;             // 阻尼
  const PTR_R = 90;              // 指针影响半径
  const PTR_F = 0.9;             // 指针斥力
  const SCATTER_MIN = 90;
  const SCATTER_RANGE = 190;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build(el) {
    const text = el.dataset.ptText || el.textContent.trim();
    if (!text) return null;

    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize) || 32;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / 1 ${cs.fontFamily}`;
    const tints = (cs.getPropertyValue('--pt-tints') || cs.color)
      .split(',').map((s) => s.trim()).filter(Boolean);

    const stride = Math.max(STRIDE_MIN, size * STRIDE_RATIO);
    const dot = stride * DOT_RATIO;

    // 先量一次文字实际占多大，canvas 按它开
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    if ('letterSpacing' in probe && cs.letterSpacing !== 'normal') probe.letterSpacing = cs.letterSpacing;
    const w = Math.ceil(probe.measureText(text).width) + 4;
    const h = Math.ceil(size * 1.35);

    const off = document.createElement('canvas');
    off.width = Math.max(1, w);
    off.height = Math.max(1, h);
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.font = font;
    if ('letterSpacing' in octx && cs.letterSpacing !== 'normal') octx.letterSpacing = cs.letterSpacing;
    octx.textBaseline = 'middle';
    octx.textAlign = 'left';
    octx.fillStyle = '#fff';
    octx.fillText(text, 2, h / 2);

    const { data } = octx.getImageData(0, 0, off.width, off.height);
    const parts = [];
    for (let y = 0; y < off.height; y += stride) {
      const row = Math.floor(y) * off.width;
      for (let x = 0; x < off.width; x += stride) {
        if (data[(row + Math.floor(x)) * 4 + 3] < ALPHA) continue;
        parts.push({
          tx: x, ty: y, x, y, vx: 0, vy: 0,
          tint: tints[(Math.floor(x) + Math.floor(y)) % tints.length],
        });
      }
    }
    return { parts, dot, w: off.width, h: off.height };
  }

  function scatter(p, w, h) {
    const a = Math.atan2(p.ty - h / 2, p.tx - w / 2);
    const d = SCATTER_MIN + Math.random() * SCATTER_RANGE;
    p.x = p.tx + Math.cos(a) * d + (Math.random() - 0.5) * 60;
    p.y = p.ty + Math.sin(a) * d * 0.6 + (Math.random() - 0.5) * 40;
    p.vx = 0; p.vy = 0;
  }

  function mount(el) {
    if (el.dataset.ptReady) return;
    el.dataset.ptReady = '1';

    // 原文字包一层留在 DOM 里，canvas 只是皮
    const raw = el.textContent;
    el.dataset.ptText = raw.trim();
    el.innerHTML = `<span class="pt__text">${raw}</span>`;

    if (reduced || !document.createElement('canvas').getContext) {
      el.classList.add('is-off');
      return;
    }

    const built = build(el);
    if (!built || !built.parts.length) { el.classList.add('is-off'); return; }

    /* canvas 宽度是按文字实测出来的，不会自己换行。窄屏上这句会顶出版心
       （320px 视口实测溢出到 409px），所以容器装不下就整段退回纯文字——
       粒子是锦上添花，横向滚动条不是。 */
    const room = (el.parentElement || el).clientWidth;
    if (room && built.w > room) { el.classList.add('is-off'); return; }

    const cv = document.createElement('canvas');
    el.insertBefore(cv, el.firstChild);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.ceil(built.w * dpr);
    cv.height = Math.ceil(built.h * dpr);
    cv.style.width = built.w + 'px';
    cv.style.height = built.h + 'px';
    el.style.height = built.h + 'px';

    const ptr = { x: -9999, y: -9999 };
    let raf = 0, started = false;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, built.w, built.h);
      for (const p of built.parts) {
        ctx.fillStyle = p.tint;
        ctx.fillRect(p.x, p.y, built.dot, built.dot);
      }
    };

    const step = () => {
      let moving = false;
      for (const p of built.parts) {
        p.vx += (p.tx - p.x) * STIFF;
        p.vy += (p.ty - p.y) * STIFF;
        const dx = p.x - ptr.x, dy = p.y - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < PTR_R * PTR_R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / PTR_R) * PTR_F;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        p.vx *= DAMP; p.vy *= DAMP;
        p.x += p.vx; p.y += p.vy;
        if (!moving && (Math.abs(p.vx) > 0.02 || Math.abs(p.vy) > 0.02
          || Math.abs(p.tx - p.x) > 0.4 || Math.abs(p.ty - p.y) > 0.4)) moving = true;
      }
      draw();
      // 落位后停下来，不空转
      raf = moving ? requestAnimationFrame(step) : 0;
    };

    const kick = () => {
      if (started) return;
      started = true;
      built.parts.forEach((p) => scatter(p, built.w, built.h));
      if (!raf) raf = requestAnimationFrame(step);
    };

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      el.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect();
        ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
        if (!raf) raf = requestAnimationFrame(step);
      });
      el.addEventListener('pointerleave', () => { ptr.x = -9999; ptr.y = -9999; });
    }

    if (typeof IntersectionObserver === 'undefined') { kick(); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      kick(); io.disconnect();
    }, { rootMargin: '0px 0px -12%' });
    io.observe(el);
  }

  const init = (root) => (root || document).querySelectorAll('[data-pt]').forEach(mount);
  window.PT = { init };
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', () => init());
})();
