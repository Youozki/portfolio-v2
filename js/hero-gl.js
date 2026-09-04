/* 首屏主视觉的着色器层。three.js 里最轻的一种用法：一个铺满的平面 + 一张贴图 +
   一段片元着色器，没有相机运动、没有模型、没有后处理链。

   为什么值得上 WebGL：这三件事 CSS 做不到——
   1. 折射式的局部位移（指针周围一小圈把画面推开），CSS filter 没有这个能力；
   2. 每帧变化的细颗粒，不是一张静态噪点贴图在那儿贴着；
   3. 边缘随滚动progressive 淡出，按 UV 距离算，不是一层渐变遮罩。

   刻意保守：位移最大 0.008 UV（1440px 上约 11px），颗粒 0.03 强度。
   主视觉本身要清楚可读，特效只是让它"活着"，不能盖过内容。

   任何一步失败（three 没加载、WebGL 不可用、贴图跨域被拒）都直接返回，
   底下的 <img> 一直在那儿，页面不受影响。file:// 打开时贴图会被 Chrome 当作
   跨域拒绝，此时就是走这条回退路径。 */
(() => {
  'use strict';

  const fig = document.getElementById('heroKey');
  const canvas = document.getElementById('heroGL');
  const img = fig && fig.querySelector('img');
  if (!fig || !canvas || !img) return;
  if (typeof window.THREE === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  const FRAG = `
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2  uRes;      // 画布像素尺寸
    uniform vec2  uTexRes;   // 贴图像素尺寸
    uniform vec2  uPointer;  // 已平滑过的指针，UV 空间
    uniform float uHover;    // 指针是否在图上，0–1
    uniform float uTime;
    uniform float uScroll;   // 0 在顶部，1 已滚过首屏

    // object-fit: cover 的 UV 换算，保证和底下那张 <img> 完全对齐
    vec2 coverUv(vec2 uv) {
      float rc = uRes.x / uRes.y;
      float rt = uTexRes.x / uTexRes.y;
      vec2 k = rc > rt ? vec2(1.0, rt / rc) : vec2(rc / rt, 1.0);
      return (uv - 0.5) * k + 0.5;
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = coverUv(vUv);

      // 1. 指针周围一圈很浅的折射：把画面朝外推开，像一层厚玻璃压在上面
      vec2 d = (vUv - uPointer) * vec2(uRes.x / uRes.y, 1.0);
      float dist = length(d);
      float lens = exp(-dist * dist * 26.0) * uHover;
      uv += normalize(d + 1e-6) * lens * 0.008;

      // 2. 极缓的整体呼吸，幅度比折射还小，只是不让画面完全静止
      uv += vec2(sin(uTime * 0.21 + vUv.y * 3.0), cos(uTime * 0.17 + vUv.x * 3.0)) * 0.0012;

      vec3 col = texture2D(uTex, uv).rgb;

      // 3. 折射圈内侧补一点亮，让"玻璃"有厚度而不是单纯位移
      col += lens * 0.05;

      // 4. 每帧变化的细颗粒。按物理像素取样，缩放时颗粒大小不变
      float g = hash(floor(vUv * uRes) + floor(uTime * 24.0));
      col += (g - 0.5) * 0.03;

      // 5. 滚动时从下沿往上淡出，把注意力交给下一段
      float fade = 1.0 - smoothstep(0.0, 1.0, uScroll) * smoothstep(0.35, 1.0, vUv.y) * 0.85;

      gl_FragColor = vec4(col, fade);
    }
  `;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false, premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
  } catch (err) {
    return;                      // WebGL 不可用，<img> 继续显示
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  const uniforms = {
    uTex: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTexRes: { value: new THREE.Vector2(2880, 1555) },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uHover: { value: 0 },
    uTime: { value: 0 },
    uScroll: { value: 0 },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true,
    })
  ));

  const resize = () => {
    const r = fig.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    uniforms.uRes.value.set(r.width * renderer.getPixelRatio(),
      r.height * renderer.getPixelRatio());
  };

  /* 滚动进度只在滚动事件里量一次，不放进每帧循环——每帧 getBoundingClientRect
     会和 GSAP 的写入交替，制造不必要的强制回流。 */
  const readScroll = () => {
    const r = fig.getBoundingClientRect();
    uniforms.uScroll.value = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  };
  const S = window.SITE;
  if (S && S.lenis) S.lenis.on('scroll', readScroll);
  else addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  // 指针：目标值直接更新，实际值每帧插值追上去，和 Lenis 的 lerp 一个思路
  const target = { x: 0.5, y: 0.5, hover: 0 };
  fig.addEventListener('pointermove', (e) => {
    const r = fig.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width;
    target.y = 1 - (e.clientY - r.top) / r.height;   // GL 的 y 朝上
    target.hover = 1;
  });
  fig.addEventListener('pointerleave', () => { target.hover = 0; });

  let running = false, t0 = 0;

  const frame = (now) => {
    if (!running) return;
    if (!t0) t0 = now;
    uniforms.uTime.value = (now - t0) / 1000;

    const p = uniforms.uPointer.value;
    p.x += (target.x - p.x) * 0.09;
    p.y += (target.y - p.y) * 0.09;
    uniforms.uHover.value += (target.hover - uniforms.uHover.value) * 0.06;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };

  // 首屏滚出视口就停掉渲染循环，别在后面几屏白烧 GPU
  const io = new IntersectionObserver((entries) => {
    const vis = entries[0].isIntersecting;
    if (vis && !running) { running = true; t0 = 0; requestAnimationFrame(frame); }
    else if (!vis) { running = false; }
  }, { threshold: 0 });

  new THREE.TextureLoader().load(
    img.currentSrc || img.src,
    (tex) => {
      // r149 里 ShaderMaterial 直接 texture2D 取样，renderer 也不做输出转换，
      // 一进一出都不转，所以不用设 encoding——设了反而会双重转换。
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      uniforms.uTex.value = tex;
      uniforms.uTexRes.value.set(tex.image.width, tex.image.height);
      resize();
      // 先渲一帧确认没有被驱动拒掉，再把 canvas 淡入、把 <img> 藏掉
      try {
        renderer.render(scene, camera);
      } catch (err) {
        return;
      }
      if (renderer.getContext().getError() !== 0) return;
      fig.classList.add('is-gl');
      canvas.style.opacity = '1';
      io.observe(fig);
    },
    undefined,
    () => { /* 贴图加载失败（file:// 跨域就是这条）：什么都不做，<img> 留着 */ }
  );

  addEventListener('resize', resize);
})();
