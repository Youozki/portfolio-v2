/* Just Paper 项目页。
   页面骨架与共用原语在 base / case / kit 里，这里只做两件事：
   一、把三张"纯文字排出来的板"用数据重新渲染成真 HTML——色板、中性阶、字阶、
       交互对照表。所有数值和字串都是从 Figma 原板上逐格读出来的，没有编。
   二、本页的招牌段：上下双屏开合。

   数据集中放在文件头部，方便回头跟原板对账。 */
(() => {
  'use strict';

  const S = window.SITE || {};
  const K = window.KIT || {};
  const { hasGsap, reduced } = S;

  /* ==== 数据 ============================================================ */

  /* 主色与辅助色。名字来自 Colors 板，色值是从原图对应色块上取的像素值。 */
  const THEME = [
    ['Purple Potion', '#660A49', 'Theme Color'],
    ['Track Point Red', '#CB131B', 'Secondary'],
    ['Green', '#358A44', 'Secondary'],
    ['Blue', '#3472B9', 'Secondary'],
  ];

  /* 中性 11 阶。两套各三行：档位 / 角色 / 纯色值。角色名只有部分档位有，
     原板上没写的就留空——不要自己补。 */
  const RAMPS = [
    {
      name: 'Dark Mode', on: '#FFFFFF',
      steps: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      roles: ['Background', '', 'Label Default', '', '分割线', 'Label Selected Popover',
        'Selected Highlight', 'Tertiary', 'Secondary', 'Primary', 'On Primary'],
      solid: ['#121212', '#181818', '#1E1E1E', '#252525', '#2E2E2E', '#383838',
        '#4D4D4D', '#8F8F8F', '#CDCDCD', '#F2F2F2', '#FFFFFF'],
      alpha: ['0.07', '0.09', '0.11', '0.13', '0.15', '0.2', '0.30', '0.5', '0.75', '0.90', ''],
    },
    {
      name: 'Light Mode', on: '#000000',
      steps: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      roles: ['On Primary', '', '', '', '', '', 'Tertiary', '', 'Secondary', '', 'Primary'],
      solid: ['#FFFFFF', '#F8F8F8', '#F2F2F2', '#EBEBEB', '#E3E3E3', '#C4C4C4',
        '#969696', '#646464', '#3D3D3D', '#1F1F1F', '#000000'],
      alpha: ['', '0.03', '0.05', '0.08', '0.11', '0.23', '0.41', '0.60', '0.76', '0.83', ''],
    },
  ];

  /* 字阶。11 行，样张就是原板上那句 "Almost before we knew it..."。 */
  const SPECIMEN = 'Almost before we knew it, we had left the ground.';
  const TYPE = [
    ['Header1', 'Bold', 24], ['Title1', 'Semibold', 24], ['Header2', 'Bold', 20],
    ['Body Large', 'Regular', 20], ['Title2', 'Semibold', 20], ['Title3', 'Semibold', 18],
    ['Subtitle1', 'Semibold', 16], ['Dialogue', 'Regular', 16], ['Subtitle2', 'Semibold', 14],
    ['Body Content', 'Regular', 14], ['Caption', 'Regular', 12],
  ];

  /* 交互对照表。列：鼠标键盘 / 手指 / 笔 / 触控板（表头的 Touchapd 是原稿的拼法，照抄）。
     每格可能有多条手势，用数组。单独一个 '/' 表示这种输入做不到。 */
  const IX_COLS = ['Mouse/keyboard', 'Fingers', 'Pen', 'Touchapd'];
  const IX = [
    ['Move canvas', ['“Space” Key+drag'], ['two fingers move'], ['/'], ['“Space” Key+drag', 'two fingers move']],
    ['Multi Selected', ['Box selection', 'shift+click', 'pressing files'], ['Box selection', 'pressing files'],
      ['Box selection', 'pressing files'], ['Box selection', 'shift+click', 'pressing files']],
    ['Enter Canvas', ['Double click files'], ['Double tap files'], ['Double tap files'], ['Double click files']],
    ['Selected', ['click file'], ['tap file'], ['tap file'], ['click file']],
    ['Edit/Write', ['right click-menu-edit', 'hover+icon'], ['Selected→ tap icon'],
      ['Selected→ tap icon'], ['right click-menu-edit', 'hover+icon']],
    ['Create files', ['click button', 'dragging button', 'Empty space-right click-menu'],
      ['tap button', 'dragging button', 'Double tap empty space-menu'],
      ['tap button', 'dragging button', 'Double tap empty space-menu'],
      ['click button', 'dragging button', 'Empty space-right click-menu']],
    ['Move files', ['press+drag'], ['press+drag'], ['press+drag'], ['press+drag']],
    ['Switch page', ['swipe right/left', 'hover+icon'], ['swipe right/left', 'Selected→ tap icon'],
      ['swipe right/left', 'Selected→ tap icon'], ['swipe right/left', 'hover+icon']],
    ['Create folders', ['Empty space-right click-menu'], ['Double tap empty space-menu'],
      ['Double tap empty space-menu'], ['Empty space-right click-menu']],
    ['Move to folder', ['Right click-menu-move'], ['two finger tap-menu-move'], ['/'], ['Right click-menu-move']],
    ['Move to drawer', ['Right click-menu-move'], ['two finger tap-menu-move'], ['/'], ['Right click-menu-move']],
    ['Merge Files/Folder（pop up）', ['press+drag'], ['press+drag'], ['press+drag'], ['press+drag']],
    ['Zoom in/out', ['mouse wheel', 'Click slider'], ['pinch'], ['Tap slider'], ['pinch']],
    ['Delete', ['Right click-menu-delete', 'press+drag-trash can'], ['drag-trash can', 'two finger tap-menu-delete'],
      ['drag-trash can', 'two finger tap-menu-delete'], ['Right click-menu-delete', 'press+drag-trash can']],
    ['Rename', ['Click- title area'], ['Double tap- title area'], ['Double tap- title area'], ['Click- title area']],
  ];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ==== 渲染 ============================================================ */
  const box = document.getElementById('themeColors');
  if (box) {
    box.innerHTML = THEME.map(([name, hex, role]) => `<div class="swatch">
  <i style="--c: ${hex}"></i>
  <b>${esc(name)}</b>
  <span>${hex} · ${esc(role)}</span>
</div>`).join('');
  }

  const ramps = document.getElementById('neutralRamps');
  if (ramps) {
    ramps.innerHTML = RAMPS.map((r) => `<div class="ramp">
  <div class="ramp__head"><span class="t-lead">${esc(r.name)}</span>
    <span class="t-cap">透明度基色 ${r.on}</span></div>
  <div class="ramp__row">${r.steps.map((step, i) => `<div class="ramp__cell">
    <i style="--c: ${r.solid[i]}"></i>
    <b>${step}</b>
    <span>${r.solid[i]}</span>
    ${r.alpha[i] ? `<span>${r.on} · ${r.alpha[i]}</span>` : ''}
    ${r.roles[i] ? `<em>${esc(r.roles[i])}</em>` : ''}
  </div>`).join('')}</div>
</div>`).join('');
  }

  const ladder = document.getElementById('typeLadder');
  if (ladder) {
    ladder.innerHTML = TYPE.map(([role, weight, size]) => `<div class="ladder__row">
  <span class="ladder__meta">${esc(role)}<br />${esc(weight)} · ${size}px</span>
  <span class="ladder__spec" style="--s: ${size}px">${esc(SPECIMEN)}</span>
</div>`).join('');
  }

  const table = document.getElementById('ixMatrix');
  if (table) {
    const cell = (list) => {
      const na = list.length === 1 && list[0] === '/';
      return `<td class="${na ? 'is-na' : ''}">${na ? '/'
        : `<ul>${list.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`}</td>`;
    };
    table.innerHTML = `<thead><tr><th scope="col">/</th>${IX_COLS
      .map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${IX.map((row) => `<tr><th scope="row">${esc(row[0])}</th>${row.slice(1)
      .map(cell).join('')}</tr>`).join('')}</tbody>`;
  }

  /* ==== 页面通用收尾 ==================================================== */
  S.revealAll && S.revealAll();
  S.navInvert && S.navInvert();

  const bar = document.querySelector('#progress > span');
  if (bar && hasGsap && !reduced) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.25 },
    });
  }

  if (hasGsap) {
    const links = [...document.querySelectorAll('.nav__link')];
    links.forEach((a) => {
      const sec = document.querySelector(a.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 45%', end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((l) => l.removeAttribute('aria-current'));
          a.setAttribute('aria-current', 'true');
        },
      });
    });
  }

  /* ==== 招牌段 · 上下双屏开合 ============================================
     同一张设备渲染横切两条。--split 从 0 走到 1 再回到 0：进来时合着、
     停在屏中间时张开、滚走前合回去。标签只在张到一半以后浮出来。
     只写 CSS 变量，位移与缩放都在 CSS 里完成，JS 不碰 layout 属性。 */
  function dual() {
    const stack = document.getElementById('dualStack');
    if (!stack) return;
    if (!hasGsap || reduced) {
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
      trigger: '#screens', start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => set(self.progress),
    });
    set(0);
  }

  dual();
  K.parallax && K.parallax();
  K.nodes && K.nodes();
  K.chapters && K.chapters();
  window.PT && window.PT.init();

  if (hasGsap) ScrollTrigger.refresh();
})();
