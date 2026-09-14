/* 内页手机版式（case-justpaper / case-oreate / case-terabox / case-companion）。
   桌面不动：仍是 1920 坐标画布 + transform: scale。手机上（≤767px）把画布拆成流式一列，
   并把 .case-doc-wrap 整棵删掉——同一份内容不会在内存里存两遍，放大时也不再有
   "整幅设计稿 × 缩放²" 的栅格化（iOS 捏合崩溃的根因，见 feedback_canvas_raster_zoom）。

   三条绝不变形的渲染规则（关键：任何 <img> 要么只定一个维度，要么整块等比缩放）：
   1) 大截图（画布宽 ≥ 600）：整幅铺满一列，width:100% / height:auto，比例由素材自身决定；
   2) 小拼贴 / 图标组 / 底板（画布宽 < 600 的组）：保留画布坐标，整块 transform:scale 到列宽，
      和电脑端逐像素一致，uniform scale 数学上不可能变形；
   3) 横向组件（hscroll / marquee / 超宽单图，比例 > 3.2）：定高横向滑动 + 蓝色滚动条。

   本文件必须排在 js/case-doc.js 之前：它在 <html> 上挂 is-doc-mobile，
   case-doc.js 看到就整体让路（画布缩放、裁段、按行入场全不跑）。 */
(() => {
  'use strict';

  const wraps = [...document.querySelectorAll('.case-doc-wrap')];
  if (!wraps.length) return;
  if (!matchMedia('(max-width: 767px)').matches) return;

  const root = document.documentElement;
  root.classList.add('is-doc-mobile');
  const num = (v) => parseFloat(v) || 0;

  /* ---- 1) 把画布块读成一张表，按设计稿的 y 排序 ---- */
  const blocks = [];
  wraps.forEach((wrap) => {
    wrap.querySelectorAll('.case-slice > *').forEach((el) => {
      const st = el.style;
      const top = num(st.top);
      const left = num(st.left);
      const w = num(st.width);
      const h = num(st.height) || num(st.minHeight);
      const fs = num(st.fontSize);
      const text = (el.textContent || '').trim();
      const hasImg = el.tagName === 'IMG' || !!el.querySelector('img');
      let kind;
      if (el.classList.contains('doc-anchor')) kind = 'anchor';
      else if (hasImg) kind = 'art';
      else if (fs >= 14 && text) kind = 'text';
      else kind = 'art'; // 纯色底板、分割线这类装饰件跟着图走
      blocks.push({ el, top, left, w, h, fs, kind, text, hasImg, right: left + w, bottom: top + h });
    });
  });
  blocks.sort((a, b) => a.top - b.top || a.left - b.left);

  /* ---- 2) 分组 ----
     判据（对齐用户要求"都和电脑端一样，不拆图，最多并排改上下"）：
     - 大图（画布宽/高 ≥ 340）各自成块，按 y 依次堆叠——并排的两大块自然变成上下排；
     - 小图（logo 墙 / 图标组）与它们的窄标注，按空间邻近用并查集聚成一"簇"，
       整簇保留电脑端相对坐标、整体等比缩放，绝不拆成一行一个；
     - 正文段落（宽文本）、章节头、锚点、marquee、hscroll 各自单独处理；
     - 纯装饰底板（无图）直接丢弃，避免出现空白灰框。 */
  const GAP = 72;
  const hasMarquee = (b) => b.el.matches('.marquee') || !!b.el.querySelector('.marquee__track');
  const hasHScroll = (b) => b.el.matches('[data-hscroll]') || !!b.el.querySelector('.hscroll__view');
  const isBigArt = (b) => b.hasImg && (b.w >= 340 || b.h >= 340);
  const isWideText = (b) => b.kind === 'text' && b.w >= 520;
  const isHead = (b) => !!(b.el.classList && b.el.classList.contains('doc-ch'));
  const isSpecial = (b) => hasMarquee(b) || hasHScroll(b);
  // 可聚簇的候选：小图、窄标注、无图小装饰件
  const eligible = blocks.filter((b) => b.kind !== 'anchor' && !isHead(b)
      && !isWideText(b) && !isBigArt(b) && !isSpecial(b));
  const parent = new Map();
  eligible.forEach((b) => parent.set(b, b));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i], c = eligible[j];
      if (a.left < c.right + GAP && a.right > c.left - GAP
          && a.top < c.bottom + GAP && a.bottom > c.top - GAP) parent.set(find(a), find(c));
    }
  }
  const comp = new Map();
  eligible.forEach((b) => { const r = find(b); (comp.get(r) || comp.set(r, []).get(r)).push(b); });
  const bboxOf = (mem) => mem.reduce((a, b) => ({
    top: Math.min(a.top, b.top), left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
  }), { top: 1e9, left: 1e9, right: -1e9, bottom: -1e9 });

  const emitted = new Set();
  const groups = [];
  blocks.forEach((b) => {
    if (b.kind === 'anchor' || isHead(b) || isWideText(b)) { groups.push({ type: 'solo', b }); return; }
    if (hasMarquee(b)) { groups.push({ type: 'marquee', b }); return; }
    if (hasHScroll(b)) { groups.push({ type: 'hscroll', b }); return; }
    if (isBigArt(b)) { groups.push({ type: 'fig', members: [b], ...bboxOf([b]) }); return; }
    const r = find(b);
    if (emitted.has(r)) return;
    emitted.add(r);
    const mem = comp.get(r);
    if (!mem.some((m) => m.hasImg)) {
      // 全是文字的簇 → 按段落各自回流；纯装饰底板（无图无字）丢弃
      mem.forEach((m) => { if (m.kind === 'text') groups.push({ type: 'solo', b: m }); });
      return;
    }
    groups.push({ type: 'fig', members: mem, ...bboxOf(mem) });
  });

  const col = document.createElement('div');
  col.className = 'case-m';

  // 画布里的字号/定位/宽度全部由手机版的类接管，内联值必须先清掉
  const strip = (el) => {
    ['position', 'top', 'left', 'width', 'minHeight', 'height', 'fontSize',
      'lineHeight', 'whiteSpace', 'opacity', 'letterSpacing', 'color'].forEach((p) => {
      el.style.removeProperty(p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    });
    el.querySelectorAll('[style*="font-size"]').forEach((d) => d.style.removeProperty('font-size'));
    el.querySelectorAll('[style*="white-space"]').forEach((d) => d.style.removeProperty('white-space'));
  };

  const shotImgs = [];   // 铺满一列的大截图，按真实显示宽挑档
  const compFigs = [];   // 拼贴组，整块 scale 到列宽
  const railFigs = [];   // 横向画廊：整块内容按可读高度缩放后横滑（形式同电脑端 hscroll）
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  /* 横向画廊（对应桌面 hscroll 滚动图）：把画廊整块内容按可读高度等比缩放，放进横向滚动容器，
     手指横滑看，形式与电脑端一致；不拆成单张，保留原构图（流程图/多屏并排都不散）。附蓝色滚动条。 */
  function makeRail(content, canvasH, canvasW) {
    const wrap = document.createElement('div');
    wrap.className = 'case-m-railwrap';
    wrap.setAttribute('data-m-reveal', '');
    const rail = document.createElement('div');
    rail.className = 'case-m-rail';
    const sizer = document.createElement('div');
    sizer.className = 'case-m-galsizer';
    sizer.appendChild(content);
    rail.appendChild(sizer);
    const bar = document.createElement('div');
    bar.className = 'case-m-bar';
    const thumb = document.createElement('div');
    thumb.className = 'case-m-bar__thumb';
    bar.appendChild(thumb);
    wrap.appendChild(rail);
    wrap.appendChild(bar);
    const sync = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (max <= 1) { bar.style.display = 'none'; return; }
      bar.style.display = '';
      const tw = Math.max(0.16, rail.clientWidth / rail.scrollWidth) * 100;
      thumb.style.width = tw + '%';
      thumb.style.left = (rail.scrollLeft / max) * (100 - tw) + '%';
    };
    rail.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    railFigs.push({ content, sizer, canvasH, canvasW, sync });
    return wrap;
  }

  groups.forEach((g) => {
    /* ---- 2a) 文本 / 章节头 / 锚点 ---- */
    if (g.type === 'solo') {
      const b = g.b;
      const el = b.el;
      if (b.kind === 'anchor') { el.style.removeProperty('top'); col.appendChild(el); return; }
      strip(el);
      if (el.classList.contains('doc-ch')) {
        el.classList.add('case-m-ch');
        el.setAttribute('data-m-reveal', '');
        col.appendChild(el);
        return;
      }
      if (b.fs >= 28) el.className = (el.className + ' case-m-h').trim();
      else if (b.fs <= 16) el.className = (el.className + ' case-m-cap').trim();
      else el.className = (el.className + ' case-m-p' + (b.text.length <= 24 ? ' case-m-p--lead' : '')).trim();
      el.setAttribute('data-m-reveal', '');
      col.appendChild(el);
      return;
    }

    /* ---- 2b) marquee（KOOKO 产出那种自动横向滚动）→ 保留原样，收进列宽，自动滚动照旧 ---- */
    if (g.type === 'marquee') {
      const el = g.b.el;
      ['position', 'top', 'left', 'height', 'min-height'].forEach((p) => el.style.removeProperty(p));
      el.style.width = '100%';
      el.classList.add('case-m-marquee');
      el.setAttribute('data-m-reveal', '');
      col.appendChild(el);
      return;
    }

    /* ---- 2c) hscroll（画布自带的横向画廊）→ 整块内容按可读高度缩放后横滑，形式同电脑端 ---- */
    if (g.type === 'hscroll') {
      const box = g.b.el;
      const view = box.querySelector('.hscroll__view');
      if (view) {
        view.style.overflow = 'visible';
        view.style.width = 'max-content';
        view.style.removeProperty('padding');
      }
      box.querySelectorAll('img').forEach((im) => im.removeAttribute('loading'));
      box.removeAttribute('style');
      box.style.overflow = 'visible';
      col.appendChild(makeRail(box, g.bottom - g.top, g.right - g.left));
      return;
    }

    /* ---- 2d) 图块 / 图簇：保留画布相对坐标，整块等比缩到列宽（只缩不放大）。
       大图各自成块 → 并排的两块在此自然变成上下排；小图簇整片保留电脑端网格，不拆行。 ---- */
    const fw = g.right - g.left;
    const fh = g.bottom - g.top;
    if (!fw || !fh) return;

    const card = document.createElement('div');
    card.className = 'case-m-fig case-m-fig--comp';
    card.setAttribute('data-m-reveal', '');
    const inner = document.createElement('div');
    inner.className = 'case-m-fig__in';
    inner.style.width = fw + 'px';
    inner.style.height = fh + 'px';
    g.members.forEach((b) => {
      b.el.style.top = (b.top - g.top) + 'px';
      b.el.style.left = (b.left - g.left) + 'px';
      inner.appendChild(b.el);
    });
    inner.querySelectorAll('img').forEach((im) => {
      // 保留 loading=lazy：整页图很多，一次性全解码会把内存顶爆/卡死。
      // 只补宽高比占位，避免没内联高度的图在未加载时塌成 0 高。
      if (!im.style.height) {
        const aw = parseFloat(im.getAttribute('width'));
        const ah = parseFloat(im.getAttribute('height'));
        if (aw && ah) im.style.aspectRatio = aw + ' / ' + ah;
      }
    });
    card.appendChild(inner);
    col.appendChild(card);
    compFigs.push({ card, inner, fw, fh });
  });

  wraps[0].parentNode.insertBefore(col, wraps[0]);
  wraps.forEach((wrap) => wrap.remove());

  /* ---- 3) 按真实显示宽度重挑 srcset 档 ----
     画布上的 sizes 是按桌面版心声明的，手机版式里显示宽度完全不同，光改 sizes 没用
     （图已加载过，浏览器不会为了变大再换）。这里按显示宽 × dpr × 0.8 在 srcset 里
     选最小够用的一档写回 src，并把 srcset/sizes 摘掉。不留放大余量：手机不用捏合。 */
  const HEADROOM = 0.8;
  const CAP_D = 2.4;
  function sharpen(img, showW) {
    const ss = img.getAttribute('srcset');
    if (!ss || !showW) return;
    const cands = ss.split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      return { url: bits[0], w: parseFloat(bits[1]) || 0 };
    }).filter((c) => c.url && c.w).sort((a, b) => a.w - b.w);
    if (!cands.length) return;
    const need = showW * (window.devicePixelRatio || 1) * HEADROOM;
    const pick = cands.find((c) => c.w >= need) || cands[cands.length - 1];
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.setAttribute('src', pick.url);
    const top = cands[cands.length - 1].w;
    const cap = Math.round(top / CAP_D);
    const host = img.closest('.case-m-shot') || img;
    if (cap < showW) host.style.maxWidth = cap + 'px';
  }

  function fitFigs() {
    const colW = Math.min(640, innerWidth || 390) - 48;
    const maxH = Math.max(360, Math.min(640, (innerHeight || 720) * 0.82));
    compFigs.forEach(({ card, inner, fw, fh }) => {
      const cs = Math.min(colW / fw, maxH / fh, 1); // 同时受列宽与限高约束，只缩不放大
      inner.style.transformOrigin = '0 0';
      inner.style.transform = 'scale(' + cs.toFixed(6) + ')';
      card.style.width = Math.round(fw * cs) + 'px';
      card.style.height = Math.round(fh * cs) + 'px';
      inner.querySelectorAll('img').forEach((img) => sharpen(img, num(img.style.width) * cs));
    });
    shotImgs.forEach((img) => {
      if (!img) return;
      const w = img.getBoundingClientRect().width;
      if (w) sharpen(img, w);
    });
    // 横向画廊：整块内容按可读高度缩放，sizer 撑到缩放后的尺寸让容器横向滚动
    const galH = Math.max(300, Math.min(400, (innerHeight || 720) * 0.5));
    railFigs.forEach(({ content, sizer, canvasH, canvasW, sync }) => {
      const rawW = Math.max(content.scrollWidth || 0, content.offsetWidth || 0, canvasW || 0) || 1;
      const cs = Math.min(galH / (canvasH || galH), 1);
      content.style.transformOrigin = '0 0';
      content.style.transform = 'scale(' + cs.toFixed(6) + ')';
      sizer.style.width = Math.round(rawW * cs) + 'px';
      sizer.style.height = Math.round((canvasH || galH) * cs) + 'px';
      content.querySelectorAll('img').forEach((img) => {
        const r = img.getBoundingClientRect();
        if (r.width) sharpen(img, r.width);
      });
      sync();
    });
  }
  fitFigs();
  addEventListener('resize', fitFigs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFigs);

  /* ---- 4) 大图离屏卸解码：远离视口的换成 1×1 空图（先钉住宽高比，布局不跳）----
     判据用 IntersectionObserver（相对布局视口），不掺 visualViewport。 */
  function startUnload() {
    const bigs = shotImgs.filter((img) => img && !img.closest('.case-m-fig--comp'));
    if (!bigs.length || !('IntersectionObserver' in window)) return;
    const park = (img) => {
      if (img.dataset.mSrc) return;
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      img.style.aspectRatio = r.width + ' / ' + r.height;
      img.dataset.mSrc = img.getAttribute('src') || '';
      img.setAttribute('src', BLANK);
    };
    const restore = (img) => {
      if (!img.dataset.mSrc) return;
      img.setAttribute('src', img.dataset.mSrc);
      delete img.dataset.mSrc;
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      e.isIntersecting ? restore(e.target) : park(e.target);
    }), { rootMargin: '120% 0px 120% 0px' });
    bigs.forEach((img) => io.observe(img));
  }
  startUnload();

  /* ---- 5) 入场：与桌面同一条曲线，位移收到 22px ---- */
  const items = [...col.querySelectorAll('[data-m-reveal]')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.02 });
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
      else io.observe(el);
    });
  }

  if (window.ScrollTrigger) ScrollTrigger.refresh();
})();
