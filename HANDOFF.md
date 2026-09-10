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
- **返回首页的落位（2026-09-08 定稿）**：两条要同时满足，缺一条就出问题。
  - 位置必须在**首帧之前**摆好，所以落位脚本 inline 写在 `index.html` 作品列表的**下一行**
    （放 `<head>` 量不到位置，交给 `js/index.js` 太晚——它排在 gsap/lenis 后面，实测那一帧
    文档已是全高、滚动量还是 0，画的就是首屏主视觉，也就是用户说的"先卡在首页图那里"）。
    首屏在这之前就解析完了，所以 `<head>` 里先挂 `html.is-landing` 把首屏 `visibility: hidden`，
    落位脚本摆好后立刻解除（另有 1.5s 定时兜底）。
  - ScrollTrigger 必须在 `scroll 0` 上建。两件事都要，就压进**同一个任务**：
    `atTopForSetup()` 先把滚动量按回 0 → 建全部入场 → 再放回去（任务中间浏览器不渲染，
    画面上一帧都不会退回首屏），最后只 `ScrollTrigger.update()`，不 `refresh()`。
    在非零位置上建 trigger 会在 refresh 里递归到 `undefined.end`，整页退到 `motion-fallback`——
    这一轮第一版就是这么炸的，两页都复现。
  - 内页返回链接一律用 `index.html?row=<id>`，**不要用 `#row-<id>`**：带 hash 浏览器自己还会
    再滚一次（实测 651ms），而且把行顶死在视口顶上，留出的 14vh 又被抹掉。
- **内页第一帧就要是对的版式**：画布高度与缩放的兜底值写在 CSS 里
  （`height: var(--doc-h, calc(var(--span) * 100vw / 1920))`、`scale(var(--cs, calc(100vw / 1920px)))`），
  `js/case-doc.js` 仍是权威值。兜底缺失时画布在脚本跑起来之前高度是 0，第一帧是"蓝底＋结语"
  挤在一起的塌版，等 gsap/lenis 下完才撑开——这是"点进内页觉得慢"里最明显的一下。
  首屏那两三张画布图另外要转成 `fetchpriority="high"` 的 eager（`tools/eager_first_screen.py`，
  判据是画布坐标落在 `[y0, y0+900]`；按"top 小于阈值"筛会把嵌套在 mockup 里的图全捞进来）。
- 内页顶栏的反色态（`is-inverted`）直接写死在 HTML 里：这几页开场都压在蓝底上，
  等 `site.js` 的 `navInvert()` 来加要排在 gsap/ScrollTrigger/lenis 后面，那之前顶栏一直是
  浅色玻璃底——用户看到的"加载完才变成正确的颜色"。滚动之后的切换仍由 `navInvert()` 接管。

### 6.1 换页快慢是投递配置决定的（2026-09-08 实测）

线上原来一跳换页要 1.4–3.0s，拆开看两个来源，都不在代码里：

- **TTFB 512–1286ms**：节点在境外，纯往返。解法是 Speculation Rules 预取——六个页面各
  一条 `{"prefetch":[{"where":{"href_matches":"/*.html"},"eagerness":"moderate"}]}`，
  鼠标停在链接上 200ms 就把目标页文档取下来。实测 TTFB 降到 16–109ms。
  用 prefetch 不用 prerender：后者在后台把整页真渲染（脚本也跑），流量与 CPU 双份，
  而且跨文档过渡的激活路径要另外验一轮。
- **每次换页十几个 304**：css/js 原来是 `max-age=0, must-revalidate`，内容没变也要问一遍，
  而站点只有 HTTP/1.1，这些请求还要挤 6 条连接（实测 FCP 卡在 case-doc.css 的 1875ms）。
  解法是仓库根目录的 `edgeone.json`（EdgeOne Pages 支持从仓库配响应头，不用去控制台）：
  vendor/fonts/assets 一年 immutable，css/js 七天。

改完实测：同一会话内再进项目页 FCP 240ms、返回首页 484ms（原来 2348–2960ms），
资源全部读本地。首次进某一页仍要下它自己的 css 与图（828–1604ms）。

两条注意：
- **给 css/js 加引用时必须带 `?v=`**，否则七天内改了样式访客拿不到（case-practices 的
  case.css 就漏过一次）。vendor 不用带，那是钉住的第三方库。
- 站点已开 HTTP/2（2026-09-09）。开关在 EdgeOne Makers 控制台 → 项目 → 域名管理 → 自定义域名
  那一行，前置条件是 SSL 证书已配好。收益：不节流下 justpaper 233 张图全部就绪 5.0s（HTTP/1.1
  时代同样口径的 4G 节流要 23.4s）。副作用：一次性突发两百多个请求会撞到边缘节点的并发流上限，
  报 `net::ERR_HTTP2_SERVER_REFUSED_STREAM`，被拒的图空白且不重试；正常滚动式 lazy 加载
  一屏十几张够不到上限，但以后若报「图墙有个别图不出来」，先查这个。

### 6.2 换页过渡最终是「纯渐隐」，中间那些方案都被否掉了（2026-09-09）

现在全部代码就三行：`::view-transition-old(root)` 走 `page-out 600ms ease`（只动 opacity）、
`::view-transition-new(root)` 是 `animation: none`。`animation: none` 不能省——不写的话浏览器
会给新页套 UA 默认的 fade-in，两层同时半透明就透出快照背后的页面底色，深色页之间换页闪一下纸色。

一路试过又被否掉的（`css/base.css` 注释里有完整记录，别再重走）：
位移（旧页上移会横切出一条下层画面）→ 缩放（1.006~1.06 试了好几档，反馈两次都指着它：
「旁边的色块溢出了」「像页面收缩了一下」）→ 大模糊 44px（糊成色块）→ 20px（头晕）→ 12px
→ 磨砂 `blur(5px) saturate contrast`（brightness 提亮那版被指「刺眼」，实测平均亮度从 100
冲到 116，进浅色页会撞 255 上限，所以雾化只能用 contrast 压反差、不能用 brightness）。

### 6.3 内页图片必须按显示尺寸补小档（2026-09-09，iOS 崩溃的根因）

用户报手机端「反复出现问题与网页崩溃，尤其是 oreate 那页」，是图片解码内存超限：
oreate 105 个 `<img>` 文件字节只有 5.3MB，但按 `宽×高×4` 算解码内存 188MB，其中非 lazy 的
占 151MB，一进页面全量解码，iOS 的 WebContent 进程被 jetsam 杀掉。

根因是画布做法的副作用：**`transform: scale()` 是合成变换，不改变解码尺寸**。1254×700 的图
在 390 宽手机上只显示 63px，照样按 1254×700 解码。手机内存预算比桌面小一个量级，所以只在手机崩。

修法在 `tools/shrink_case_images.py`：按画布坐标宽度 cw 生成 `cw*0.8` 与 `cw*2` 两档小图，
`sizes` 手写成 `(cw/19.2)vw`。**`sizes` 必须手写**——浏览器选 srcset 候选时不看祖先的
transform scale，只看 sizes 声明值。实测 390×844 dpr3 看完整页：oreate 188→11MB、
justpaper 151→32MB、companion 58→7MB、terabox 34→5MB。

两个坑：
- **跑马灯（`.marquee`）与横向长图带里的图不能 lazy**。轨道一直在横移，lazy 会让还没进过视口
  的那几张在转过来的瞬间才请求。补 lazy 那一轮就是这么引入了空位，后来单独解掉。
- 量解码内存不能用 `naturalWidth`：有 srcset 时它会做 density 校正、返回的是布局宽度。
  要按 `currentSrc` 回查真实文件像素。

### 6.4 内页崩溃的第二个来源是「栅格化随缩放平方增长」（2026-09-10）

补完小图之后用户仍然报崩，而且给了两条决定性线索：**practices 页从来不崩**（它是唯一没有
1920 画布的内页），**放大得越多越容易崩，崩之前一定先自己刷新一次**（那次刷新就是
WebContent 被 jetsam 回收后的自动重载，紧接着的一次滑动再撑一次就彻底崩）。

所以除了解码内存，画布还有第二笔账：**栅格化按视觉像素算，捏合放大 N 倍，同一块内容要
N² 倍贴图**。terabox 只有 10 张图、7MB 解码，照样崩，就是这一笔。

修法分两层，都在 `css/case-doc.css` + `js/case-doc.js`：
1. `tools/split_case_slices.py --target 1000` 把画布切细（terabox 6 段、justpaper/companion 8 段、
   oreate 10 段，每段 ≤1400 画布 px）。切点只能落在没有元素跨越的空隙里。
2. 远离可视区的段整段 `display: none`（`.case-doc-wrap.is-idle > .case-doc`）。
   **判据必须用 `visualViewport`，而且只能用 `getBoundingClientRect()` + `visualViewport.offsetTop/height`
   这两样**（都相对布局视口，可以直接比）。**千万不要再把 `window.scrollY` 掺进来**——
   iOS 放大之后 scrollY 与 offsetTop 会各自算一遍偏移，加起来是双份，判据整体偏下，
   正在看的那一段被裁掉，用户报的"放大到一定程度图片和文字都消失"就是这个。
   余量一整个可视高度，再加一道保险：只要 wrap 与布局视口有交集就绝不裁
   （放大时会多留一两段，栅格化省得少一点，换"看得见的一定在渲染树里"）。
   实测 390×844 dpr3：zoom 1 基本不裁，zoom 3 时 oreate 10 段留 5–6 段、terabox 6 段留 4–5 段。
3. **发丝级元素不能进入场序列**：横向滚动图下面那根蓝色滚动条在手机上只有 1.1px 高，
   段被 `display:none` 收起再放出来之后拿不到 IntersectionObserver 的 0.04 阈值交叉，
   永久停在 `opacity: 0`（用户报"justpaper 滚动图下方蓝条消失了"）。
   `startCanvasMotion()` 现在跳过高度 <4px 的元素，并且段放回来时用 `wake()`
   补点亮已经进视口的元素（还在视口外的留给 observer，入场动画不会被提前烧掉）。
4. **不要拿动效换内存**：曾加过"放大 >1.5 倍就暂停跑马灯"，用户立刻发现图墙停了，已撤。

**上一版用 `content-visibility: auto` 没治住**，原因就是第 2 条：它要 Safari 18+，而且按布局
视口判定离屏。已经换掉，不要再加回来。

配套：段高写死在 wrap 的 `--doc-h` 上，所以段内 `display:none` 不动文档高度、不动滚动位置。
裁段必须等 `startCanvasMotion()` 量完换行点再开——`display:none` 的块量不出行位置，
提前裁会让离屏正文丢掉「按行入场」那一档。

### 6.5 小图档必须留放大余量（2026-09-10）

用户报「图片很糊」。量出来是 6.3 那批小档的判据太紧：`add_mobile_variant.py` 按
「手机物理需求 = 画布宽 × 0.609」出档，正好是 1.0 倍，**iOS 捏合放大不会重挑 srcset**，
所以放大 3 倍时全页清晰度比只有 0.31–0.44。

改成 `HEADROOM = 1.5`（档位 = 需求 × 1.5），并且**把 srcset 里比目标更小的旧候选剔掉**——
不剔的话浏览器永远挑最小那个，余量等于白给。实测中位清晰度比 1.0 → 1.5，
解码内存 terabox 5→7MB、oreate 11→13MB、justpaper 32→32MB、companion 7→9MB。

`device-hero.webp` 不在画布里（在 v2 的 `dual__half` 版式里、没有内联 `width:`），脚本抓不到，
两处 srcset 是手工写的：`-w432`（桌面 dpr2）/ `-w1296`（手机 dpr3 带余量）/ 原图。

放大 3 倍要 9 倍像素，物理上给不起——**再往上就只能接受软**，或者另做一套手机版式。

### 6.6 justpaper 单独再压一刀（2026-09-10）

裁段修好之后另外三页崩溃率已经很低，只有 justpaper 还会因为放大崩。量下来它唯一显著
超标的就是解码内存 **31.8MB**，是 oreate(13)／companion(9)／terabox(7) 的 2.5 倍。
而且这 31.8MB 里 428 个文件只有 9 个 ≥1MB、合起来 26.5MB，剩下 416 个碎图一共 3.6MB——
**所以"把几百张碎图合成一张"不是重点**（合并只省渲染对象，不省栅格化面积，还会把解码顶上去，
实测 6924 个 layout object 大约只值零点几 MB），重点全在那 9 张。

两件事：
- `tools/mark_big_images.py`（新）按【390px/dpr3 真正会挑中的那一档】算字节，给 ≥1MB 的图打
  `data-big`；`js/case-doc.js` 里这些图离屏就把 `src` 换成 1×1 透明图，靠近了再换回来。
  换之前先把 `aspect-ratio` 固定住，否则塌成 1px 会改掉横向滚动条的 `scrollWidth`。
  真正在视口里的绝不卸；裁段那一趟带着"会随缩放收窄的可视带"再判一次，并把已经进视口
  却还停在占位图的恢复回来（**上一次做离屏卸载就是栽在唤回时序上**，那版整份撤掉了）。
- `--trim 0.833` 把这 9 张的放大余量从 1.5 收到 1.25：26.5 → 18.4MB。只动 justpaper 这 9 张。

线上实测（390×844 dpr3）：justpaper 解码 32 → **13MB**，与不再崩的那三页同一水位。

量解码内存的两个坑（都踩过）：
- 有 srcset 时 `naturalWidth` 会做 density 校正，返回布局宽度，不能拿来算字节；
- **不要写 `i.currentSrc || i.src`**：lazy 且从未加载的图 `currentSrc` 是空串，退回 `src` 就把
  原图算进去了（一度把 oreate 报成 49.5MB）。要么只统计 `i.complete && i.naturalWidth` 的，
  要么显式跳过空的 `currentSrc`。

### 6.7 段的裁切线要留余量，底色不能挂在段上（2026-09-10）

用户报"手机端 oreate 图片编辑器下面那段说明最后一行被切掉了"。段边界是按【某一次量到的
元素高度】切的，而同一段文字在不同引擎下能差出一两行（iOS 上 PingFang 的行盒偏高），
高出来的部分越过段底就被 `overflow: hidden` 削掉。本机实测：justpaper 已经有四处元素
越界 24–40 画布 px；oreate 那段说明在字距 +0.4px 的模拟下就越界 17 CSS px、确实被裁。

修法（`css/case-doc.css`，只动两处，版式零变化）：
- `.case-doc-wrap` 加 `padding-bottom: 64px` + `margin-bottom: -64px`。
  `box-sizing: content-box` 下 padding 只把【裁切线】往下推 64px，负外边距把它在流里抵掉，
  所以下一段位置与文档高度分毫不动（桌面 docH 与线上逐页一致）。手机上 64 CSS px
  折成画布坐标是 300 多 px，行高漂移再也切不到字。
- **画布底色必须挂在 `main` 上**（`body.is-case main { background: #f7f7f7 }`），
  留在 `.case-doc-wrap` 上的话，后一段的不透明底会正好盖掉前一段溢出的那一行，
  上面那 64px 白给。main 里其余每一块（内页头、结语、下一项目）都有自己的不透明底，
  所以这样换视觉完全一样。

## 7. 用户反馈里反复出现的判据

- 字**宁小勿大**；组与组之间不要太松散。用户多次说「还是太大了」，最后是靠实测 augen 才收住的。
- 留白要多，正文聚在页面中部。
- 中英混排字重要齐（`font-synthesis-weight: none`，只用 300/400 两档）。
- 动效不能只是「过渡」，要有形变、要有存在感；但特效不要花到抢主体内容。
- 低质量、糊的图缩小使用；同系列图必须同规格。

## 8. 当前状态（2026-09-10）

**六个页面全部完成，桌面 1440×900 dpr2 与手机 390×844 dpr3 两档都跑过全页无头验收**：
0 控制台报错、0 横向溢出、`motion-fallback` 全 false、进入过视口的图 0 未加载、
`[data-reveal]` 没有停在 `opacity:0` 的；四跳换页过渡都在，帧距中位 16.7ms；
从 practices 返回首页第一帧起 `rowTop` 就是 126、六帧不动。
`index.html` + `case-companion / justpaper / oreate / terabox / practices`。

- 四个画布内页由 `tools/build_case_pages.py` 从第一版**原封不动**生成：
  1920px 绝对定位画布按 `--cs = 容器宽/1920` 缩放；章节头是画布自己的标题放大 + 发丝线 + 序号；
  章节缝 `CHAPTER_GAP=140`、标题到正文 `HEAD_TO_BODY=250` 在生成阶段统一。
  **改任何 css/js 后要重跑一次这个脚本**（它同时刷缓存戳）。
  画布正文（`window.CASE_DOC_*`）在 `tools/v1-doc/` 里存了一份，**所以这个脚本不依赖第一版仓库在不在**；
  旁边有第一版时优先读它，方便第一版更新后同步。图片原始尺寸从 v2 自己的 `assets/` 量（路径与第一版一致）。
  章节头是**按内容**识别的（v1 侧栏 `data-sec` 坐标和真实标题位置不一致），Outcome 那一节的标题是合成出来的。
- `case-practices.html` 是手写的（不由生成器产出），改导航之类的共用结构时**两边都要动**。
- 首页过场带：钉住 260vh，一条 ScrollTrigger 同时驱动上盖开合到 105°、五档残影、
  蓝色开合弧（每帧重画路径，不用 dashoffset——`non-scaling-stroke` 会让虚线按屏幕像素算）、
  三句话逐句浮出；右侧文字的纵向位置由 `interludeAlign()` 量出来（末行基线压在图纸地线上）。
- 头像与标签页图标：正文是方框 + 全身像，favicon 按设计稿是圆形全身像（32 / 180 两档）。
- 内页顶部返回按钮带 `#row-<id>`，回索引页直接落在该项目那一行（`landOnHash()` 自己落位，
  因为作品行是脚本渲染的、且 Lenis 会覆盖原生锚点位置）。

还没做的：内页展示图的 augen 式视差（用户同意「慢慢改」）；Companion 页统一到新语言（用户已知，排在最后）。

2026-09-09 复筛补掉的：六页 og/twitter 分享卡片（`assets/graphics/og-cover.jpg` 是从首页主视觉裁的
1200×630，可以随时换成专门设计的）、四个内页的 `meta description`、552 处 `<img alt="">`。
仍然留着的已知项：
- `assets/` 里有 93 个没被任何页面引用的旧素材（大多是 justpaper 早期导出），没删，占 21MB 里的一部分。
- oreate 有 9 张图排在画布坐标 x>1920 处，被 `overflow: hidden` 裁掉、用户看不见，是设计稿导出残留。
  它们挂着 lazy 所以永远不下载，不影响体验，清理属于可选项。
- `js/case-companion.js` 没有任何页面引用（死文件），问过是否删、没得到回复，所以留着。
- `js/site.js` 里 `ease: 'reveal'` 用的 CustomEase 实际没加载，一直走 GSAP 默认缓动。
  因为「修体验问题不许动既有动效参数」这条约束，只记录、没动。

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

## 10. 部署（2026-09-07 上线）

正式地址 **https://ptfchy.xyz**（`www` 同时可用）。备用 https://youozki.github.io/portfolio-v2/ 保留，两边不冲突。

- **托管**：EdgeOne Pages（腾讯云国际站），绑 GitHub 仓库 `Youozki/portfolio-v2` 的 `main`，
  推一次自动部署一次。框架预设「其他/静态网站」，安装与编译命令留空，输出目录 `/`。
- **加速区域选的是「全球可用区（不含中国大陆）」**，因为另两个选项的自定义域名都要 ICP 备案。
  代价是走境外节点（落地 IP `43.174.x.x`），国内比 GitHub Pages 好一截但不是最优；
  要真正的国内速度必须先备案再换区域。
- **`.edgeone.dev` 那个预览域名不能当公开链接**：官方为内容合规做了限制——不含中国大陆的区域，
  中国大陆网络一律 401；含中国大陆的区域则要用控制台生成的签名链接、有效期 3 小时。
- **DNS 在 DNSPod（NS `dorado/karen.dnspod.net`），记录加在「权威解析」**，三条都不能删：
  - `@` CNAME → `ptfchy.xyz.pages.dnsoe7.com`
  - `www` CNAME → 同一目标
  - `edgeonereclaim` TXT → EdgeOne 归属权校验（免费证书自动续期也依赖它）
- **证书**：TrustAsia DV，90 天，裸域与 `www` 各一张，到期前腾讯云自动重签下发，
  前提是 CNAME 一直指着 EdgeOne。
- **开关**：强制 HTTPS 开、OCSP 装订开、**HTTP/2 开**（2026-09-09）、**IPv6 开**（同日，
  裸域与 www 的 CNAME 目标都下发了 `AAAA 240d:c010:75:1::19a`，A 记录仍在，正常双栈；
  刚开时本地解析器查不到是下发延迟，用 `dig @8.8.8.8 AAAA <域名> +noall +answer` 查 CNAME 目标）、
  **HSTS 故意不开**（一旦被浏览器缓存，证书出问题时访客硬性打不开且清不掉，作品集不值得冒这个风险）。
- **顺序坑**：证书装好之前绝对不能开强制 HTTPS，否则 HTTP 访客被跳到坏的 HTTPS，整站打不开。
- 换主机不需要改仓库：全站相对路径，子路径（GitHub Pages 的 `/portfolio-v2/`）和根路径都能跑。
  **不要加 `CNAME` 文件**，那是 GitHub Pages 专用的，会动到备用地址。


