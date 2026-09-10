/* 内页手机版式（试点：terabox）。
   桌面不动：仍是 1920 坐标画布 + transform: scale。手机上把画布拆成一列——
   1) 正文回到正常字号的流式段落（不用捏合就能读）；
   2) 每块底板连同板上的图合成一张卡片，卡片内部还是原坐标，只按卡片宽度整块缩放
      （所以图与图的相对关系、留白、圆角全都保持设计稿的样子）；
   3) 拆完把原来的 .case-doc-wrap 整棵删掉，同一份内容不会在内存里存两遍。
   这个文件必须排在 js/case-doc.js 之前：它会在 <html> 上挂 is-doc-mobile，
   case-doc.js 看到就整体让路（画布缩放、裁段、按行入场全都不跑）。 */
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
      let kind;
      if (el.classList.contains('doc-anchor')) kind = 'anchor';
      else if (el.tagName === 'IMG' || el.querySelector('img')) kind = 'art';
      else if (fs >= 14 && text) kind = 'text';
      else kind = 'art'; // 纯色底板、分割线这类装饰件跟着图走
      blocks.push({ el, top, left, w, h, fs, kind, text, right: left + w, bottom: top + h });
    });
  });
  blocks.sort((a, b) => a.top - b.top || a.left - b.left);

  /* ---- 2) 图组：设计稿里纵向挨着的装饰件与图算一组，一组出一张卡片 ---- */
  const GAP = 48; // 画布坐标下的间距阈值：小于这个距离视为同一组
  const groups = [];
  blocks.forEach((b) => {
    if (b.kind !== 'art') { groups.push({ solo: b }); return; }
    const last = groups[groups.length - 1];
    if (last && last.arts && b.top < last.bottom + GAP) {
      last.arts.push(b);
      last.top = Math.min(last.top, b.top);
      last.left = Math.min(last.left, b.left);
      last.right = Math.max(last.right, b.right);
      last.bottom = Math.max(last.bottom, b.bottom);
      return;
    }
    groups.push({ arts: [b], top: b.top, left: b.left, right: b.right, bottom: b.bottom });
  });

  /* ---- 3) 搭手机版 DOM ---- */
  const col = document.createElement('div');
  col.className = 'case-m';

  const strip = (el) => {
    // 画布里的字号／定位／宽度全部由手机版的类接管，内联值必须先清掉
    ['position', 'top', 'left', 'width', 'minHeight', 'height', 'fontSize',
      'lineHeight', 'whiteSpace', 'opacity', 'letterSpacing', 'color'].forEach((p) => {
      el.style.removeProperty(p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    });
    el.querySelectorAll('[style*="font-size"]').forEach((d) => d.style.removeProperty('font-size'));
    el.querySelectorAll('[style*="white-space"]').forEach((d) => d.style.removeProperty('white-space'));
  };

  const figs = [];
  const shotImgs = [];
  groups.forEach((g) => {
    if (g.solo) {
      const b = g.solo;
      if (b.kind === 'anchor') { b.el.style.removeProperty('top'); col.appendChild(b.el); return; }
      const el = b.el;
      strip(el);
      if (el.classList.contains('doc-ch')) {
        el.classList.add('case-m-ch');
        el.setAttribute('data-m-reveal', '');
        col.appendChild(el);
        return;
      }
      // 30px 以上是标题层；15px 以下是图注；其余是正文，很短的一段当引导句
      if (b.fs >= 28) el.className = (el.className + ' case-m-h').trim();
      else if (b.fs <= 16) el.className = (el.className + ' case-m-cap').trim();
      else el.className = (el.className + ' case-m-p' + (b.text.length <= 24 ? ' case-m-p--lead' : '')).trim();
      el.setAttribute('data-m-reveal', '');
      col.appendChild(el);
      return;
    }

    const fw = g.right - g.left;
    const fh = g.bottom - g.top;
    if (!fw || !fh) return;
    /* 两种图组，按组里最大那张在设计稿上的宽度分：
       - **界面截图**（≥ 600 画布 px）：逐张铺满一列。等比缩到一列里只剩七八十像素宽，
         等于把"看不清所以要捏合"这个根因原样搬过来。
       - **拼贴小图**（都比这个窄，比如那两张相纸、图标卡）：保留设计稿里的相对位置，
         整组按卡片宽度等比缩——这种图本来就是装饰，铺满一列会大得莫名其妙。 */
    const isImg = (b) => b.el.tagName === 'IMG' || !!b.el.querySelector('img');
    const panels = g.arts.filter((b) => !isImg(b));
    const shots = g.arts.filter(isImg);
    if (!shots.length) return; // 纯装饰底板在手机上没有意义，丢掉
    const card = document.createElement('div');
    card.className = 'case-m-fig';
    card.setAttribute('data-m-reveal', '');
    const skin = panels[0] && panels[0].el.style;
    if (skin && skin.backgroundColor) card.style.background = skin.backgroundColor;
    const widest = Math.max(...shots.map((b) => b.w));

    if (widest < 600) {
      card.classList.add('case-m-fig--comp');
      card.style.aspectRatio = fw + ' / ' + fh;
      const inner = document.createElement('div');
      inner.className = 'case-m-fig__in';
      inner.style.width = fw + 'px';
      inner.style.height = fh + 'px';
      g.arts.forEach((b) => {
        b.el.style.top = (b.top - g.top) + 'px';
        b.el.style.left = (b.left - g.left) + 'px';
        inner.appendChild(b.el);
      });
      card.appendChild(inner);
      col.appendChild(card);
      figs.push({ card, inner, fw });
      return;
    }

    shots.sort((a, b) => a.top - b.top || a.left - b.left);
    shots.forEach((b) => {
      const el = b.el;
      ['position', 'top', 'left', 'height'].forEach((p) => el.style.removeProperty(p));
      el.style.width = '100%';
      el.style.height = 'auto';
      el.classList.add('case-m-shot');
      const ratio = b.w / (b.h || 1);
      /* 一张图里横着摆了好几屏的（设计稿里那种 4 联手机图，宽高比 1.5–3.5），
         铺满一列每屏只剩七八十像素宽，还是得捏合。这种改成卡片内横向滑动：
         图按高度放大到看得清，横向滑着看，纵向阅读不受影响。 */
      if (ratio >= 1.5 && ratio <= 3.5) {
        const rail = document.createElement('div');
        rail.className = 'case-m-rail';
        el.style.width = 'auto';
        el.style.height = '46vh';
        el.style.maxWidth = 'none';
        rail.appendChild(el);
        card.appendChild(rail);
      } else {
        card.appendChild(el);
      }
      shotImgs.push(el.tagName === 'IMG' ? el : el.querySelector('img'));
    });
    panels.forEach((b) => b.el.remove());
    col.appendChild(card);
  });

  wraps[0].parentNode.insertBefore(col, wraps[0]);
  wraps.forEach((wrap) => wrap.remove());

  /* ---- 4) 卡片缩放系数 + 图片按真实显示宽度重挑档 ----
     画布上的 sizes 是按桌面版心（如 17.49vw）声明的，手机版式里图的显示宽度完全不同，
     光改 sizes 没用——图已经加载过，浏览器不会为了变大再去换一张。所以这里自己挑：
     按显示宽度 × dpr 在 srcset 里选最小够用的一档，直接写回 src。
     不留放大余量（桌面画布那套要留 1.5 倍是因为捏合不重挑档）：手机版式下正文已经不用
     捏合，图又是铺满一列的，再抬档只会把解码内存顶上去（内页崩溃的账见 HANDOFF 6.3–6.6）。 */
  const HEADROOM = 0.8; // 0.8 倍屏幕密度就够（视网膜屏上肉眼分不出，解码内存差好几倍）
  const CAP_D = 2.4; // 素材不够大的按 0.8 倍屏幕密度封顶：再拉就是糊出来的
  function sharpen(img, showW) {
    const ss = img.getAttribute('srcset');
    if (!ss || !showW) return; // srcset 已经摘掉 = 这张挑过了
    const cands = ss.split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      return { url: bits[0], w: parseFloat(bits[1]) || 0 };
    }).filter((c) => c.url && c.w).sort((a, b) => a.w - b.w);
    if (!cands.length) return;
    const need = showW * (window.devicePixelRatio || 1) * HEADROOM;
    const pick = cands.find((c) => c.w >= need) || cands[cands.length - 1];
    /* 必须把 srcset/sizes 一起摘掉再写 src：留着 srcset，浏览器仍然按画布上那个
       桌面 sizes（如 13vw）算，已经加载好的小档不会为了变大再换一张。 */
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.setAttribute('src', pick.url);
    /* 素材本身不够大的（设计稿里本来就只占两三百像素的图）不许拉满一列，
       否则铺满 390pt × dpr3 就是拉伸出来的糊。按 2 倍密度封顶，居中放。 */
    const top = cands[cands.length - 1].w;
    const cap = Math.round(top / CAP_D);
    const host = img.closest('.case-m-shot') || img;
    if (cap < showW) host.style.maxWidth = cap + 'px';
    else host.style.removeProperty('max-width');
  }

  function fitFigs() {
    // 拼贴组：整组按卡片宽度等比缩，组内坐标不动
    figs.forEach(({ card, inner, fw }) => {
      const cw = card.clientWidth;
      if (!cw) return;
      const cs = cw / fw;
      inner.style.setProperty('--mcs', cs.toFixed(6));
      inner.querySelectorAll('img').forEach((img) => sharpen(img, num(img.style.width) * cs));
    });
    // 铺满一列的截图：按真实显示宽度挑档
    shotImgs.forEach((img) => {
      if (!img) return;
      const w = img.getBoundingClientRect().width;
      if (w) sharpen(img, w);
    });
  }
  fitFigs();
  addEventListener('resize', fitFigs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFigs);

  /* ---- 5) 大图离屏卸解码 ----------------------------------------------
     手机版式里图是铺满一列的，单张解码比画布版大好几倍，全页留在内存里仍然会超预算。
     远离视口的换成 1×1 空图（先固定住宽高比，布局不跳），回来再换回去——
     判据用 IntersectionObserver（相对布局视口），不掺 visualViewport，见 HANDOFF 6.10。 */
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
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

  /* ---- 6) 入场：与桌面同一条曲线，位移收到 22px ---- */
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
