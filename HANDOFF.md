# portfolio-v2 交接文档

给新对话窗口用。工作目录 `/Users/zhucy/ComateProjects/Default Project/portfolio-v2`，
远端 `git@github.com:Youozki/portfolio-v2.git`（main）。

> 2026-09-05 更新：五个内页与首页已全部完成，§4 的字阶和 §8 的进度都按当前代码重写过。
> 换机器迁移看迁移包里的《新机器上手说明.md》。

## 1. 这是什么

朱晨宇（UX 设计师）的作品集第二版。第一版被设计 leader 判为「视觉效果太普通」，
所以第二版重点是**视觉与动效要够高级、够前卫**，内容基本沿用第一版。

参考站（按用户强调的频次排序）：

- **augen.pro —— 最重要，用户反复要求"去提取它的设计规范"，而不是凭感觉设计**
- mandandan.cn（光点、无限漂移带）
- aave.org、apple.com/macbook-neo、geniestudio.app

## 2. 硬约束（不可协商）

- **简历/设计内容不得造假、不得改写**。文案一律来自第一版正文或用户给的 Figma 节点。
  设计稿里有、导出图里没有的部分，**要把缺口列给用户，不许自己编**（Strategy 那段就是这么处理的）。
- 不用手写体、不用衬线体。
- **滚动叙事在单个项目内页里**，项目之间必须能直达，不要串成全站一条线。
- 遇到不理解的设计点**必须先和用户讨论**，并反复对照参考站，不要自己乱改。
- 每做完一个页面，调用 `/impeccable` + GSAP 工具做一轮视觉与动效强化，「太平了就让它大胆点」。

## 3. 技术底盘

- 纯静态站，无构建步骤，全部 UMD 全局脚本，`file://` 双击也要能跑（功能降级可以，报错不行）。
- 本地 vendor：`gsap.min.js`、`ScrollTrigger.min.js`、`SplitText.min.js`、`CustomEase.min.js`、
  `lenis.min.js`、`three.min.js`（**r149 UMD；r169 只发 ESM，`file://` 下加载不了，别升级**）。
- Lenis 是唯一滚动权威，接到 GSAP ticker 上；**`lerp: 0.12`，不要用 `duration`**
  （duration 模式每次滚轮都跑一条定长补间，手感就是拖尾）。
- 中文用两个静态实例（思源黑 wght 300 / 365）映射到 CSS 300/400，和 Geist 视觉对齐；
  子集脚本 `tools/subset_cn.py`。

## 4. 设计系统（`css/tokens.css`，数值来自对 augen.pro 的 CDP 实测，别再自己猜）

字阶经过两轮收缩，**当前值就是定稿，不要再放大**：

- `--text-statement` clamp(2.75rem, 7.5vw, 6.75rem)（44→108）：全站只出现一次，
  是压在产品图上的那句陈述，不是页面标题。
- `--text-h1` clamp(1.375rem, 2vw, 1.8125rem)（22→29）、`--text-h2` clamp(1.125rem, 1.39vw, 1.25rem)（18→20）、
  `--text-lg` 15→16、`--text-base` 14、`--text-sm` 13、`--text-xs` 12。
- 字重只有两档：`--weight-display: 300` / `--weight-text: 400`
  （这两个变量以前只被引用、从未定义，display 一直静默按 400 渲染，已修）。
- 字距：除 statement 是 +0.008em，其余一律 −0.02em。行高：中文正文 1.55（`--leading-cn`），英文 1.45。
- 版心 `--page-max: 960px`（1440 下内容宽约 770，占 53%）；`--margin: clamp(1.25rem, 6.6vw, 6rem)`。
- 颜色：paper `#EDEDEA` / ink `#0E0F11` / accent `#0071E3`；发丝线 `--hair: rgba(14,15,17,.11)`，
  深底 `--hair-on-ink: rgba(242,242,244,.1)`。
- 形状：胶囊半径 54 / 94px，发丝线 1px。缓动 `--ease-out: cubic-bezier(.16,1,.3,1)`。

## 5. 文件地图

- `index.html` — 首屏整屏主视觉（`assets/graphics/hero-key.webp`，来自 IMG_7739）+ 左下角文案；
  段序：hero(paper) → about(**ink**) → work(paper) → interlude(ink) → contact(accent)。
  three.js 用 `requestIdleCallback` 空闲注入，**不要改回 defer**（会吃掉换页首帧预算）。
- `case-companion.html` — 项目一，五幕，序号 `1` / `1.1–1.5`。含从 Figma 节点 `4218:4925`
  逐字转录的设计策略段（七阶段推演线 + 体验地图）、10 个媒体奖项 logo、2×2 情绪图。
- `css/tokens.css` / `base.css`（共用 + 导航 + 换页）/ `index.css` / `case.css`
- `js/site.js`（Lenis、入场 reveal、`window.SITE`）、`js/nav-enter.js`（导航入场，**必须紧跟 `<nav>` 同步执行**）、
  `js/index.js`（作品数据 `WORK` 在这里，后四个项目的 `href` 现在是空字符串）、
  `js/case-companion.js`、`js/hero-gl.js`（绿色微光粒子，70 个，带 canvas 径向渐变贴图）
- `tools/*.py` — PIL 素材流水线：白点 LUT、按墨迹裁切、基线测量、羽化、圆角蒙版

## 6. 已确立的不变量与踩过的坑（重犯就会被指出来）

- **内页整页只有一根内容栏：`.is-case .page { max-width: 60rem }`。不要给单个块加 `max-width`。**
  之前 split/fig/emo/deck/seq 各写 52 或 60rem，左边缘对不齐，就是用户说的「有些地方紧凑有些又没变，完全乱了」。
- `.page` 自带 `margin-inline: auto`，在它身上再加更窄的 `max-width` 会把整块居中；约束要加在内层元素。
- `.page` 作为 flex 子项会缩到内容宽，需要 `width: 100%`。
- 图片来源不一时**必须套统一容器**：统一圆角、统一尺寸，合成图要切开再用 HTML 重排标签。
- logo 与文字对齐要**量字标基线**：`inline-block` 的基线是下边缘，Lenovo 字标基线在 68/96、
  下面还有 28.1% 红底，所以用 `--logo-drop`（lenovo .281 / baidu 0）下沉。
- `PointsMaterial` 不给 `map` 渲染出来是硬边正方形，必须给径向渐变贴图；浅底上不能用 additive。
- **换页与导航（最近三轮的重点，已定稿）**：
  - 正文换页走原生跨文档 View Transition（`@view-transition { navigation: auto }`），
    只用默认的 **root** 快照做模糊渐隐。**千万不要给 `main` 加 `view-transition-name`** ——
    内页 `main` 高 16000+px，整元素快照太大，超预算浏览器直接跳过整个过渡（这就是"有时候有过渡有时候没有"）。
  - **导航不参与快照**。给带 `backdrop-filter` 的顶栏命名会出两个毛病：快照被跳过时胶囊硬切；
    快照是矩形贴图、模糊按矩形重算，胶囊外面浮出半透明方块。
  - 胶囊伸缩＝`.nav__glass` 单独一层按 `transform-origin: left` 做 `scaleX`，
    同时整条 `.nav` 反向平移半个宽度差（`--pill-shift`），看上去是**原地两端伸缩**、图标始终贴在胶囊头上。
    宽度通过 `sessionStorage['nav:pill-w']` 跨页传递。
  - 文字滚动用 CSS transition + `nth-child` 延迟，和胶囊同一套时钟；**不要再用 GSAP 逐帧改 width**
    （换页头 100-200ms 主线程在解析脚本，逐帧补间必然掉帧）。
  - 入场逻辑放在 `js/nav-enter.js` 并紧跟 `<nav>`，排到 gsap/lenis 后面会晚一百多毫秒起手。
- Chrome 持久化 profile 缓存很凶，无头验证必须带 `?v=$(date +%s)`，`http.server` 要用 `--directory`。

## 7. 用户反馈里反复出现的判据

- 字**宁小勿大**；组与组之间不要太松散。用户多次说「还是太大了」，最后是靠实测 augen 才收住的。
- 留白要多，正文聚在页面中部。
- 中英混排字重要齐（`font-synthesis-weight: none`，只用 300/400 两档）。
- 动效不能只是「过渡」，要有形变、要有存在感；但特效不要花到抢主体内容。
- 低质量、糊的图缩小使用；同系列图必须同规格。

## 8. 当前状态（2026-09-05）

**六个页面全部完成并跑过无头验收**（`console 0 / broken 0 / overflowX 0`）：
`index.html` + `case-companion / justpaper / oreate / terabox / practices`。

- 四个画布内页由 `tools/build_case_pages.py` 从第一版**原封不动**生成：
  1920px 绝对定位画布按 `--cs = 容器宽/1920` 缩放；章节头是画布自己的标题放大 + 发丝线 + 序号；
  章节缝 `CHAPTER_GAP=140`、标题到正文 `HEAD_TO_BODY=250` 在生成阶段统一。
  **改任何 css/js 后要重跑一次这个脚本**（它同时刷缓存戳）。
  章节头是**按内容**识别的（v1 侧栏 `data-sec` 坐标和真实标题位置不一致），Outcome 那一节的标题是合成出来的。
- `case-practices.html` 是手写的（不由生成器产出），改导航之类的共用结构时**两边都要动**。
- 首页过场带：钉住 260vh，一条 ScrollTrigger 同时驱动上盖开合到 105°、五档残影、
  蓝色开合弧（每帧重画路径，不用 dashoffset——`non-scaling-stroke` 会让虚线按屏幕像素算）、
  三句话逐句浮出；右侧文字的纵向位置由 `interludeAlign()` 量出来（末行基线压在图纸地线上）。
- 头像与标签页图标：正文是方框 + 全身像，favicon 按设计稿是圆形全身像（32 / 180 两档）。
- 内页顶部返回按钮带 `#row-<id>`，回索引页直接落在该项目那一行（`landOnHash()` 自己落位，
  因为作品行是脚本渲染的、且 Lenis 会覆盖原生锚点位置）。

还没做的：内页展示图的 augen 式视差（用户同意「慢慢改」）；Companion 页统一到新语言（用户已知，排在最后）。

## 9. 本机环境与验证手法

- Node 在 `~/.local/node/bin/node`（v24，有内建 `WebSocket`，CDP 直连不需要 puppeteer）；
  **没有 gh CLI**；skill 装在 `~/.agents/skills`。
- 本地起站：`python3 -m http.server 8931 --directory "<项目目录>"`。
  **跨文档 View Transition 需要同源 http(s)，`file://` 下是硬切**，验收换页必须走 localhost。
- 无头验证：`--headless=new` + `Target.createTarget` + `Runtime.evaluate` 读 computed style，
  `Page.addScriptToEvaluateOnNewDocument` 装 rAF 取样器可以量出动画曲线，
  `Page.captureScreenshot` 带 `clip` 连拍可以逐帧看过渡。
- **本机无头 Chrome 拿不到 WebGL 上下文**（`--disable-gpu`、`--enable-unsafe-swiftshader`、
  `--use-angle=metal` 三种都试过，`webgl: false`），所以粒子层的观感只能由用户在真实浏览器里判断。


