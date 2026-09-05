#!/usr/bin/env node
/* 按滚动位置连拍。验收版式与钉住段最快的办法——比读 computed style 直观。
   用法：node tools/shots.js http://localhost:8931/case-justpaper.html /tmp/jp 8 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9700 + (process.pid % 200);

async function main(url, prefix, n) {
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--window-size=1440,900', '--hide-scrollbars',
    '--user-data-dir=/tmp/shots-' + PORT, '--enable-unsafe-swiftshader', 'about:blank'],
    { stdio: 'ignore' });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let ws = null;
  for (let i = 0; i < 40 && !ws; i++) {
    await wait(250);
    try { ws = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch (e) { /* 等 */ }
  }
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pending = new Map();
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params, sessionId) => new Promise((r) => {
    const k = ++id; pending.set(k, r);
    sock.send(JSON.stringify({ id: k, method, params, sessionId }));
  });

  const { result: t } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: a } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sid = a.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + 'v=' + PORT }, sid);
  await wait(4000);

  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        const y = Math.round(max * ${f});
        if (window.SITE && window.SITE.lenis) window.SITE.lenis.scrollTo(y, { immediate: true });
        else scrollTo(0, y);
        return y;
      })()`,
    }, sid);
    await wait(1400);                     // 等 scrub 追上、reveal 跑完
    const { result: s } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }, sid);
    const out = `${prefix}_${String(i).padStart(2, '0')}.jpg`;
    fs.writeFileSync(out, Buffer.from(s.data, 'base64'));
    console.log(out, (f * 100).toFixed(0) + '%');
  }
  sock.close(); chrome.kill();
}

main(process.argv[2], process.argv[3] || '/tmp/shot', parseInt(process.argv[4] || '8', 10))
  .catch((e) => { console.error('FAIL', e.message); process.exit(1); });
