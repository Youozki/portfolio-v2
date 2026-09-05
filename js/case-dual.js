/* 招牌段 · 上下双屏开合（Just Paper 专用）
   同一张设备渲染横切两条。--split 从 0 走到 1 再回到 0：进来时合着、
   停在屏中间时张开、滚走前合回去。标签只在张到一半以后浮出来。
   只写 CSS 变量，位移与缩放都在 CSS 里完成，JS 不碰 layout 属性。 */
(() => {
  'use strict';
  const S = window.SITE || {};
  const stack = document.getElementById('dualStack');
  if (!stack) return;

  if (!S.hasGsap || S.reduced) {
    stack.style.setProperty('--split', '1');
    stack.style.setProperty('--tags', '1');
    return;
  }

  const set = (p) => {
    // 0→0.42 张开，0.42→0.72 停住，0.72→1 合回去
    const open = p < 0.42 ? p / 0.42 : p > 0.72 ? 1 - (p - 0.72) / 0.28 : 1;
    const v = Math.max(0, Math.min(1, open));
    stack.style.setProperty('--split', v.toFixed(3));
    stack.style.setProperty('--tags', Math.max(0, (v - 0.45) / 0.55).toFixed(3));
  };

  ScrollTrigger.create({
    trigger: '#screens',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => set(self.progress),
  });
  set(0);

  /* 陈述层（大字在后、产品图在前）也在这页，交给共用套件驱动 */
  if (window.KIT && window.KIT.statement) window.KIT.statement();
})();
