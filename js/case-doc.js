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
      const anim = track.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -half + 'px)' }],
        { duration: (half / speed) * 1000, iterations: Infinity, easing: 'linear' }
      );

      /* 离开视口就暂停，并把 will-change 撤掉。
         轨道是 4492×111 的合成层、里面 92 张图（复制过一份），动画一直跑的话滚动
         全程都在合成它——iOS 上"向下滑动时页面自己刷新"（WebContent 被 jetsam 回收）
         就有这一份压力。暂停之后它只在自己露脸的那几屏里活着。
         没有 IntersectionObserver 的浏览器保持原样，不影响。 */
      if (!('IntersectionObserver' in window)) return;
      anim.pause();
      track.style.willChange = 'auto';
      new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { track.style.willChange = 'transform'; anim.play(); }
          else { anim.pause(); track.style.willChange = 'auto'; }
        });
      }, { rootMargin: '20% 0px 20% 0px' }).observe(box);
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

  // startCanvasMotion 量完入场序列后挂上：裁段把段放回来时用它补点亮
  let wake = null;

  /* ---- 正文按"视觉行"切开 ----------------------------------------------
     切分点取的就是浏览器自己算出来的换行位置：逐字问一次 top，top 跳了就是换
     了一行。切完每行的内容宽度本来就 ≤ 容器宽度，行盒和原来一一对应，所以坐
     标、字号、行高、断行位置全都不动。画布是整幅 scale 的，缩放不改断行，
     所以量一次就够，resize 也不用重切。
     measureLines 只读不写，applyLines 才动 DOM——分开是为了整趟只有一次布局。 */
  function measureLines(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
    const range = document.createRange();
    const plan = [];
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue;
      if (text && text.trim()) {
        const cuts = [0];
        let prev = null;
        for (let i = 0; i < text.length; i += 1) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getBoundingClientRect();
          if (rect.height) {
            if (prev !== null && rect.top - prev > 1) cuts.push(i);
            prev = rect.top;
          }
        }
        cuts.push(text.length);
        plan.push({ node, cuts });
      }
      node = walker.nextNode();
    }
    return plan;
  }

  function applyLines(plan) {
    let i = 0;
    plan.forEach(({ node, cuts }) => {
      if (!node.parentNode) return;
      const frag = document.createDocumentFragment();
      for (let k = 0; k < cuts.length - 1; k += 1) {
        const line = document.createElement('span');
        line.className = 'doc-line';
        line.style.setProperty('--i', String(i));
        line.textContent = node.nodeValue.slice(cuts[k], cuts[k + 1]);
        frag.appendChild(line);
        i += 1;
      }
      node.parentNode.replaceChild(frag, node);
    });
    return i;
  }

  /* 这一段要遍历上百个节点、再读一遍位置。同步跑的话正好压在换页过渡那几百
     毫秒里（实测内页开头一个 81ms 的长任务、一帧 124ms 的空档），顶部栏和
     过渡就顿在那儿。这些元素加载时几乎都在首屏之外，等过渡走完再接管，
     看不出差别，换页却顺得多。 */
  function startCanvasMotion() {
    const PX = 10;
    const pxItems = [];

    /* 先只读一遍位置和换行点，再统一写。data-doc-reveal 是脚本后加的，加上去
       元素就掉到 opacity 0——首屏里已经露出来的那几个必须同时标成 is-in，否则
       会"先看见、再闪一下才回来"。读写分开也省掉上百次强制重排。 */
    const targets = [];
    slices.forEach((slice) => {
      [...slice.children].forEach((el) => {
        if (el.classList.contains('doc-anchor')) return;
        const r = el.getBoundingClientRect();
        /* 发丝级的元素不进入场序列。横向滚动图下面那根蓝色滚动条在手机上只有 1.1px 高，
           这种尺寸的 IntersectionObserver 判定不稳：段被 display:none 收起来再放出来之后
           它拿不到 0.04 的阈值交叉，就永久停在 opacity 0——用户报的"justpaper 滚动图
           下方蓝条消失了"就是这个。这么细的东西本来也看不出渐显，直接让它一直亮着。 */
        if (r.height && r.height < 4) return;
        const fs = parseFloat(el.style.fontSize) || 0;
        targets.push({
          el,
          seen: r.top < innerHeight && r.bottom > 0,
          head: fs >= 28,
          // 自带字号又不含图的块才是正文／小标题，按行切；mockup 里那几百个
          // 七八号小字不掺和，切了既看不出来又白花时间
          plan: fs >= 14 && fs < 28 && !el.querySelector('img') ? measureLines(el) : null,
        });
      });
    });

    targets.forEach(({ el, seen, head, plan }) => {
      /* 章节标题（Problem / Strategy / Solution / Outcome 这一层）在画布里是
         自带 30px 字号的块，正文是 20px，其余是图和容器。标题只做模糊到清晰，
         正文按行位移＋渐显，图整块位移＋渐显。 */
      let mode = head ? 'head' : '';
      if (plan && plan.length && applyLines(plan) > 0) mode = 'lines';
      el.setAttribute('data-doc-reveal', mode);

      /* 画布正文自带 opacity:0.8 这类内联值，内联优先级压过样式表里的 opacity:0，
         那些块就只位移、不渐显。把它挪到 --doc-o 上，终态回到原值，渐显才真的有。 */
      if (el.style.opacity) {
        el.style.setProperty('--doc-o', el.style.opacity);
        el.style.removeProperty('opacity');
      }

      if (seen) el.classList.add('is-in');
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

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    targets.forEach(({ el, seen }) => { if (!seen) io.observe(el); });

    /* 段被收起来再放出来之后，个别元素可能拿不到 IntersectionObserver 的阈值交叉，
       就停在 opacity 0 上（"东西不见了"）。所以裁段那边把段放回来时点一下这里，
       补一遍已经进到视口里的元素。只补进了视口的——还在视口外的留给 io，
       否则入场动画会被提前烧掉。 */
    wake = (wrap) => {
      wrap.querySelectorAll('[data-doc-reveal]:not(.is-in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    };

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

    // 行位置量完了，这时候才能开始裁段
    startCulling();
  }

  /* ---- 离屏的段不进渲染树 ------------------------------------------------
     画布的栅格化按视觉像素算，捏合放大 N 倍，同一块内容要 N² 倍贴图；内页在 iOS 上
     "放大后先自己刷新一次、再滑一下就崩"就是这么撑爆的。这里把远离可视区的段
     display:none 掉（段高写死在 wrap 上，文档高度和滚动位置都不动）。

     坐标只用两样东西：wrap 的 getBoundingClientRect() 和 visualViewport 的
     offsetTop/height——两者都是相对【布局视口】的，可以直接比。
     **不要把 window.scrollY 掺进来**：iOS 放大之后 scrollY 与 visualViewport.offsetTop
     会各自算一遍偏移，加起来就是双份，判据整体偏下，结果把正在看的那一段裁掉——
     用户报的"放大到一定程度图片和文字都消失"就是这个。

     另外留一道保险：只要 wrap 与布局视口本身有交集就绝不裁。放大时布局视口不缩小，
     所以这一条会多留一两段（栅格化省得少一点），但换来"看得见的东西一定在渲染树里"。 */
  function startCulling() {
    if (wraps.length < 2) return;
    const vv = window.visualViewport;
    let raf = 0;
    const pass = () => {
      raf = 0;
      const vh = vv ? vv.height : innerHeight;
      const vTop = vv ? vv.offsetTop : 0;
      const pad = Math.max(vh, 240);
      const lo = vTop - pad;
      const hi = vTop + vh + pad;
      // 先把位置一次读完再统一写 class：边读边写会让每个 wrap 都强制一次重排
      const rects = wraps.map((wrap) => wrap.getBoundingClientRect());
      const back = [];
      wraps.forEach((wrap, i) => {
        const r = rects[i];
        const inBand = r.bottom > lo && r.top < hi;
        const inLayout = r.bottom > 0 && r.top < innerHeight;
        const idle = !inBand && !inLayout;
        if (!idle && wrap.classList.contains('is-idle')) back.push(wrap);
        wrap.classList.toggle('is-idle', idle);
      });
      if (wake) back.forEach((wrap) => wake(wrap));
    };
    const ping = () => { if (!raf) raf = requestAnimationFrame(pass); };
    addEventListener('scroll', ping, { passive: true });
    addEventListener('resize', ping);
    if (vv) {
      vv.addEventListener('scroll', ping);
      vv.addEventListener('resize', ping);
    }
    pass();
  }

  if (slices.length && !reduced) {
    if ('requestIdleCallback' in window) requestIdleCallback(startCanvasMotion, { timeout: 700 });
    else setTimeout(startCanvasMotion, 300);
  } else {
    startCulling();
  }

  /* 图片陆续解码完会改变布局判断，等图齐了再刷一次 ScrollTrigger */
  addEventListener('load', () => {
    fit();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
})();
