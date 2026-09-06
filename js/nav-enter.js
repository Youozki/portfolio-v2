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

  function start() {
    const target = nav.getBoundingClientRect().width;
    let from = 0;
    try { from = parseFloat(sessionStorage.getItem(KEY)) || 0; } catch (e) { /* 隐私模式 */ }
    const store = (w) => { try { sessionStorage.setItem(KEY, String(w)); } catch (e) {} };
    store(target);
    // 中文子集落地后宽度会变，字体就绪再存一次，免得下一页从错的宽度起手
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => store(nav.getBoundingClientRect().width));
    }

    let dropDelay = 0;

    if (!reduced && glass && from > 2 && target > 2 && Math.abs(from - target) > 2) {
      // scaleX 的原点在左边缘（图标那一端），再把整条导航反向平移半个差值，
      // 于是胶囊看着是"原地两端伸缩"，图标一直贴在胶囊头上
      nav.style.setProperty('--pill-from', String(from / target));
      nav.style.setProperty('--pill-shift', ((target - from) / 2) + 'px');

      /* 必须在这里同步挂上，不能等 pagereveal / 过渡结束再挂：这个脚本跑在解析
         途中，首帧画出来的就已经是上一页的宽度，胶囊从那儿一路伸到本页宽度，是
         一条连续的动作。改成"等过渡收尾再起手"实测会弹一下——首帧先按本页宽度
         画出来（419px），过渡结束的那一刻才被压回上一页宽度（219px），再重新
         伸长，就是"先到最长、突然变短、又变长"的抽搐。 */
      nav.classList.add('is-morph');
      glass.addEventListener('animationend', () => {
        nav.classList.remove('is-morph');
        nav.style.removeProperty('--pill-from');
        nav.style.removeProperty('--pill-shift');
      }, { once: true });
    } else if (!reduced) {
      /* 没有伸缩可演的时候（首次进站、刷新、前后两页胶囊同宽）让它从上方滑下来，
         顶栏才有个"进场"，不是凭空出现。判断放在这里而不是无条件加：伸缩本身
         已经是连续动作，再叠一层下滑就是两个方向在打架。 */
      let navType = '';
      try {
        const entry = performance.getEntriesByType('navigation')[0];
        navType = entry ? entry.type : '';
      } catch (e) { /* 老浏览器没有 navigation timing */ }

      if (from <= 2 || navType === 'reload') {
        nav.classList.add('is-drop');
        nav.addEventListener('animationend', (e) => {
          // 动画带 both，跑完要撤掉，否则 .nav 自己的 transform 过渡被它压住
          if (e.target === nav) nav.classList.remove('is-drop');
        }, { once: true });
        // 起手时间写在 CSS 的 --nav-drop-delay 上，这里读出来给文字用
        dropDelay = Math.max(0, (parseFloat(getComputedStyle(nav).animationDelay) || 0) * 1000);
      }
    }

    /* 文字逐条滚上来。有下滑入场的时候等胶囊开始落位再滚，否则胶囊还在视口外
       文字就已经滚完了，落下来的是一条"早就写好"的胶囊，读不出先后。 */
    if (dropDelay) setTimeout(() => nav.classList.add('is-ready'), dropDelay);
    // 下一帧再放行，保证先落一帧初始态（文字在下面、胶囊是上一页的宽度）
    else requestAnimationFrame(() => nav.classList.add('is-ready'));
  }

  /* 预渲染（Speculation Rules）会在用户还停在上一页时就把这个文档跑完。胶囊这段
     必须等真的激活再演：提前跑的话宽度早存了、动画也演完了，人过来只剩一条已经
     到位的胶囊，等于没有动画。不支持预渲染的浏览器里 document.prerendering 是
     undefined，直接走原来的路径。 */
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', start, { once: true });
  } else {
    start();
  }
})();
