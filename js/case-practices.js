/* Practices · 瀑布流 + 详情层
   内容与第一版一致：15 张作品，标签与标题逐字照抄，点开后是同一张详情图。

   不做无限循环了：15 张各出现一次，走正常页面滚动。之前每列都塞了整套再复制，
   同一张图会在一屏里反复出现，堆在一起不好看。 */
(() => {
  'use strict';

  const DIR = 'assets/cases/practices/';
  const ITEMS = [
    { art: 'card_01.webp', shot: 'detail_01.webp', tag: 'UI', title: '百度AI学UI稿' },
    { art: 'card_02.webp', shot: 'detail_02.webp', tag: '建模', title: 'Stone' },
    { art: 'card_03.webp', shot: 'detail_03.webp', tag: '动画', title: 'Keyboard Animation' },
    { art: 'card_04.webp', shot: 'detail_04.webp', tag: '动画', title: 'Page Animation' },
    { art: 'card_05.webp', shot: 'detail_05.webp', tag: '动画', title: 'Spark' },
    { art: 'card_06.webp', shot: 'detail_06.webp', tag: '动画', title: 'Boom' },
    { art: 'card_07.webp', shot: 'detail_07.webp', tag: '动画', title: 'Information Visualization' },
    { art: 'card_08.webp', shot: 'detail_08.webp', tag: 'UI', title: 'APP UI' },
    { art: 'card_09.webp', shot: 'detail_09.webp', tag: '动画', title: 'Character Animation' },
    { art: 'card_10.webp', shot: 'detail_10.webp', tag: '动画', title: 'Interstellar teleportation portal' },
    { art: 'card_11.webp', shot: 'detail_11.webp', tag: '手绘', title: '原神同人手绘图' },
    { art: 'card_12.webp', shot: 'detail_12.webp', tag: '动画', title: 'Car Animation' },
    { art: 'card_13.webp', shot: 'detail_13.webp', tag: '建模', title: 'Astronaut' },
    { art: 'card_14.webp', shot: 'detail_14.webp', tag: '建模', title: 'Character Animation' },
    { art: 'card_15.webp', shot: 'detail_15.webp', tag: '动画', title: 'IBM–BUCK' },
  ];

  /* 列宽刻意不等：素材都是方图，等宽列排下来每行都会对齐，看着是网格；
     宽度一错开，方图高度跟着错开，瀑布的纵向节奏就出来了，而且不用裁图。 */
  const COL_W = [1.12, 0.9, 1.06, 0.94];

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wall = document.getElementById('wall');
  const colsBox = document.getElementById('wallCols');
  const detail = document.getElementById('pdetail');
  if (!wall || !colsBox || !detail) return;

  /* ---- 建列 ------------------------------------------------------------
     列数按视口宽定（4 / 3 / 2），断点变了才重排一次。每张图只出现一次，
     所以列数变化时必须整体重新分配，不能靠 CSS 藏掉某几列。 */
  const cells = [];
  let colCount = 0;

  function pickCount() {
    if (innerWidth < 640) return 2;
    if (innerWidth < 1080) return 3;
    return 4;
  }

  function layout() {
    const n = pickCount();
    if (n === colCount) return;
    colCount = n;
    colsBox.innerHTML = '';
    cells.length = 0;

    const cols = COL_W.slice(0, n).map((w) => {
      const el = document.createElement('div');
      el.className = 'wall__col';
      el.style.setProperty('--w', w);
      colsBox.appendChild(el);
      return { el, w, h: 0 };
    });

    ITEMS.forEach((item, idx) => {
      // 谁最短就往谁那放。素材全是方图，所以一格的高度就等于该列的宽度，
      // 累加的是列宽本身。（原来累加 1/w 是反的：越宽的列被当成越矮，
      // 结果窄列排得最少，四列底边差出五百多像素。）
      const c = cols.reduce((a, b) => (a.h <= b.h ? a : b));
      const d = document.createElement('div');
      d.className = 'wall__cell';
      d.dataset.i = idx;
      d.innerHTML = '<img src="' + DIR + item.art + '" alt="' + item.title +
        '" width="930" height="930" decoding="async" loading="lazy" />' +
        '<span class="wall__tag">' + item.tag + '</span>';
      c.el.appendChild(d);
      c.h += c.w;
      cells.push(d);
    });

    reveal();
  }

  /* ---- 入场：和全站同一套（opacity + blur + 上移），进视口一次就点亮 ---- */
  let io = null;
  function reveal() {
    if (reduced) return;
    if (io) io.disconnect();
    io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.remove('is-pending');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    cells.forEach((el) => {
      el.classList.add('is-pending');
      io.observe(el);
    });
  }

  layout();
  addEventListener('resize', layout);

  /* ---- 详情 ------------------------------------------------------------
     点开时：以被点的那张为圆心，周围的图按距离往外推（越近推得越多），
     整片图墙模糊压暗后退，详情图在原地渐显。三件事同一条缓动、同时发生。 */
  const shot = detail.querySelector('.pdetail__shot');
  let open = false;

  function spread(from) {
    if (reduced) return;
    const r0 = from.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    cells.forEach((el) => {
      if (el === from) {
        el.style.setProperty('--s', '0.96');
        return;
      }
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx;
      const dy = r.top + r.height / 2 - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // 近处推得多、远处几乎不动
      const amt = 64 / (1 + dist / 260);
      el.style.setProperty('--dx', (dx / dist * amt).toFixed(2) + 'px');
      el.style.setProperty('--dy', (dy / dist * amt).toFixed(2) + 'px');
    });
  }

  function collapse() {
    cells.forEach((el) => {
      el.style.removeProperty('--dx');
      el.style.removeProperty('--dy');
      el.style.removeProperty('--s');
    });
  }

  function openDetail(i, from) {
    const it = ITEMS[i];
    if (!it) return;
    open = true;
    shot.src = DIR + it.shot;
    shot.alt = it.title;
    detail.querySelector('.pdetail__card').setAttribute('aria-label', it.title);
    spread(from);
    wall.classList.add('is-detail');
    detail.classList.add('is-open');
    detail.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-detail-open');
  }

  function closeDetail() {
    if (!open) return;
    open = false;
    collapse();
    wall.classList.remove('is-detail');
    detail.classList.remove('is-open');
    detail.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-detail-open');
  }

  colsBox.addEventListener('click', (e) => {
    const el = e.target.closest('.wall__cell');
    if (!el) return;
    openDetail(Number(el.dataset.i), el);
  });
  // 详情开着时，点图以外的任何地方都退出（右上角的叉号已按要求去掉）
  detail.addEventListener('click', (e) => {
    if (e.target.closest('.pdetail__card')) return;
    closeDetail();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
})();
