/* 内页手机版式（case-justpaper / case-oreate / case-terabox / case-companion）。
   桌面不动：仍是 1920 坐标画布 + transform: scale。手机上（≤767px）把画布拆成流式一列，
   并把 .case-doc-wrap 整棵删掉——同一份内容不会在内存里存两遍，放大时也不再有
   "整幅设计稿 × 缩放²" 的栅格化（iOS 捏合崩溃的根因，见 feedback_canvas_raster_zoom）。

   分组思路（复刻电脑端排版，只回流文字）：
   1) 每个 .case-slice 内，先把"图形块"（图片 / 不透明底板 / 带边框的表格图）按横向重叠聚成"列"。
      桌面并排的两列在手机上自然变成上下两块，各自等比缩到列宽——构图与电脑端逐像素一致，只是竖起来。
   2) 压在图形范围内的小字（图上的标注、奖项框里的标题）跟着图走，作为该列成员原位缩放。
   3) 落在图形之外（下方/上方）的小字是"图名"，回流成可读的图注，挂在所属列的正下方。
   4) 正文段落、章节头、锚点单独回流成移动端可读排版。
   5) marquee（自动横滚）/ hscroll（横向画廊）保持其既有滚动形式。

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
  const bgOpaque = (el) => {
    const c = el && el.style && el.style.backgroundColor;
    if (!c || c === 'transparent') return false;
    return !/,\s*0\s*\)$/.test(c.replace(/\s+/g, (m) => m));
  };
  wraps.forEach((wrap) => {
    wrap.querySelectorAll('.case-slice').forEach((slice) => {
      const si = sliceSeq++;
      const addBlock = (el, ox, oy) => {
        const st = el.style;
        const top = num(st.top) + oy;
        const left = num(st.left) + ox;
        const w = num(st.width);
        const h = num(st.height) || num(st.minHeight);
        const fs = num(st.fontSize);
        const text = (el.textContent || '').trim();
        const hasImg = el.tagName === 'IMG' || !!el.querySelector('img');
        blocks.push({ el, si, dom: domSeq++, top, left, w, h, fs, text, hasImg, right: left + w, bottom: top + h });
      };
      [...slice.children].forEach((el) => {
        // 拆包：一个近满宽的容器里若并排嵌着两块以上大底板（如 KOOKO 图片编辑器那组），
        // 把它的子级提升成独立块（坐标换算成绝对值），让两块自然分成上下两列。
        const kids = [...el.children];
        const panelKids = kids.filter((k) => bgOpaque(k) && num(k.style.width) > 300
          && (num(k.style.minHeight) || num(k.style.height)) > 200);
        let disjoint = panelKids.length >= 2;
        const sorted = panelKids.slice().sort((a, b) => num(a.style.left) - num(b.style.left));
        for (let i = 1; i < sorted.length; i++) {
          if (num(sorted[i].style.left) < num(sorted[i - 1].style.left) + num(sorted[i - 1].style.width) - 40) disjoint = false;
        }
        if (num(el.style.width) >= 1200 && disjoint) {
          const ox = num(el.style.left), oy = num(el.style.top);
          kids.forEach((k) => addBlock(k, ox, oy));
        } else {
          addBlock(el, 0, 0);
        }
      });
    });
  });
  blocks.sort((a, b) => a.top - b.top || a.left - b.left);

  /* ---- 2) 分类 ---- */
  const isAnchor = (b) => b.el.classList.contains('doc-anchor');
  const isHead = (b) => !!(b.el.classList && b.el.classList.contains('doc-ch'));
  const hasMarquee = (b) => b.el.matches('.marquee') || !!b.el.querySelector('.marquee__track');
  const hasHScroll = (b) => b.el.matches('[data-hscroll]') || !!b.el.querySelector('.hscroll__view');
  const isSpecial = (b) => hasMarquee(b) || hasHScroll(b);
  // 不透明底：rgba(...,0) / transparent 视为无底，其余有底色的算图形底板
  const opaqueBg = (el) => {
    const c = el && el.style && el.style.backgroundColor;
    if (!c || c === 'transparent') return false;
    return !/,\s*0\s*\)$/.test(c.replace(/\s+/g, (m) => m));
  };
  const hasBorder = (el) => {
    const s = el && el.style; if (!s) return false;
    return num(s.borderWidth) > 0 || /solid|dashed|dotted/.test(s.borderStyle || '');
  };
  // 图形块：图片 / 带不透明底或边框的块 / 内含底板或表格边框的块（如手势交互表）
  const isGraphic = (b) => {
    if (isAnchor(b) || isHead(b) || isSpecial(b)) return false;
    if (b.hasImg) return true;
    if (opaqueBg(b.el) || hasBorder(b.el)) return true;
    const kids = b.el.querySelectorAll('[style*="background-color"],[style*="border"]');
    for (const k of kids) { if (opaqueBg(k) || hasBorder(k)) return true; }
    return false;
  };
  // 小字：字号 ≤16 的短标注 / 图名（压图的当标注，离图的当图注）
  const isSmall = (b) => !isGraphic(b) && !isSpecial(b) && !isAnchor(b) && !isHead(b) && !!b.text && b.fs > 0 && b.fs <= 16;
  // 正文：其余有字的块，回流成可读段落
  const isProse = (b) => !isGraphic(b) && !isSpecial(b) && !isAnchor(b) && !isHead(b) && !isSmall(b) && !!b.text;

  const overlapX = (a, c, gap) => a.left < c.right + gap && a.right > c.left - gap;
  const overlapY = (a, c, gap) => a.top < c.bottom + gap && a.bottom > c.top - gap;
  const bboxOf = (mem) => mem.reduce((a, b) => ({
    top: Math.min(a.top, b.top), left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
  }), { top: 1e9, left: 1e9, right: -1e9, bottom: -1e9 });

  // 裁稀疏：以面积最大的成员为主体，纵向 200px 内相连的才保留，远处孤立碎件丢掉——
  // 消除 Figma 画布那种"两帧在上、底部一个小碎件"撑出的巨大空隙。
  const denseBlock = (mem) => {
    if (mem.length <= 1) return mem;
    const CUT = 200;
    const area = (m) => (m.right - m.left) * (m.bottom - m.top);
    const seed = mem.reduce((a, b) => (area(b) > area(a) ? b : a));
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

  /* ---- 3) 每个 slice 内：图形块按横向重叠聚成"列"（图名先收集，稍后跨 slice 统一归位）---- */
  const GAP = 14;
  const bySlice = new Map();
  blocks.forEach((b) => { if (!bySlice.has(b.si)) bySlice.set(b.si, []); bySlice.get(b.si).push(b); });
  let columns = [];      // { mem[], caps[], left, right, top, bottom }
  const looseCaps = [];  // 落在图形之外的小字（图名），跨 slice 统一挂到最近的上方图/画廊

  bySlice.forEach((list) => {
    const figs = list.filter(isGraphic);
    const cols = [];
    figs.slice().sort((a, b) => a.left - b.left).forEach((b) => {
      let col = cols.find((c) => overlapX(b, c, GAP));
      if (!col) { col = { mem: [], caps: [], left: b.left, right: b.right, top: b.top, bottom: b.bottom }; cols.push(col); }
      col.mem.push(b);
      col.left = Math.min(col.left, b.left); col.right = Math.max(col.right, b.right);
      col.top = Math.min(col.top, b.top); col.bottom = Math.max(col.bottom, b.bottom);
    });
    list.filter(isSmall).forEach((t) => {
      // 压在某个图形范围内 → 标注，并入该列（原位缩放，如奖项框里的标题）
      const host = figs.find((f) => overlapX(t, f, 0) && overlapY(t, f, 0));
      if (host) {
        const col = cols.find((c) => c.mem.includes(host));
        if (col) {
          col.mem.push(t);
          col.left = Math.min(col.left, t.left); col.right = Math.max(col.right, t.right);
          col.top = Math.min(col.top, t.top); col.bottom = Math.max(col.bottom, t.bottom);
          return;
        }
      }
      looseCaps.push(t); // 图名，稍后跨 slice 归到最近上方的图下
    });
    cols.forEach((c) => columns.push(c));
  });

  // 3b) 一列里若含两块以上大底板，就按底板之间的最大空隙递归切开，各块各自铺满列宽——
  //     竖切（上下）不统一高度；横切（左右）出来的两块是并排关系，打同一 grp 稍后统一卡片高度。
  //     这样：情绪卡(宽)在上、缩略图组(窄)在下时，下面那组会自己铺满列宽不再显小；
  //     并排两图（如 intro 手机图/折叠插画）仍上下排且灰底一致。单底板/等宽等情况不动。
  const isPanel = (m) => {
    const bw = m.right - m.left, bh = m.bottom - m.top;
    if (bw < 300 || bh < 200) return false;
    if (opaqueBg(m.el)) return true;
    return [...m.el.children].some((ch) => opaqueBg(ch) && (parseFloat(ch.style.width) || 0) > bw * 0.8);
  };
  let splitGrp = 0;
  const gapCut = (panels, lo, hi) => {
    const s = panels.slice().sort((a, b) => a[lo] - b[lo]);
    let maxGap = 0, cut = null, run = s[0][hi];
    for (let i = 1; i < s.length; i++) {
      const gap = s[i][lo] - run;
      if (gap > maxGap) { maxGap = gap; cut = (s[i][lo] + run) / 2; }
      run = Math.max(run, s[i][hi]);
    }
    return { maxGap, cut };
  };
  const splitRec = (mem, depth) => {
    const panels = mem.filter(isPanel);
    if (depth > 3 || panels.length < 2) return [{ mem }];
    const cy = gapCut(panels, 'top', 'bottom');
    const cx = gapCut(panels, 'left', 'right');
    if (Math.max(cy.maxGap, cx.maxGap) < 10) return [{ mem }];
    const useY = cy.maxGap >= cx.maxGap;
    const lo = useY ? 'top' : 'left', hi = useY ? 'bottom' : 'right', cut = useY ? cy.cut : cx.cut;
    const a = [], b = [];
    mem.forEach((m) => (((m[lo] + m[hi]) / 2 < cut) ? a : b).push(m));
    if (!a.length || !b.length) return [{ mem }];
    const pa = splitRec(a, depth + 1), pb = splitRec(b, depth + 1);
    if (!useY && pa.length === 1 && pb.length === 1) { // 并排两叶：统一卡片高度
      const grp = 'g' + (splitGrp++);
      return [{ mem: pa[0].mem, grp }, { mem: pb[0].mem, grp }];
    }
    return [...pa, ...pb];
  };
  const splitCols = [];
  columns.forEach((c) => {
    const parts = splitRec(c.mem, 0);
    if (parts.length < 2) { splitCols.push(c); return; }
    parts.forEach((p, i) => splitCols.push({ mem: p.mem, caps: i === 0 ? c.caps : [], grp: p.grp, ...bboxOf(p.mem) }));
  });
  columns = splitCols;

  // 图注抽取：pattern「灰底板 + 底板边上一行小图名」的容器（如 Twist Center 那两块），
  // 桌面是"底板当背景、图压在上面、图名在底板下沿"。手机上底板会被缩得很小，
  // 图名跟着缩到几乎看不清。这里把图名从容器里摘出来，作为该列的图注按可读字号回流到列下方。
  columns.forEach((c) => {
    c.mem.slice().forEach((m) => {
      if (m.hasImg || !m.text || !m.el.children) return;
      const kids = [...m.el.children];
      const bgChild = kids.find((ch) => opaqueBg(ch));
      const capChild = kids.find((ch) => ch !== bgChild && (ch.textContent || '').trim());
      if (bgChild && capChild) {
        c.caps.push({ el: capChild });
        capChild.remove();
      }
    });
  });

  /* ---- 4) 组装 groups；图名跨 slice 挂到最近上方的图/画廊下 ---- */
  const groups = [];
  const targets = []; // 可挂图名的目标：图列 + 横滚 / marquee
  blocks.forEach((b) => {
    if (isAnchor(b) || isHead(b) || isProse(b)) { groups.push({ type: 'solo', b, st: b.top, sl: b.left }); return; }
    if (hasMarquee(b) || hasHScroll(b)) {
      const g = { type: hasMarquee(b) ? 'marquee' : 'hscroll', b, caps: [], st: b.top, sl: b.left };
      groups.push(g);
      targets.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom, g });
    }
  });
  columns.forEach((c) => {
    const mem = denseBlock(c.mem);
    if (!mem.some((m) => m.hasImg || opaqueBg(m.el) || hasBorder(m.el))) return; // 纯空块（无图无底）丢弃
    const bb = bboxOf(mem);
    const g = { type: 'fig', members: mem, caps: c.caps.slice(), grp: c.grp, ...bb, st: bb.top, sl: bb.left };
    groups.push(g);
    targets.push({ ...bb, g });
  });
  // 图名归位：x 覆盖 + 正好落在其上方最近一张图/画廊的下沿（图名一般紧贴图底）
  looseCaps.forEach((t) => {
    const cx = (t.left + t.right) / 2;
    let best = null, bd = 1e9;
    targets.forEach((tg) => {
      if (cx < tg.left - 20 || cx > tg.right + 20) return;
      const d = t.top - tg.bottom; // 图名在图下方为正
      if (d < -60 || d > 200) return; // 只认紧贴（略压到图上或图下不远）
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = tg; }
    });
    if (best) best.g.caps.push(t);
    else groups.push({ type: 'solo', b: t, st: t.top, sl: t.left });
  });
  groups.sort((a, b) => a.st - b.st || a.sl - b.sl);

  const col = document.createElement('div');
  col.className = 'case-m';

  // 画布里的字号/定位/宽度全部由手机版的类接管，内联值必须先清掉（含所有后代，
  // 否则内层还挂着 width:1098px / white-space:nowrap，回流时会横向溢出被裁）
  const strip = (el) => {
    ['position', 'top', 'left', 'width', 'minHeight', 'height', 'fontSize',
      'lineHeight', 'whiteSpace', 'opacity', 'letterSpacing', 'color',
      'margin', 'marginTop', 'marginLeft', 'marginRight', 'marginBottom'].forEach((p) => {
      el.style.removeProperty(p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    });
    el.querySelectorAll('[style]').forEach((d) => {
      d.style.removeProperty('width');
      d.style.removeProperty('white-space');
      d.style.removeProperty('font-size');
    });
  };
  const renderCap = (b) => {
    const el = b.el;
    strip(el);
    el.className = (el.className + ' case-m-cap').trim();
    el.setAttribute('data-m-reveal', '');
    col.appendChild(el);
  };

  const shotImgs = [];   // 铺满一列的大截图 / marquee 图，按真实显示宽挑档
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
    /* ---- 文本 / 章节头 / 锚点 / 图名 ---- */
    if (g.type === 'solo') {
      const b = g.b;
      const el = b.el;
      if (isAnchor(b)) { el.style.removeProperty('top'); col.appendChild(el); return; }
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

    /* ---- marquee（KOOKO 产出那种自动横向滚动）→ 保留原样，收进列宽，自动滚动照旧 ---- */
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
      (g.caps || []).forEach(renderCap);
      return;
    }

    /* ---- hscroll（画布自带的横向画廊）→ 整块内容按可读高度缩放后横滑，形式同电脑端 ---- */
    if (g.type === 'hscroll') {
      const box = g.b.el;
      const view = box.querySelector('.hscroll__view');
      // 去掉只铺了前半段的灰底板（内容比它宽，滚到后半段就没底，视觉不一致）——
      // 仅移除横滚框里 view 之外的兄弟底板，不动内容里的白卡。
      [...box.children].forEach((ch) => { if (ch !== view && !ch.classList.contains('hscroll__bar')) ch.remove(); });
      if (view) {
        view.style.overflow = 'visible';
        view.style.width = 'max-content';
        view.style.removeProperty('padding');
      }
      box.querySelectorAll('img').forEach((im) => im.removeAttribute('loading'));
      box.removeAttribute('style');
      box.style.overflow = 'visible';
      col.appendChild(makeRail(box, g.b.h, g.b.w));
      (g.caps || []).forEach(renderCap);
      return;
    }

    /* ---- 图列：保留画布相对坐标，整块等比缩到列宽（只缩不放大），图名回流到列下方 ---- */
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
    let panelBg = '';
    g.members.slice().sort((a, b) => a.dom - b.dom).forEach((b) => {
      b.el.style.top = (b.top - g.top) + 'px';
      b.el.style.left = (b.left - g.left) + 'px';
      if (!panelBg && !b.hasImg && opaqueBg(b.el)) panelBg = b.el.style.backgroundColor;
      inner.appendChild(b.el);
    });
    inner.querySelectorAll('img').forEach((im) => {
      if (!im.style.height) {
        const aw = parseFloat(im.getAttribute('width'));
        const ah = parseFloat(im.getAttribute('height'));
        if (aw && ah) im.style.aspectRatio = aw + ' / ' + ah;
      }
    });
    card.appendChild(inner);
    col.appendChild(card);
    compFigs.push({ card, inner, fw, fh, grp: g.grp, panelBg });
    (g.caps || []).forEach(renderCap);
  });

  wraps[0].parentNode.insertBefore(col, wraps[0]);
  wraps.forEach((wrap) => wrap.remove());

  /* 把拼贴/画廊里每张图的显示高度回算成素材真实比例：让盒子比例=素材比例，
     于是 object-fit:contain 既不留白也不裁切也不拉伸——完整、不变形、不被裁。
     图未加载完时先按内联宽高占位，load 后再回算（sharpen 换档也会重触发 load）。 */
  const reconcile = (img) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const w = parseFloat(img.style.width);
    if (!w) return;
    img.style.height = (w * img.naturalHeight / img.naturalWidth).toFixed(2) + 'px';
    img.style.removeProperty('aspect-ratio');
  };
  const reconcileImgs = [...col.querySelectorAll('.case-m-fig--comp img, .case-m-galsizer img')];
  reconcileImgs.forEach((img) => {
    if (img.complete) reconcile(img);
    img.addEventListener('load', () => reconcile(img));
  });

  /* ---- 5) 按真实显示宽度重挑 srcset 档（缩小=更清晰；不留放大余量：手机不用捏合） ---- */
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
    compFigs.forEach((cf) => {
      const { card, inner, fw, fh } = cf;
      const cs = Math.min(colW / fw, 1); // 纯按列宽等比缩，只缩不放大——构图与电脑端逐像素一致
      inner.style.transformOrigin = '0 0';
      inner.style.transform = 'scale(' + cs.toFixed(6) + ')';
      cf.baseH = Math.round(fh * cs);
      card.style.width = Math.round(fw * cs) + 'px';
      card.style.height = cf.baseH + 'px';
      inner.style.top = '0px';
      inner.querySelectorAll('img').forEach((img) => sharpen(img, num(img.style.width) * cs));
    });
    // 同一行拆出来的兄弟卡片：统一到最高的那张，矮的补灰底、内容竖向居中——
    // 让并排改上下后两块的灰底大小一致（如 companion intro 手机图 vs 折叠插画）。
    const byGrp = new Map();
    compFigs.forEach((cf) => { if (cf.grp) { if (!byGrp.has(cf.grp)) byGrp.set(cf.grp, []); byGrp.get(cf.grp).push(cf); } });
    byGrp.forEach((list) => {
      if (list.length < 2) return;
      const Hmax = Math.max(...list.map((cf) => cf.baseH));
      const Hmin = Math.min(...list.map((cf) => cf.baseH));
      if (Hmax / Hmin > 1.6) return; // 高度差太大（内容不对等）就别硬补灰底，各自自然高度
      list.forEach((cf) => {
        cf.card.style.height = Hmax + 'px';
        if (cf.baseH < Hmax) {
          if (cf.panelBg) cf.card.style.backgroundColor = cf.panelBg;
          cf.inner.style.top = Math.round((Hmax - cf.baseH) / 2) + 'px';
        }
      });
    });
    shotImgs.forEach((img) => {
      if (!img) return;
      const w = img.getBoundingClientRect().width;
      if (w) sharpen(img, w);
    });
    // 横向画廊：整块内容按可读高度缩放（比 kooko 那种偏大的滚动图再收一档，
    // 高度取内容真实高与画布高的较大者，避免底部被裁）
    const galH = Math.max(280, Math.min(360, (innerHeight || 720) * 0.46));
    railFigs.forEach(({ content, sizer, canvasH, canvasW, sync }) => {
      const rawW = Math.max(content.scrollWidth || 0, content.offsetWidth || 0, canvasW || 0) || 1;
      const rawH = Math.max(content.scrollHeight || 0, content.offsetHeight || 0, canvasH || 0) || galH;
      const cs = Math.min(galH / rawH, 1);
      content.style.transformOrigin = '0 0';
      content.style.transform = 'scale(' + cs.toFixed(6) + ')';
      sizer.style.width = Math.round(rawW * cs) + 'px';
      sizer.style.height = Math.round(rawH * cs) + 'px';
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

  /* ---- 6) 大图离屏卸解码：远离视口的换成 1×1 空图（先钉住宽高比，布局不跳）---- */
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
