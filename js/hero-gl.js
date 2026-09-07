/* 首屏和"关于"的 three.js 层：一层缓慢呼吸的光点。

   为什么改成这个：上一版是"把首屏那张图当贴图跑折射着色器"，两个问题——
   1. file:// 下 Chrome 把本地图片当跨域，纹理上传被拒，整层直接不出现，
      用户双击打开 index.html 时看不到任何东西；
   2. 折射位移做得很收敛，即使跑起来也几乎看不出。
   现在这一层不依赖任何贴图，纯几何：光点在一层薄板里缓慢公转，
   跟指针做视差，每组各自明暗呼吸。file:// 也能跑，而且看得见。

   挂两处，参数不同：
   - 首屏（浅底照片）96 个点，芯 0.6；亮部只能靠芯比背景亮那一点点。
   - 关于（深色带）28 个点，芯 0.45；深底上光感本来就强，同样的参数会过。
   两处各一个 WebGL context，但 IntersectionObserver 保证只有在视口里的那层在跑。

   分寸：整层压在文字下面，不接指针事件。意图是"有空气在动"，不是抢主视觉。 */
(() => {
  'use strict';

  if (typeof window.THREE === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* 位置用确定性的伪随机（正弦哈希）而不是 Math.random，这样每次加载分布一致，
     排查和截图比对才有意义。 */
  const rand = (i, salt) => {
    const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  /* 两张贴图。
     之前只有一张纯白的径向渐变，材质再给 color: MOSS —— color 是乘在贴图上的，
     所以最亮的芯也只能是苔绿（亮度约 150），压在这张平均亮度 189 的主视觉上
     比背景还暗，看上去就只是"糊了一层"，没有任何光感。
     现在把颜色烤进贴图：芯用接近白的暖白（比背景亮才叫光），色相退到外圈的晕上，
     材质 color 保持纯白，不再做那次乘法。 */
  const tex = (stops) => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.Texture(c);
    t.needsUpdate = true;
    return t;
  };
  /* 亮芯必须占贴图相当大一块，而且外圈的绿不能太重。
     第一版把白芯收在 0.12 以内，点在屏幕上只有十几像素，线性过滤把那一两个白像素
     和外面的绿平均掉了 —— 实测最亮处 207，还是比纸色 242 暗，于是又变成"一团模糊"。
     第二版亮区推到 0.42，但中圈的绿留了 0.5，纸色区上白芯和背景亮度接近、绿圈却看得见，
     每个点读成一个小甜甜圈。所以外圈的绿要一路衰下去，让"看得见"的位置就是最亮的位置。 */
  const coreTex = tex([
    [0, 'rgba(255,255,250,1)'],
    [0.3, 'rgba(253,255,242,0.9)'],
    [0.55, 'rgba(219,242,186,0.28)'],
    [0.8, 'rgba(150,196,104,0.08)'],
    [1, 'rgba(150,196,104,0)'],
  ]);
  const haloTex = tex([
    [0, 'rgba(150,196,104,0.5)'],
    [0.45, 'rgba(111,158,78,0.16)'],
    [1, 'rgba(111,158,78,0)'],
  ]);

  /* ---- 一处光点层 ------------------------------------------------------ */
  const mount = (canvas, host, cfg) => {
    if (!canvas || !host) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, alpha: true, antialias: true, powerPreference: 'low-power',
      });
    } catch (err) {
      return;                            // 没有 WebGL：这一层不出现，内容照常显示
    }
    if (!renderer.getContext()) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    const world = new THREE.Group();
    scene.add(world);

    /* 分 4 组，每组一套材质，呼吸的周期和相位都不同 —— 光感有一半来自"亮度在变"，
       静态的点无论多亮都读成污渍。PointsMaterial 的 opacity 是整层的，想让不同的点
       各自明暗只能拆组（做到逐点得写 ShaderMaterial，编译一失败整层就没了，
       首屏不值得冒那个风险）。 */
    const GROUPS = 4;
    const groups = [];
    for (let g = 0; g < GROUPS; g += 1) {
      const idx = [];
      for (let i = g; i < cfg.count; i += GROUPS) idx.push(i);  // 隔位取，四组在空间上交错
      const pos = new Float32Array(idx.length * 3);
      const drift = new Float32Array(idx.length);
      idx.forEach((i, k) => {
        const r = 3.2 + rand(i, 1) * 7.6;
        const a = rand(i, 2) * Math.PI * 2;
        pos[k * 3] = Math.cos(a) * r;
        pos[k * 3 + 1] = (rand(i, 3) - 0.5) * 9.5;
        pos[k * 3 + 2] = Math.sin(a) * r * 0.6;
        drift[k] = 0.25 + rand(i, 4) * 0.9;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const core = new THREE.PointsMaterial({
        map: coreTex, size: 0.34, sizeAttenuation: true,
        transparent: true, opacity: cfg.core, depthWrite: false,
      });
      // 晕更大更透，叠出光散开的那圈。浅底上不能用 additive，会越叠越白。
      const halo = new THREE.PointsMaterial({
        map: haloTex, size: 0.78, sizeAttenuation: true,
        transparent: true, opacity: cfg.halo, depthWrite: false,
      });
      world.add(new THREE.Points(geo, halo));  // 晕先画，芯压在它上面
      world.add(new THREE.Points(geo, core));
      groups.push({
        geo, core, halo, drift, base: pos.slice(),
        speed: 0.5 + g * 0.17, phase: g * 1.6,
      });
    }

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      /* 窄画面要把粒子场横向压进视锥里。点分布在半径 3.2–10.8 的一圈上，
         而 fov 50 在 z=14 处的可见宽度是 13.06 × aspect —— 手机上"关于"这一带
         aspect 只有 0.25，可见宽度 3.3，几乎所有点都在画面外（实测移动端一个点都没有）。
         往后拉相机会让点因为 sizeAttenuation 缩成看不见，所以改成压扁场本身。 */
      world.scale.x = Math.min(1, Math.max(0.25, camera.aspect / 0.92));
    };
    resize();
    addEventListener('resize', resize);

    // 指针视差：目标值直接更新，实际值每帧插值追上，和 Lenis 的 lerp 一个思路
    const aim = { x: 0, y: 0 };
    const eye = { x: 0, y: 0 };
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      aim.x = (e.clientX - r.left) / r.width - 0.5;
      aim.y = (e.clientY - r.top) / r.height - 0.5;
    });
    host.addEventListener('pointerleave', () => { aim.x = 0; aim.y = 0; });

    let running = false, t0 = 0;

    /* 整层的一次性渐显。three 是空闲后才注入的，第一帧渲出来就是满亮度，
       看上去是"啪一下出现"。这里用一条独立于 t0 的时间轴（t0 会在这一块重新进入
       视口时归零，用它做渐显会每次滚回来都重播一遍），只在最开始淡入一次。 */
    const FADE = 1200;
    let fadeT0 = 0;

    const frame = (now) => {
      if (!running) return;
      if (!t0) t0 = now;
      if (!fadeT0) fadeT0 = now;
      const t = (now - t0) / 1000;
      const p = Math.min(1, (now - fadeT0) / FADE);
      const fade = p * p * (3 - 2 * p);       // smoothstep：起手也是慢的，才不会有"啪"的一下

      // 粒子：整体缓慢公转 + 每颗各自的纵向漂移 + 每组各自的明暗呼吸
      world.rotation.y = t * 0.035;
      groups.forEach((gr) => {
        const arr = gr.geo.attributes.position.array;
        for (let i = 0; i < gr.drift.length; i += 1) {
          arr[i * 3 + 1] = gr.base[i * 3 + 1] + Math.sin(t * gr.drift[i] * 0.5 + i) * 0.22;
        }
        gr.geo.attributes.position.needsUpdate = true;
        // 0.575±0.425 而不是 0.45±0.55：后者谷底是 -0.1，负的不透明度没有意义
        const b = 0.575 + 0.425 * Math.sin(t * gr.speed + gr.phase);
        gr.core.opacity = cfg.core * b * fade;
        gr.halo.opacity = cfg.halo * (0.6 + 0.4 * b) * fade;   // 晕跟着芯亮，幅度小一半
      });

      eye.x += (aim.x - eye.x) * 0.055;
      eye.y += (aim.y - eye.y) * 0.055;
      camera.position.x = eye.x * 2.4;
      camera.position.y = -eye.y * 1.6;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    };

    // 滚出视口就停掉循环，别在别的几屏白烧 GPU
    new IntersectionObserver((entries) => {
      const vis = entries[0].isIntersecting;
      if (vis && !running) { running = true; t0 = 0; requestAnimationFrame(frame); }
      else if (!vis) running = false;
    }, { threshold: 0 }).observe(host);
  };

  mount(document.getElementById('heroGL'), document.querySelector('.hero'),
    { count: 96, core: 0.6, halo: 0.1 });
  mount(document.getElementById('aboutGL'), document.getElementById('about'),
    { count: 28, core: 0.45, halo: 0.08 });
})();
