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

  /* ---- 1) 把画布块读成一张表，按设计稿的 y 排序（记录所属 slice 与原始 DOM 次序） ---- */
  const blocks = [];
  let sliceSeq = 0;
  let domSeq = 0;
  wraps.forEach((wrap) => {
    wrap.querySelectorAll('.case-slice').forEach((slice) => {
      const si = sliceSeq++;
      [...slice.children].forEach((el) => {
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
        else if (text) kind = 'text'; // 有文字无图 → 文字（字号缺省时按正文处理）
        else kind = 'art'; // 纯色底板、分割线这类装饰件跟着图走
        blocks.push({ el, si, dom: domSeq++, top, left, w, h, fs, kind, text, hasImg, right: left + w, bottom: top + h });
      });
    });
  });
  blocks.sort((a, b) => a.top - b.top || a.left - b.left);

  /* ---- 2) 分组 ----
     用户明确要求：图片排版形式全部复刻电脑端，不手动改动、不重排——
     所以同一个 .case-slice 里的所有图形（图片 + 图上的窄标注 + 装饰底板）
     整体作为一块，保留电脑端相对坐标，一起等比缩到列宽，构图与电脑端逐像素一致。
     手机端只调"文字"：正文段落（宽文本）、章节头、锚点单独回流成移动端可读排版。
     marquee（自动横滚）/ hscroll（横向画廊）保持其既有滚动形式。
     纯装饰底板（整块无图）丢弃，避免空白灰框。 */
  const hasMarquee = (b) => b.el.matches('.marquee') || !!b.el.querySelector('.marquee__track');
  const hasHScroll = (b) => b.el.matches('[data-hscroll]') || !!b.el.querySelector('.hscroll__view');
  const isWideText = (b) => b.kind === 'text' && b.w >= 520;
  const isHead = (b) => !!(b.el.classList && b.el.classList.contains('doc-ch'));
  const isTextFlow = (b) => b.kind === 'anchor' || isHead(b) || isWideText(b);
  const isSpecial = (b) => hasMarquee(b) || hasHScroll(b);
  const bboxOf = (mem) => mem.reduce((a, b) => ({
    top: Math.min(a.top, b.top), left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
  }), { top: 1e9, left: 1e9, right: -1e9, bottom: -1e9 });

  // 裁稀疏：以面积最大的成员为主体，纵向 180px 内相连的才保留，远处孤立碎件丢掉——
  // 消除 Figma 画布那种"两帧在上、底部一个小碎件"撑出的巨大空隙。
  const denseBlock = (mem) => {
    if (mem.length <= 1) return mem;
    const CUT = 180;
    const seed = mem.reduce((a, b) => ((b.right - b.left) * (b.bottom - b.top) > (a.right - a.left) * (a.bottom - a.top) ? b : a));
    let top = seed.top, bottom = seed.bottom, grew = true;
    while (grew) {
      grew = false;
      mem.forEach((m) => {
        if (m.top < bottom + CUT && m.bottom > top - CUT) {
          if (m.top < top - 1) { top = Math.min(top, m.top); grew = true; }
          if (m.bottom > bottom + 1) { bottom = Math.max(bottom, m.bottom); grew = true; }
        }
      });
    }
    return mem.filter((m) => m.top < bottom + 1 && m.bottom > top - 1);
  };

  // 每个 slice 的图形成员（非文字流、非特殊件）聚成一块。
  // 图上的窄标注（压在图片范围内的文字，如流程图节点名）跟着图走；
  // 不压在任何图片上的独立窄文字（图名/短引言）当作文字回流。
  const sliceImgs = new Map();
  blocks.forEach((b) => {
    if (b.hasImg) { if (!sliceImgs.has(b.si)) sliceImgs.set(b.si, []); sliceImgs.get(b.si).push(b); }
  });
  // 图形块（图片本身，或压在图片范围内的底板/标注）才进入 fig；
  // 画布里离图很远的装饰线/间隔件会撑大 bbox 造成"莫名空隙"，一律排除。
  const MARGIN = 160;
  const nearImgs = (b) => {
    const imgs = sliceImgs.get(b.si) || [];
    return imgs.some((im) => b.top < im.bottom + MARGIN && b.bottom > im.top - MARGIN
        && b.left < im.right + MARGIN && b.right > im.left - MARGIN);
  };
  const inFig = (b) => {
    if (isTextFlow(b) || isSpecial(b)) return false;
    if (b.hasImg) return true;
    if (b.kind === 'text') return false; // 标注/图名一律回流成可读文字
    return nearImgs(b); // 底板/装饰件：仅当紧贴图片才并入，远处的间隔件丢弃（否则撑出空隙）
  };
  const sliceFig = new Map();
  blocks.forEach((b) => {
    if (!inFig(b)) return;
    if (!sliceFig.has(b.si)) sliceFig.set(b.si, []);
    sliceFig.get(b.si).push(b);
  });

  const emitted = new Set();
  const groups = [];
  blocks.forEach((b) => {
    if (isTextFlow(b)) { groups.push({ type: 'solo', b }); return; }
    if (hasMarquee(b)) { groups.push({ type: 'marquee', b }); return; }
    if (hasHScroll(b)) { groups.push({ type: 'hscroll', b }); return; }
    if (!inFig(b)) {
      // 图名/短引言（离图较远的窄文字）→ 文字回流；无图无字装饰件丢弃
      if (b.kind === 'text') groups.push({ type: 'solo', b });
      return;
    }
    if (emitted.has(b.si)) return;
    emitted.add(b.si);
    let mem = sliceFig.get(b.si) || [];
    if (!mem.some((m) => m.hasImg)) return; // 整块无图 → 丢弃装饰底板
    mem = denseBlock(mem); // 裁掉离主体很远的稀疏碎件（否则撑出大空隙）
    if (!mem.some((m) => m.hasImg)) return;
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
      else if (b.fs > 0 && b.fs <= 16) el.className = (el.className + ' case-m-cap').trim();
      else el.className = (el.className + ' case-m-p' + (b.text.length <= 24 ? ' case-m-p--lead' : '')).trim();
      el.setAttribute('data-m-reveal', '');
      col.appendChild(el);
      return;
    }

    /* ---- 2b) marquee（KOOKO 产出那种自动横向滚动）→ 保留原样，收进列宽，自动滚动照旧。
       画布上的图尺寸偏大又被放大显得糊：清掉内联宽高交给 CSS 定一个较小的行高，
       再按显示尺寸重挑 srcset 档（缩小=更清晰）。 ---- */
    if (g.type === 'marquee') {
      const el = g.b.el;
      ['position', 'top', 'left', 'height', 'min-height'].forEach((p) => el.style.removeProperty(p));
      el.style.width = '100%';
      el.classList.add('case-m-marquee');
      el.setAttribute('data-m-reveal', '');
      el.querySelectorAll('img').forEach((im) => {
        im.style.removeProperty('width');
        im.style.removeProperty('height');
        im.removeAttribute('loading');
        shotImgs.push(im);
      });
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
    // 按原始 DOM 次序 append，保持与电脑端一致的叠放顺序（否则灰底板会盖住照片 → 空白框）
    g.members.slice().sort((a, b) => a.dom - b.dom).forEach((b) => {
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
    compFigs.forEach(({ card, inner, fw, fh }) => {
      const cs = Math.min(colW / fw, 1); // 纯按列宽等比缩，只缩不放大——构图与电脑端逐像素一致
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
    const bigs = shotImgs.filter((img) => img && !img.closest('.case-m-fig--comp') && !img.closest('.case-m-marquee'));
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
