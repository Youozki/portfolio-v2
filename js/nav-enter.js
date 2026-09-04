/* 导航换页动作的引子。单独一个小文件、紧跟在 <nav> 后面同步执行，
   目的就是"早"：胶囊的伸缩必须在首帧就开始，不能等 gsap / lenis / 内页脚本
   解析完——实测那批脚本会先占掉一百多毫秒主线程，动画晚一百多毫秒起手，
   看上去就是"先硬切一下、然后才动"。
   这里只做三件事：量宽度、把上一页的宽度比写进 CSS 变量、开动画。
   动画本体是 CSS 的 transform 关键帧（见 base.css），跑在合成线程上。 */
(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const nav = document.getElementById('nav');
  if (!nav) return;
  const glass = nav.querySelector('.nav__glass');
  const KEY = 'nav:pill-w';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const target = nav.getBoundingClientRect().width;
  let from = 0;
  try { from = parseFloat(sessionStorage.getItem(KEY)) || 0; } catch (e) { /* 隐私模式 */ }
  const store = (w) => { try { sessionStorage.setItem(KEY, String(w)); } catch (e) {} };
  store(target);
  // 中文子集落地后宽度会变，字体就绪再存一次，免得下一页从错的宽度起手
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => store(nav.getBoundingClientRect().width));
  }

  if (!reduced && glass && from > 2 && target > 2 && Math.abs(from - target) > 2) {
    // scaleX 的原点在左边缘（图标那一端），再把整条导航反向平移半个差值，
    // 于是胶囊看着是"原地两端伸缩"，图标一直贴在胶囊头上
    nav.style.setProperty('--pill-from', String(from / target));
    nav.style.setProperty('--pill-shift', ((target - from) / 2) + 'px');
    nav.classList.add('is-morph');
    glass.addEventListener('animationend', () => {
      nav.classList.remove('is-morph');
      nav.style.removeProperty('--pill-from');
      nav.style.removeProperty('--pill-shift');
    }, { once: true });
  }

  // 下一帧再放行，保证先落一帧初始态（文字在下面、胶囊是上一页的宽度）
  requestAnimationFrame(() => nav.classList.add('is-ready'));
})();
