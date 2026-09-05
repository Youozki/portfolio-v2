/* 五个项目内页共用的动效层。
   页面脚本只负责本页专属的招牌段，凡是"每页都有"的东西都在这里：
   视差、重复吸顶章节、节点链、陈述层、粒子文字。

   两条来自实测的纪律：
   1. 幅度取小。视差 10px / 章节 42px（降级 4 / 16），这是 mandandan 的实际取值，
      也是它看着贵而不像"加了特效"的原因。
   2. 只动 transform 和 opacity。滚动里被改的一律是 CSS 变量，变量只喂给 transform，
      所以合成线程自己跑，换页头几百毫秒主线程忙也不掉帧。

   照旧写成 UMD 全局脚本，file:// 双击也要能跑；缺 gsap 就整体降级成静态可读。 */
(() => {
  'use strict';

  const S = window.SITE || {};
  const hasGsap = !!S.hasGsap;
  const reduced = !!S.reduced;
  const num = (name, el) =>
    parseFloat(getComputedStyle(el || document.documentElement).getPropertyValue(name)) || 0;

  /* ---- 展示图视差 -------------------------------------------------------
     容器 .plate 裁切，里面的图比容器高一档（CSS 里 scale 1.06），
     滚过视口时上下移 ±--px-fig。amp 从 CSS 变量读，降级档由媒体查询改，
     JS 这边不用再判断一次。 */
  function parallax(root) {
    if (!hasGsap || reduced) return;
    const amp = num('--px-fig');
    if (!amp) return;
    gsap.utils.toArray('.plate:not(.plate--flat)', root || document).forEach((plate) => {
      const media = plate.querySelector('img, video');
      if (!media) return;
      ScrollTrigger.create({
        trigger: plate,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          // progress 0→1 映射到 +amp→−amp：图先比容器低一点，滚过去后高一点
          const shift = (0.5 - self.progress) * 2 * amp;
          media.style.setProperty('--plate-shift', shift.toFixed(2) + 'px');
        },
      });
    });
  }

  /* ---- 重复吸顶章节 -----------------------------------------------------
     mandandan 的 journey-section 里同一个结构重复四次，每章文案 sticky 住、
     右边的图一屏屏滚过。进度算法照它：(视口高 − 章顶) / (章高 + 视口高)，
     再写成 --chapter-shift（42px 位移）与 --route-progress（章内进度轨）。 */
  function chapters(root) {
    if (!hasGsap) return;
    const amp = reduced ? num('--px-chapter') * 0.38 : num('--px-chapter');
    gsap.utils.toArray('.chapter', root || document).forEach((ch) => {
      const copy = ch.querySelector('.chapter__copy');
      if (!copy) return;
      ScrollTrigger.create({
        trigger: ch,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const p = self.progress;
          ch.style.setProperty('--route-progress', (p * 100).toFixed(2) + '%');
          if (!reduced) {
            copy.style.setProperty('--chapter-shift', ((0.5 - p) * amp).toFixed(2) + 'px');
          }
        },
      });
    });
  }

  /* ---- 节点链：轨道自己画出来，节点按轨道推进依次点亮 -------------------
     轨道用 scaleX（合成线程），节点只切 class。不做钉住横滚——那个开销留给
     每页真正的招牌段。 */
  function nodes(root) {
    gsap.utils.toArray('.nodes', root || document).forEach((box) => {
      const grow = box.querySelector('.nodes__track > i');
      const items = gsap.utils.toArray('.node', box);
      if (!items.length) return;
      if (!hasGsap || reduced) {
        items.forEach((n) => n.classList.add('is-on'));
        if (grow) box.style.setProperty('--track-grow', '1');
        return;
      }
      gsap.timeline({ scrollTrigger: { trigger: box, start: 'top 82%', once: true } })
        .fromTo(box, { '--track-grow': 0 },
          { '--track-grow': 1, duration: 1.1, ease: 'power1.inOut' }, 0)
        .fromTo(items, { opacity: 0.28, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out',
            stagger: { each: 1 / items.length, onStart() { this.targets()[0].classList.add('is-on'); } } },
          0.12);
    });
  }

  /* ---- 陈述层：大字与产品图两层不同速率 ---------------------------------
     augen 的做法。字往上走得慢、图往上走得快，滚过去时字从图后面漏出来。
     幅度按章节档（42px）给字，图给它的 1.6 倍——差值才是"分层"的来源。 */
  function statement(root) {
    if (!hasGsap || reduced) return;
    const amp = num('--px-chapter');
    gsap.utils.toArray('.statement', root || document).forEach((box) => {
      const type = box.querySelector('.statement__type');
      const art = box.querySelector('.statement__art');
      ScrollTrigger.create({
        trigger: box,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const d = (0.5 - self.progress) * 2;
          if (type) type.style.setProperty('--type-shift', (d * amp * 0.55).toFixed(2) + 'px');
          if (art) art.style.setProperty('--art-shift', (d * amp * 1.6).toFixed(2) + 'px');
        },
      });
      if (art) {
        gsap.fromTo(art, { '--art-zoom': 1.08, opacity: 0 },
          { '--art-zoom': 1, opacity: 1, duration: 1.1, ease: 'expo.out',
            scrollTrigger: { trigger: box, start: 'top 78%', once: true } });
      }
    });
  }

  window.KIT = { parallax, chapters, nodes, statement };
})();
