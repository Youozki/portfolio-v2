# 迁移说明（2026-09-09）

换电脑或换人接手时，照这份走。项目本身的设计与技术决策看 `HANDOFF.md`，这里只讲怎么跑起来、怎么上线。

## 1. 包里有什么

```
portfolio-迁移包-20260909/
├── README-迁移说明.md      ← 就是本文件
├── portfolio-v2/           ← 正式项目，线上 https://ptfchy.xyz 就是它
│   ├── HANDOFF.md          ← 交接文档：约束、设计系统、踩过的坑、部署细节
│   ├── .git/               ← 完整提交历史，能直接 push 触发线上部署
│   ├── index.html + case-*.html   六个页面
│   ├── css/ js/ vendor/ fonts/ assets/
│   ├── tools/              ← 生成与维护脚本（下面第 5 节）
│   └── edgeone.json        ← 线上响应头（缓存策略）
└── 参考资料/
    ├── portfolio-v1/       ← 第一版作品集，画布内页的正文来源
    └── 调研与素材/          ← Terabox 分析 CSV、早期 md/svg/html
```

只想让站点跑起来：只需要 `portfolio-v2/`。`参考资料/` 是历史留存，不参与构建。

## 2. 本地跑起来（不需要装任何依赖）

纯静态、无构建步骤。在 `portfolio-v2/` 目录下：

```bash
python3 -m http.server 8000
# 然后浏览器打开 http://localhost:8000/
```

**必须走 http，不要双击 html 文件。** `file://` 下跨文档 View Transition 不生效，换页会变成硬切，
字体与部分脚本也可能被拦。

## 3. 继续开发要装的东西

- **Python 3**（macOS 自带）—— 跑 `tools/` 里的脚本
- **Pillow**：`pip3 install Pillow` —— 只有 `shrink_case_images.py` 需要
- **Node**（可选，v18+）—— 只在跑无头验收脚本时需要。原机器装在 `~/.local/node/bin/node`，
  新机器自己装，路径不重要
- **Chrome**（可选）—— 无头验收用
- 没有 npm 依赖、没有 `node_modules`、不需要 `npm install`

## 4. 改完怎么上线

```bash
git add -A && git commit -m "..." && git push origin main
```

推到 `Youozki/portfolio-v2` 的 `main` 之后 EdgeOne Pages 自动部署，大约 40–70 秒生效。

**改了 `css/` 或 `js/` 里任何文件，必须把六个 HTML 里对应的 `?v=` 版本号抬一位。**
线上给 css/js 配了 7 天缓存（`edgeone.json`），不抬号访客七天内拿不到新样式。
`vendor/` 与 `fonts/` 是钉住的第三方资源，一年 immutable，不用带版本号。

抬版本号的做法（以 `base.css` 为例，把旧号换成新号）：

```bash
for f in index.html case-*.html; do
  perl -pi -e 's/base\.css\?v=\d+/base.css?v=1789700000/g' "$f"
done
```

上线后确认一句：

```bash
curl -s "https://ptfchy.xyz/css/base.css?v=1789700000" | head -3
curl -s https://ptfchy.xyz/index.html | grep -o 'base.css?v=[0-9]*'
```

## 5. 维护脚本速查（都在 `tools/`）

- **`shrink_case_images.py`** —— 往内页加图或换图之后**必须跑**：
  `python3 tools/shrink_case_images.py case-oreate.html --apply`
  按显示尺寸补小档并写 `srcset`/`sizes`。不跑的后果是 iOS Safari 崩溃（见 HANDOFF 6.3）。
- `build_case_pages.py` —— 从第一版重新生成四个画布内页（改共用结构后重跑）。
  画布正文在 `tools/v1-doc/` 存了一份，不依赖第一版仓库在不在。
- `eager_first_screen.py` —— 把内页首屏那两三张图转成 eager + `fetchpriority=high`。
- `bake_index_rows.py` / `build_*_assets.py` —— 首页作品行与素材的生成脚本。
- `polish_head_and_alt.py` —— 补 `meta description`、og/twitter 卡片、`alt=""`，清重复属性。
- `verify.js` / `shots.js` —— 无头验收与截图。
- `case-practices.html` 是**手写**的，不由生成器产出。改导航之类的共用结构时两边都要动。

## 6. 需要你自己的账号（包里不含任何凭据）

- **GitHub**：仓库 `git@github.com:Youozki/portfolio-v2.git`。新机器要重新配 SSH key
  或改用 HTTPS + token。原机器**没装 gh CLI**，都是裸 git 命令。
- **腾讯云 EdgeOne Pages（Makers）**：托管与部署。项目绑的是上面这个仓库的 `main`，
  框架预设「其他/静态网站」，安装与编译命令留空，输出目录 `/`。
- **DNSPod**：域名 `ptfchy.xyz` 的解析。**三条记录一条都不能删**（`@` CNAME、`www` CNAME、
  `edgeonereclaim` TXT，后者是归属权校验，免费证书自动续期也依赖它）。

## 7. 红线（改之前先看 HANDOFF）

- **不要动项目事实**：公司、职位、年份、项目名、联系方式一律照原样，简历不得造假。
- **不要用衬线字体**。
- **不要给仓库加 `CNAME` 文件**，那是 GitHub Pages 专用的，会动到备用地址。
- **不要开 HSTS**（理由见 HANDOFF 第 10 节）。
- **不要给 `main` 加 `view-transition-name`**，内页 main 有一万六千像素高，快照超预算会让整个
  换页过渡被跳过。
- **修体验 bug 时不要顺手改动效参数**：机制层修复要和动效解耦，曾经因此作废过一整轮。
- 五个项目入口必须能从首页直达，内页保留 1920px 坐标画布、不重排。

## 8. 出问题先看哪里

- 换页没有过渡：是不是用 `file://` 打开的；或者 `scrollRestoration` 被设成 manual。
- 内页第一帧塌版：`css/case-doc.css` 里画布高度与缩放的 CSS 兜底值是不是被改掉了。
- 手机崩溃 / 白屏：新加的图有没有跑 `shrink_case_images.py`。
- 改了样式线上没变：`?v=` 版本号没抬。
- 图墙有个别图不出来：可能撞到 HTTP/2 的并发流上限（HANDOFF 6.1 末尾）。
- 备用地址：`https://youozki.github.io/portfolio-v2/` 一直可用，两边不冲突。
