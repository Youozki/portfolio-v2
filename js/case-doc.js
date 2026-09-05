/* 第一版画布的缩放与画布内交互。
   画布是 1920px 宽的坐标定位版式，这里只做「等比缩放到视口宽」这一件事，
   外加画布自带的两种交互（横向滚动条、素材图墙）。不改任何坐标。 */
(() => {
  'use strict';

  const CASE_W = 1920;
  const wraps = [...document.querySelectorAll('.case-doc-wrap')];
  if (!wraps.length) return;

  /* 每段的画布高度写在 data-span 上（该段元素实际占的高度）。
     画布整体被缩放过，外层要按 span × 缩放系数取高，否则滚动长度会多出
     （或少掉）一大段空白。 */
  function fit() {
    let scale = 1;
    wraps.forEach((wrap) => {
      const doc = wrap.querySelector('.case-doc');
      const span = parseFloat(wrap.dataset.span) || 0;
      scale = wrap.clientWidth / CASE_W;
      doc.style.setProperty('--cs', scale.toFixed(6));
      doc.style.height = span + 'px';
      wrap.style.setProperty('--doc-h', (span * scale).toFixed(2) + 'px');
    });
    return scale;
  }

  let scale = fit();
  addEventListener('resize', () => {
    scale = fit();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  /* 横向滚动图：设计稿里图下方那根蓝条就是可视滚动条，滑块宽度按可视/总宽比例，可直接拖 */
  function initHScroll(root) {
    root.querySelectorAll('[data-hscroll]').forEach((view) => {
      const bar = root.querySelector('[data-hscroll-bar="' + view.getAttribute('data-hscroll') + '"]');
      const thumb = bar && bar.querySelector('.hscroll__thumb');
      if (!thumb) return;
      let thumbW = 0;
      const sync = () => {
        if (!view.clientWidth || !view.scrollWidth || !bar.clientWidth) return;
        const max = view.scrollWidth - view.clientWidth;
        thumbW = Math.max(bar.clientWidth * (view.clientWidth / view.scrollWidth), 12);
        thumb.style.width = thumbW.toFixed(2) + 'px';
        const p = max > 0 ? view.scrollLeft / max : 0;
        thumb.style.transform = 'translateX(' + (p * (bar.clientWidth - thumbW)).toFixed(2) + 'px)';
      };
      view.addEventListener('scroll', sync);
      addEventListener('resize', sync);
      if (window.ResizeObserver) new ResizeObserver(sync).observe(view);
      thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const x0 = e.clientX;
        const from = view.scrollLeft;
        const max = view.scrollWidth - view.clientWidth;
        const span = bar.clientWidth - thumbW;
        thumb.classList.add('is-drag');
        // 画布整体被 scale 过，指针位移要先除掉缩放系数才是画布上的距离
        const move = (ev) => {
          if (span <= 0) return;
          view.scrollLeft = from + ((ev.clientX - x0) / (scale || 1) / span) * max;
        };
        const up = () => {
          thumb.classList.remove('is-drag');
          removeEventListener('pointermove', move);
          removeEventListener('pointerup', up);
        };
        addEventListener('pointermove', move);
        addEventListener('pointerup', up);
      });
      sync();
    });
  }

  /* 素材图墙：整条复制一份，位移到一半归零，所以看不出接缝 */
  function initMarquee(root) {
    if (window.SITE && window.SITE.reduced) return;
    root.querySelectorAll('.marquee').forEach((box) => {
      const track = box.querySelector('.marquee__track');
      if (!track) return;
      const speed = Number(box.getAttribute('data-marquee-speed')) || 45;
      track.innerHTML += track.innerHTML;
      const half = track.scrollWidth / 2;
      if (!half) return;
      track.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -half + 'px)' }],
        { duration: (half / speed) * 1000, iterations: Infinity, easing: 'linear' }
      );
    });
  }

  initHScroll(document);
  initMarquee(document);

  /* 顶栏压到蓝底（band--accent）或黑底（band--ink）上时整体反白。
     site.js 里就有这套判定，只是画布页一直没调用——所以内页头那一段蓝底上
     章节名还是深色，几乎读不出来。 */
  if (window.SITE && window.SITE.navInvert) window.SITE.navInvert();

  /* ---- 画布内的入场与视差 ----------------------------------------------
     画布是坐标定位的，不能改 top/left，所以动效只走 transform 与 opacity。
     入场用 IntersectionObserver（不是滚动事件），进视口一次就点亮；
     视差只给尺寸够大的图，幅度 10px——实测参考站就是这个量级。 */
  const reduced = !!(window.SITE && window.SITE.reduced)
    || matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slices = [...document.querySelectorAll('.case-slice')];
  if (slices.length && !reduced) {
    const PX = 10;
    const pxItems = [];

    slices.forEach((slice) => {
      [...slice.children].forEach((el) => {
        if (el.classList.contains('doc-anchor')) return;
        el.setAttribute('data-doc-reveal', '');
        // 够大的图才做视差，小图跟着动会显得抖
        const img = el.matches('img') ? el : el.querySelector('img');
        if (img) {
          const w = parseFloat(img.style.width) || 0;
          if (w >= 600) {
            img.setAttribute('data-doc-px', '');
            pxItems.push(img);
          }
        }
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    slices.forEach((s) => [...s.children].forEach((el) => {
      if (el.hasAttribute('data-doc-reveal')) io.observe(el);
    }));

    // 视差：一帧读一次位置，只写 CSS 变量，合成线程自己跑
    let ticking = false;
    const tick = () => {
      ticking = false;
      const vh = innerHeight;
      pxItems.forEach((img) => {
        const r = img.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        // 元素中心从屏底走到屏顶，位移从 +PX 走到 −PX
        const p = (r.top + r.height / 2) / vh;
        img.style.setProperty('--pz', ((0.5 - p) * 2 * PX).toFixed(2) + 'px');
      });
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(tick);
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    tick();
  }

  /* 图片陆续解码完会改变布局判断，等图齐了再刷一次 ScrollTrigger */
  addEventListener('load', () => {
    fit();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
})();
