#!/usr/bin/env node
/* 页面自检器。跑 localhost（跨文档 View Transition 必须同源 http，file:// 下是硬切），
   报三样东西：控制台报错、关键元素的实测尺寸、以及可选截图。

   用法：
     python3 -m http.server 8931 --directory "<项目目录>" &
     node tools/verify.js http://localhost:8931/index.html
     node tools/verify.js http://localhost:8931/case-companion.html --shot /tmp/a.png

   Chrome 的持久 profile 缓存很凶，脚本自己会在 URL 后挂 ?v=<随机>。 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9500 + (process.pid % 300);

const probe = `(() => {
  const px = (v) => Math.round(v * 100) / 100;
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: px(r.width), h: px(r.height), fs: cs.fontSize, fw: cs.fontWeight,
      radius: cs.borderRadius, color: cs.color, bg: cs.backgroundColor };
  };
  const vars = {};
  const rs = getComputedStyle(document.documentElement);
  ['--paper','--ink','--accent','--page-max','--space-5xl','--space-6xl','--space-7xl',
   '--band-pad','--act-pad','--tier-wide','--tier-text','--tier-narrow',
   '--px-fig','--px-chapter','--chapter-top'].forEach((k) => {
     vars[k] = rs.getPropertyValue(k).trim();
   });
  const imgs = [...document.querySelectorAll('img')];
  return {
    title: document.title,
    docH: document.documentElement.scrollHeight,
    screens: px(document.documentElement.scrollHeight / innerHeight),
    vars,
    imgTotal: imgs.length,
    imgBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
    imgRadii: [...new Set(imgs.map((i) => getComputedStyle(i).borderRadius))],
    nav: box('.nav'),
    h1: box('h1'),
    page: box('.page'),
    hasKit: !!document.querySelector('link[href*="kit.css"]'),
    plates: document.querySelectorAll('.plate').length,
    chapters: document.querySelectorAll('.chapter').length,
    stIssues: (window.ScrollTrigger ? ScrollTrigger.getAll().length : -1),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1
      ? document.documentElement.scrollWidth : 0,
  };
})()`;

async function run(url, shot) {
  const args = ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
    '--window-size=1440,900', '--hide-scrollbars', '--user-data-dir=/tmp/vfy-' + PORT,
    '--enable-unsafe-swiftshader', 'about:blank'];
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  let ws = null;
  for (let i = 0; i < 40 && !ws; i++) {
    await wait(250);
    try { ws = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch (e) { /* 还没起来 */ }
  }
  if (!ws) { chrome.kill(); throw new Error('Chrome 没起来'); }

  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pending = new Map(); const logs = [];
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled' && /error|warn/i.test(m.params.type)) {
      logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value || a.description).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception || {}).description);
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      logs.push('LOG: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    }
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
  await send('Log.enable', {}, sid);
  const bust = url + (url.includes('?') ? '&' : '?') + 'v=' + PORT + id;
  await send('Page.navigate', { url: bust }, sid);
  await wait(4500);

  const { result: r } = await send('Runtime.evaluate', { expression: probe, returnByValue: true }, sid);
  let out = r.result && r.result.value;
  if (r.exceptionDetails) out = { probeFailed: JSON.stringify(r.exceptionDetails).slice(0, 400) };

  if (shot) {
    const { result: s } = await send('Page.captureScreenshot', { format: 'png' }, sid);
    fs.writeFileSync(shot, Buffer.from(s.data, 'base64'));
  }
  sock.close(); chrome.kill();
  return { url: bust, console: logs, ...out };
}

const shotIdx = process.argv.indexOf('--shot');
run(process.argv[2], shotIdx > -1 ? process.argv[shotIdx + 1] : null)
  .then((v) => console.log(JSON.stringify(v, null, 1)))
  .catch((e) => { console.error('FAIL', e.message); process.exit(1); });
