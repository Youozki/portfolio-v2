/* 首屏的 three.js 层：粒子场 + 自绘路径。

   为什么改成这个：上一版是"把首屏那张图当贴图跑折射着色器"，两个问题——
   1. file:// 下 Chrome 把本地图片当跨域，纹理上传被拒，整层直接不出现，
      用户双击打开 index.html 时看不到任何东西；
   2. 折射位移做得很收敛，即使跑起来也几乎看不出。
   现在这一层不依赖任何贴图，纯几何：
   - 约 760 个粒子在一层薄板里缓慢公转，跟指针做视差；
   - 两条路径用 drawRange 逐段画出来再擦掉，循环，作为"路径动画"；
   都是 file:// 也能跑的，而且看得见。

   分寸：粒子 1.6px、透明度 0.16，路径 1px、透明度 0.22，整层还压在文字下面。
   意图是让首屏"有空气在动"，不是抢主视觉。 */
(() => {
  'use strict';

  const canvas = document.getElementById('heroGL');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero) return;
  if (typeof window.THREE === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'low-power',
    });
  } catch (err) {
    return;                              // 没有 WebGL：这一层不出现，图照常显示
  }
  if (!renderer.getContext()) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearAlpha(0);

  // 绿色取自主视觉里那丛苔藓的中间调，比纯绿灰一点，压在纸色上不跳
  const MOSS = new THREE.Color('#6f9e4e');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const world = new THREE.Group();
  scene.add(world);

  /* ---- 粒子场 ----------------------------------------------------------
     位置用确定性的伪随机（正弦哈希）而不是 Math.random，这样每次加载分布一致，
     排查和截图比对才有意义。 */
  const COUNT = 70;
  const rand = (i, salt) => {
    const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  const pos = new Float32Array(COUNT * 3);
  const drift = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i += 1) {
    const r = 3.2 + rand(i, 1) * 7.6;
    const a = rand(i, 2) * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (rand(i, 3) - 0.5) * 9.5;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.6;
    drift[i] = 0.25 + rand(i, 4) * 0.9;
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  /* PointsMaterial 不给 map 的时候，每个点渲染出来就是一个硬边正方形——
     这是上一版"看着像撒了一把绿方块"的直接原因。这里用 canvas 画一张
     径向渐变贴图当 sprite，点才是有柔边的圆形光斑。 */
  const sprite = (() => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d').createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const ctx = c.getContext('2d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.Texture(c);
    t.needsUpdate = true;
    return t;
  })();

  const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({
    color: MOSS, map: sprite, size: 0.21, sizeAttenuation: true,
    transparent: true, opacity: 0.25, depthWrite: false,
  }));
  world.add(dots);
  // 第二层更大更透，叠出"微光"的晕。浅底上不能用 additive，会越叠越白。
  const halo = new THREE.Points(dotGeo, new THREE.PointsMaterial({
    color: MOSS, map: sprite, size: 0.55, sizeAttenuation: true,
    transparent: true, opacity: 0.05, depthWrite: false,
  }));
  world.add(halo);

  const resize = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  // 指针视差：目标值直接更新，实际值每帧插值追上，和 Lenis 的 lerp 一个思路
  const aim = { x: 0, y: 0 };
  const eye = { x: 0, y: 0 };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    aim.x = (e.clientX - r.left) / r.width - 0.5;
    aim.y = (e.clientY - r.top) / r.height - 0.5;
  });
  hero.addEventListener('pointerleave', () => { aim.x = 0; aim.y = 0; });

  let running = false, t0 = 0;
  const base = pos.slice();

  const frame = (now) => {
    if (!running) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;

    // 粒子：整体缓慢公转 + 每颗各自的纵向漂移
    world.rotation.y = t * 0.035;
    const arr = dotGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i += 1) {
      arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * drift[i] * 0.5 + i) * 0.22;
    }
    dotGeo.attributes.position.needsUpdate = true;

    eye.x += (aim.x - eye.x) * 0.055;
    eye.y += (aim.y - eye.y) * 0.055;
    camera.position.x = eye.x * 2.4;
    camera.position.y = -eye.y * 1.6;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };

  // 首屏滚出视口就停掉循环，别在后面几屏白烧 GPU
  new IntersectionObserver((entries) => {
    const vis = entries[0].isIntersecting;
    if (vis && !running) { running = true; t0 = 0; requestAnimationFrame(frame); }
    else if (!vis) running = false;
  }, { threshold: 0 }).observe(hero);
})();
