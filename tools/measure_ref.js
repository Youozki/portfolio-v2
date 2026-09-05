#!/usr/bin/env node
/* 参考站实测器。HANDOFF 的规矩是「别再自己猜」——字阶与配色上一轮已经量过并落进
   tokens.css，这一轮量的是当时没量的那层：图片容器的规格、章与章之间的纵向节奏、
   以及滚动时元素实际被改的属性和时长曲线。

   用法：node tools/measure_ref.js https://augen.pro/
   依赖：本机 Chrome + Node 内建 WebSocket（v22+），不需要 puppeteer。 */
'use strict';
const { spawn } = require('child_process');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333 + (process.pid % 200);

const probe = `(() => {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const uniq = (a) => [...new Set(a)];
  const cls = (el) => (typeof el.className === 'string' && el.className.trim())
    ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';

  /* --- 图片容器：圆角、画幅、是否满幅、是否被裁 ------------------------ */
  const imgs = [...document.querySelectorAll('img, video, canvas')]
    .filter((el) => el.getBoundingClientRect().width > 80)
    .slice(0, 40).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const p = el.parentElement ? getComputedStyle(el.parentElement) : {};
      return {
        tag: el.tagName, w: px(r.width), h: px(r.height),
        ratio: Math.round((r.width / Math.max(1, r.height)) * 1000) / 1000,
        vwPct: Math.round((r.width / innerWidth) * 100),
        radius: cs.borderRadius, fit: cs.objectFit,
        filter: cs.filter === 'none' ? '' : cs.filter,
        parentRadius: p.borderRadius, parentOverflow: p.overflow,
        transform: cs.transform === 'none' ? '' : cs.transform,
      };
    });

  /* --- 纵向节奏：顶层块的高度与上下内边距 ------------------------------ */
  const roots = [...document.querySelectorAll('body > *, main > *, body > div > *')]
    .filter((el) => el.getBoundingClientRect().height > 200)
    .slice(0, 30).map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        sel: el.tagName.toLowerCase() + cls(el),
        h: px(r.height), vh: Math.round((r.height / innerHeight) * 100),
        padTop: cs.paddingTop, padBottom: cs.paddingBottom,
        bg: cs.backgroundColor, position: cs.position,
      };
    });

  /* --- 内容栏宽度：出现频次最高的几个实际渲染宽度 ---------------------- */
  const widths = {};
  [...document.querySelectorAll('div, section, main, header, footer')].forEach((el) => {
    const w = Math.round(el.getBoundingClientRect().width);
    if (w > 400 && w < innerWidth) widths[w] = (widths[w] || 0) + 1;
  });
  const colWidths = Object.entries(widths).sort((a, b) => b[1] - a[1]).slice(0, 8);

  /* --- 动效：从样式表里刮出时长与缓动，看它真实用的那几条曲线 ---------- */
  const durs = [], eases = [], props = [], keyframes = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const rule of rules || []) {
      if (rule.type === 7) { keyframes.push(rule.name); continue; }
      const s = rule.style; if (!s) continue;
      if (s.transitionDuration) durs.push(s.transitionDuration);
      if (s.animationDuration) durs.push(s.animationDuration);
      if (s.transitionTimingFunction) eases.push(s.transitionTimingFunction);
      if (s.animationTimingFunction) eases.push(s.animationTimingFunction);
      if (s.transitionProperty) props.push(s.transitionProperty);
    }
  }

  const libs = Object.keys(window).filter((k) =>
    /^(gsap|ScrollTrigger|Lenis|lenis|locomotive|SplitType|Swiper|THREE|barba|Splitting)$/i.test(k));

  /* --- 粘性／固定元素：钉住段落的实际参数 ------------------------------ */
  const stickies = [...document.querySelectorAll('*')].filter((el) => {
    const p = getComputedStyle(el).position; return p === 'sticky' || p === 'fixed';
  }).slice(0, 20).map((el) => {
    const cs = getComputedStyle(el);
    return { sel: el.tagName.toLowerCase() + cls(el), position: cs.position, top: cs.top,
      h: px(el.getBoundingClientRect().height),
      backdrop: cs.backdropFilter === 'none' ? '' : cs.backdropFilter, z: cs.zIndex };
  });

  return {
    url: location.href, vw: innerWidth, docH: document.documentElement.scrollHeight,
    screens: Math.round(document.documentElement.scrollHeight / innerHeight * 10) / 10,
    imgs, roots, colWidths, stickies, libs,
    durs: uniq(durs).slice(0, 24), eases: uniq(eases).slice(0, 16),
    props: uniq(props).slice(0, 16), keyframes: uniq(keyframes).slice(0, 20),
  };
})()`;

async function cdp(url) {
  const args = ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
    '--window-size=1440,900', '--hide-scrollbars', '--user-data-dir=/tmp/cdp-' + PORT,
    '--enable-unsafe-swiftshader', 'about:blank'];
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  let ws = null;
  for (let i = 0; i < 40 && !ws; i++) {
    await wait(250);
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      ws = v.webSocketDebuggerUrl;
    } catch (e) { /* 还没起来 */ }
  }
  if (!ws) { chrome.kill(); throw new Error('Chrome 没起来'); }

  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pending = new Map();
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params, sessionId) => new Promise((r) => {
    const n = ++id; pending.set(n, r);
    sock.send(JSON.stringify({ id: n, method, params, sessionId }));
  });

  const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: a } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sid = a.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await send('Page.navigate', { url }, sid);
  await wait(8000);                                  // 等字体、图片和首屏动画落定
  // 滚到中段再量一次，拿到进入视口后才生效的 transform
  await send('Runtime.evaluate', { expression: 'scrollTo(0, innerHeight * 1.5)' }, sid);
  await wait(3000);
  const { result: r } = await send('Runtime.evaluate',
    { expression: probe, returnByValue: true }, sid);

  sock.close(); chrome.kill();
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

cdp(process.argv[2] || 'https://augen.pro/')
  .then((v) => console.log(JSON.stringify(v, null, 1)))
  .catch((e) => { console.error('FAIL', e.message); process.exit(1); });
