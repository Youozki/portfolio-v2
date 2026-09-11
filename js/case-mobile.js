/* 内页手机版式（terabox / oreate / justpaper / companion）。
   桌面不动：仍是 1920 坐标画布 + transform: scale。手机上把画布拆成一列——
   1) 正文回到正常字号的流式段落，字号／行高／章节间距按桌面画布的比例还原；
   2) 界面截图逐张铺满一列；一张图里横着摆了好几屏的、以及画布自带的横向滚动图与图墙，
      放进卡片内横向滑动，下面配一条蓝色滚动条（不然用户不知道能滑）；
   3) 拼贴小图保留设计稿里的相对位置，整组等比缩；
   4) 拆完把原来的 .case-doc-wrap 整棵删掉，同一份内容不会在内存里存两遍。

   这个文件必须排在 js/case-doc.js 之前：它会在 <html> 上挂 is-doc-mobile，
   case-doc.js 看到就整体让路（画布缩放、裁段、按行入场全都不跑）。

   **图片绝不许变形**：只有真正的 <img> 才会被拉到一列宽，而且一定带 width/height
   属性（内在宽高比），CSS 只给 width:100% + height:auto；非 img 的块（渐变卡片、
   带层级的组合件）一律走"保留设计稿坐标整组等比缩"那条路，几何关系分毫不动。 */
(() => {
  'use strict';

  const wraps = [...document.querySelectorAll('.case-doc-wrap')];
  if (!wraps.length) return;
  if (!matchMedia('(max-width: 767px)').matches) return;

  document.documentElement.classList.add('is-doc-mobile');

  const num = (v) => parseFloat(v) || 0;
  const drop = (el, props) => props.forEach((p) => el.style.removeProperty(p));
  const mk = (cls) => {
    const d = document.createElement('div');
    d.className = cls;
    return d;
  };
  const STACK_MIN = 600; // 画布上有这么宽才算"界面截图"，才值得铺满一列

  /* ---- 1) 把画布块读成一张表，按设计稿的 y 排序 ---- */
  const blocks = [];
  wraps.forEach((wrap) => {
    wrap.querySelectorAll('.case-slice > *').forEach((el) => {
      const st = el.style;
      const w = num(st.width);
      const h = num(st.height) || num(st.minHeight);
      const fs = num(st.fontSize);
      const text = (el.textContent || '').trim();
      let kind;
      if (el.classList.contains('doc-anchor')) kind = 'anchor';
      else if (el.querySelector('[data-hscroll-bar]') || el.hasAttribute('data-hscroll-bar')) kind = 'bar';
      else if (el.querySelector('[data-hscroll], .marquee')) kind = 'rail';
      else if (el.tagName === 'IMG' || el.querySelector('img')) kind = 'art';
      else if (fs >= 14 && text) kind = 'text';
      else kind = 'art'; // 纯色底板、分割线这类装饰件跟着图走
      blocks.push({
        el, kind, fs, text, w, h,
        top: num(st.top), left: num(st.left),
        right: num(st.left) + w, bottom: num(st.top) + h,
      });
    });
  });
  blocks.sort((a, b) => a.top - b.top || a.left - b.left);

  /* ---- 2) 分组：设计稿里纵向挨着的装饰件与图算一组，一组出一张卡片 ---- */
  const GAP = 48;
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

  const col = mk('case-m');
  const comps = [];   // 等比缩的拼贴组
  const shotImgs = []; // 铺满一列的截图
  const barSyncs = [];
  const stripBoxes = []; // 横向带子里"容器 + 内部绝对定位"的项，按高度缩

  /* ---- 3) 横向滑动卡片：一条 rail + 一条蓝色滚动条 ---- */
  function addBar(rail, card) {
    const bar = mk('case-m-bar');
    const thumb = mk('case-m-bar__thumb');
    bar.appendChild(thumb);
    card.appendChild(bar);
    const sync = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (max <= 2 || !bar.clientWidth) { bar.style.visibility = 'hidden'; return; }
      bar.style.visibility = '';
      const w = Math.max(bar.clientWidth * (rail.clientWidth / rail.scrollWidth), 26);
      thumb.style.width = w.toFixed(2) + 'px';
      thumb.style.transform = 'translateX(' + ((rail.scrollLeft / max) * (bar.clientWidth - w)).toFixed(2) + 'px)';
    };
    rail.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    barSyncs.push(sync);
    return sync;
  }

  // 图片一律带 width/height 属性：内在宽高比在手里，任何时候都不会被拉变形
  function lockRatio(img, fw, fh) {
    if (!img || img.hasAttribute('width')) return;
    const w = img.naturalWidth || fw || num(img.style.width);
    const h = img.naturalHeight || fh || num(img.style.height);
    if (w && h) {
      img.setAttribute('width', Math.round(w));
      img.setAttribute('height', Math.round(h));
      return;
    }
    img.addEventListener('load', () => {
      if (img.naturalWidth && !img.hasAttribute('width')) {
        img.setAttribute('width', img.naturalWidth);
        img.setAttribute('height', img.naturalHeight);
      }
    }, { once: true });
  }

  /* 画布自带的横向滚动图（[data-hscroll]）与素材图墙（.marquee）：
     内部是一条画布坐标的 flex 带子。手机上把带子里每一项按高度铺开、横向滑动看，
     并配一条蓝色滚动条。画布那条蓝条是另一个块，按 kind='bar' 丢掉。 */
  function buildRail(b) {
    const el = b.el;
    const view = el.querySelector('[data-hscroll]') || el.querySelector('.marquee');
    const strip = view && view.firstElementChild;
    if (!strip) return;
    const card = mk('case-m-fig case-m-fig--rail');
    card.setAttribute('data-m-reveal', '');
    if (el.style.backgroundColor) card.style.background = el.style.backgroundColor;
    const rail = mk('case-m-rail');
    drop(strip, ['width', 'height']);
    strip.classList.add('case-m-strip');
    [...strip.children].forEach((item) => {
      // 先记下画布上的宽高（= 素材的真实宽高比），再清掉内联值，属性里留一份兜底
      const iw = num(item.style.width);
      const ih = num(item.style.height);
      if (item.tagName === 'IMG') {
        drop(item, ['width', 'height', 'position', 'top', 'left']);
        item.classList.add('case-m-strip__it');
        lockRatio(item, iw, ih);
        return;
      }
      /* 带子里也有"容器 + 内部绝对定位"的项（justpaper 那几张就是）。
         这种项**不能把宽度清掉**——容器塌成 0 宽之后，里面那张绝对定位的图会按画布
         原尺寸（1500 多 px）挂在外面，把整个页面的布局视口撑宽，顶部胶囊都会跑偏。
         做法是给它一个按高度定尺寸的外框，内部保持画布坐标整块缩放。 */
      const box = mk('case-m-strip__it case-m-strip__box');
      if (iw && ih) box.style.aspectRatio = iw + ' / ' + ih;
      item.classList.add('case-m-strip__canvas');
      item.style.width = (iw || 100) + 'px';
      item.style.height = (ih || 100) + 'px';
      drop(item, ['position', 'top', 'left']);
      item.querySelectorAll('img').forEach((im) => lockRatio(im, num(im.style.width), num(im.style.height)));
      strip.insertBefore(box, item);
      box.appendChild(item);
      stripBoxes.push({ box, item, ih: ih || 100 });
    });
    rail.appendChild(strip);
    card.appendChild(rail);
    addBar(rail, card);
    col.appendChild(card);
  }

  /* ---- 4) 逐组搭手机版 DOM ---- */
  const textStyles = ['position', 'top', 'left', 'width', 'min-height', 'height', 'font-size',
    'line-height', 'white-space', 'opacity', 'letter-spacing', 'color'];
  function plainText(el) {
    drop(el, textStyles);
    el.querySelectorAll('[style*="font-size"]').forEach((d) => d.style.removeProperty('font-size'));
    el.querySelectorAll('[style*="white-space"]').forEach((d) => d.style.removeProperty('white-space'));
    el.querySelectorAll('[style*="line-height"]').forEach((d) => d.style.removeProperty('line-height'));
  }

  groups.forEach((g) => {
    if (g.solo) {
      const b = g.solo;
      const el = b.el;
      if (b.kind === 'bar') { el.remove(); return; }          // 画布那条蓝条，手机版自己重建
      if (b.kind === 'rail') { buildRail(b); return; }
      if (b.kind === 'anchor') { drop(el, ['top']); col.appendChild(el); return; }
      plainText(el);
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
    /* 两条路，按"组里的图是不是够大的纯 <img>"分：
       - **界面截图**（纯 img 且画布宽度 ≥ 600）：逐张铺满一列；宽高比 1.5–3.5 的
         （一张图里横着摆了好几屏）放进横向滑动卡片按高度放大。
       - **其余一切**（渐变卡片、带层级的组合件、拼贴小图）：保留设计稿里的相对位置整组等比缩。
         非 img 的块绝不重新塑形——这是"图片变形"那个问题的根因。 */
    const imgish = g.arts.filter((b) => b.el.tagName === 'IMG' || b.el.querySelector('img'));
    const panels = g.arts.filter((b) => imgish.indexOf(b) < 0);
    if (!imgish.length) { g.arts.forEach((b) => b.el.remove()); return; }
    const pureShots = imgish.filter((b) => b.el.tagName === 'IMG');
    const canStack = pureShots.length === imgish.length
      && Math.max(...pureShots.map((b) => b.w)) >= STACK_MIN;

    const card = mk('case-m-fig');
    card.setAttribute('data-m-reveal', '');
    const skin = panels[0] && panels[0].el.style;
    if (skin && skin.backgroundColor) card.style.background = skin.backgroundColor;

    if (!canStack) {
      card.classList.add('case-m-fig--comp');
      card.style.aspectRatio = fw + ' / ' + fh;
      const inner = mk('case-m-fig__in');
      inner.style.width = fw + 'px';
      inner.style.height = fh + 'px';
      g.arts.forEach((b) => {
        b.el.style.top = (b.top - g.top) + 'px';
        b.el.style.left = (b.left - g.left) + 'px';
        inner.appendChild(b.el);
      });
      card.appendChild(inner);
      col.appendChild(card);
      comps.push({ card, inner, fw });
      return;
    }

    pureShots.sort((a, b) => a.top - b.top || a.left - b.left);
    pureShots.forEach((b) => {
      const el = b.el;
      drop(el, ['position', 'top', 'left', 'width', 'height', 'max-width']);
      lockRatio(el, b.w, b.h);
      el.classList.add('case-m-shot');
      const ratio = b.w / (b.h || 1);
      if (ratio >= 1.5 && ratio <= 3.5) {
        const rail = mk('case-m-rail');
        el.classList.add('case-m-shot--tall');
        rail.appendChild(el);
        card.appendChild(rail);
        addBar(rail, card);
      } else {
        card.appendChild(el);
      }
      shotImgs.push(el);
    });
    panels.forEach((b) => b.el.remove());
    col.appendChild(card);
  });

  wraps[0].parentNode.insertBefore(col, wraps[0]);
  wraps.forEach((wrap) => wrap.remove());

  /* ---- 5) 图片档位自己挑 ----
     画布上的 sizes 是按桌面版心（如 17.49vw）声明的，手机版式里显示宽度完全不同。
     **必须把 srcset/sizes 一起摘掉再写 src**：留着 srcset，浏览器仍按那个桌面 sizes 算，
     已经加载好的小档不会为了变大再换一张。目标 0.8×dpr（视网膜屏肉眼分不出，
     解码内存差好几倍）；素材本身不够大的按 0.8 密度封顶居中放，不许拉满一列。 */
  const HEADROOM = 0.8;
  const CAP_D = 2.4;
  function sharpen(img, showW) {
    if (img.dataset.mFit || !showW) return;
    const ss = img.getAttribute('srcset');
    const cands = (ss || '').split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      return { url: bits[0], w: parseFloat(bits[1]) || 0 };
    }).filter((c) => c.url && c.w).sort((a, b) => a.w - b.w);
    let topW = cands.length ? cands[cands.length - 1].w : 0;
    if (cands.length) {
      const ar = (parseFloat(img.getAttribute('width')) || 1) / (parseFloat(img.getAttribute('height')) || 1);
      /* 单张图的解码预算 4MB。内页崩溃的账是"全页解码 + 栅格化"，justpaper 那张
         2578×1450 的原图一张就 15MB，进一张就把预算吃掉一大半。所以先按预算筛掉
         过大的档，再在剩下的里挑够用的；显示尺寸随后按选中的档封顶（见下面的 cap），
         这样密度稳定在 0.8 左右，既不糊也不爆。 */
      const BUDGET = 4 * 1024 * 1024;
      const est = (w) => w * (ar > 0 ? w / ar : w) * 4;
      const ok = cands.filter((c) => est(c.w) <= BUDGET);
      const pool = ok.length ? ok : [cands[0]];
      const need = showW * (window.devicePixelRatio || 1) * HEADROOM;
      const pick = pool.find((c) => c.w >= need) || pool[pool.length - 1];
      topW = pick.w;
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.setAttribute('src', pick.url);
    } else {
      // 没有 srcset 的（单档小图）也要按素材真实宽度封顶，不然照样会被拉糊
      topW = parseFloat(img.getAttribute('width')) || img.naturalWidth || 0;
      if (!topW) return;
    }
    img.dataset.mFit = '1';
    const cap = Math.round(topW / CAP_D);
    if (img.classList.contains('case-m-shot') && !img.classList.contains('case-m-shot--tall')) {
      if (cap < showW) img.style.maxWidth = cap + 'px';
      else img.style.removeProperty('max-width');
      return;
    }
    /* 横向滑动带里的图是按高度定尺寸的：素材不够大的时候不能让它铺到 46vh，
       否则宽度跟着放大、密度掉到 0.3 就是一团糊。按最大档 / 2.4（≈0.8 屏幕密度）
       换算出一个高度上限压回去，宽高比不动，所以不会变形。 */
    const host = img.closest('.case-m-strip__it') || img;
    const ratio = (parseFloat(img.getAttribute('width')) || img.naturalWidth || 0)
      / (parseFloat(img.getAttribute('height')) || img.naturalHeight || 1);
    if (ratio > 0) host.style.maxHeight = Math.round(cap / ratio) + 'px';
  }

  function fit() {
    stripBoxes.forEach(({ box, item, ih }) => {
      const bh = box.clientHeight;
      if (bh) item.style.setProperty('--sc', (bh / ih).toFixed(6));
    });
    comps.forEach(({ card, inner, fw }) => {
      const cw = card.clientWidth;
      if (!cw) return;
      inner.style.setProperty('--mcs', (cw / fw).toFixed(6));
      inner.querySelectorAll('img').forEach((img) => sharpen(img, num(img.style.width) * (cw / fw)));
    });
    col.querySelectorAll('.case-m-shot, .case-m-strip__it img, .case-m-strip__it').forEach((el) => {
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (!img) return;
      const w = img.getBoundingClientRect().width;
      if (w) sharpen(img, w);
    });
    barSyncs.forEach((s) => s());
  }
  fit();
  addEventListener('resize', fit);
  addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ---- 6) 大图离屏卸解码 ----
     手机版式里图是铺满一列的，单张解码比画布版大好几倍，全页留在内存里仍会超预算。
     远离视口的换成 1×1 空图，回来再换回去。宽高比由 width/height 属性兜着，
     所以卸载不会让布局跳、也不会让图变形。判据用 IntersectionObserver（相对布局视口），
     不掺 visualViewport，见 HANDOFF 6.10。 */
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  if ('IntersectionObserver' in window) {
    /* 三类都能卸：
       1) 铺满一列的截图（`.case-m-shot`）——盒子由宽度定，卸载前把 width/height 属性
          推出来的比例写进 aspect-ratio 就不会变形；
       2) 画布坐标里的图（内联同时写了 width 和 height）——盒子本来就是写死的；
       3) 横向滑动带里按高度定尺寸的图——**卸载前必须把当前宽度写成内联值**，
          否则换成 1×1 空图之后宽度跟着高度变成正方形，那就是变形。 */
    const bigs = [...col.querySelectorAll('img')];
    const heightDriven = (img) => img.classList.contains('case-m-shot--tall')
      || (img.closest('.case-m-strip__it') && !img.closest('.case-m-strip__canvas'));

    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const img = e.target;
      if (e.isIntersecting) {
        if (img.dataset.mSrc) {
          img.setAttribute('src', img.dataset.mSrc);
          if (img.dataset.mSrcset) { img.setAttribute('srcset', img.dataset.mSrcset); delete img.dataset.mSrcset; }
          if (img.dataset.mW) { img.style.removeProperty('width'); delete img.dataset.mW; }
          delete img.dataset.mSrc;
          img.style.removeProperty('aspect-ratio');
        }
        return;
      }
      if (img.dataset.mSrc) return;
      /* 卸载前必须先拿到一个**真实的**地址。有的画布图只有 srcset 没有 src，
         直接读 src 属性会拿到空串，装回来时就写了个空地址——图永久变白。 */
      const url = img.getAttribute('src') || img.currentSrc || '';
      if (!url || url === BLANK) return;
      const fixedBox = num(img.style.width) && num(img.style.height);

      const w = img.getAttribute('width');
      const h = img.getAttribute('height');
      if (heightDriven(img)) {
        const rw = img.getBoundingClientRect().width;
        if (!rw) return;
        img.style.width = rw.toFixed(2) + 'px';
        img.dataset.mW = '1';
      } else if (!fixedBox && !(w && h)) {
        return; // 盒子既不写死、也没有内在宽高比，就不卸，避免布局跳
      } else if (!fixedBox) {
        /* 换成 1×1 空图之后，**已加载资源的自然宽高比会盖掉 width/height 属性推出来的比例**，
           图会变成正方形（用户报的"图片变形"就是这么来的）。所以卸载前先把比例写进内联
           aspect-ratio，装回来时再撤掉。画布坐标里盒子写死的图不需要这一步。 */
        img.style.aspectRatio = w + ' / ' + h;
      }
      img.dataset.mSrc = url;
      // srcset 还在的话 src 是不生效的，卸载必须连 srcset 一起摘
      if (img.getAttribute('srcset')) {
        img.dataset.mSrcset = img.getAttribute('srcset');
        img.removeAttribute('srcset');
      }
      img.setAttribute('src', BLANK);
    }), { rootMargin: '120% 0px 120% 0px' });
    bigs.forEach((img) => io.observe(img));
  }

  /* ---- 7) 入场：与桌面同一条曲线，位移收到 22px ---- */
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



