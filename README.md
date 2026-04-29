# 小美技术文档站

基于 VitePress 的官方技术文档网站，支持网页浏览与 PDF 离线文档生成。

## 架构原理

项目包含**两套独立系统**，各司其职：

```
markdown/ (源文档)
    │
    ├──→ VitePress (Node.js) ──→ GitHub Pages (官网)
    │
    └──→ Python 流水线    ──→ PDF 文件 (正式文档，GitHub Release)
```

- **VitePress** 负责 `xiaomeitech.github.io` 官网，将 Markdown 渲染为交互式网页，支持搜索、导航、暗色主题
- **Python PDF 流水线** 完全独立，直接从 Markdown 编译为印刷级 PDF，不依赖 VitePress 构建

### PDF 生成流程

```
YAML 配置 → 封面 HTML (Jinja2) → WeasyPrint → 封面 PDF ─┐
           → Markdown 正文      → WeasyPrint → 正文 PDF ─┼→ pikepdf 合并 → 最终 PDF
           → 结尾 HTML (Jinja2) → WeasyPrint → 结尾 PDF ─┘
```

每一步说明：

1. **读取 YAML 配置** — 指定公司名、文档标题、内容范围(markdown 文件/目录)、封面/结尾模板、复用附录(法律声明、警告标识等)、PDF 页面设置
2. **封面** — Jinja2 渲染 HTML 模板，变量 `{{ COMPANY }}`、`{{ TITLE }}`、`{{ YEAR }}` 等来自配置文件和当前日期，WeasyPrint 转为单页 PDF
3. **正文** — 遍历指定的 Markdown 文件，Python-Markdown 转为 HTML，注入 `@page` 页眉页脚和 HarmonyOS Sans SC 字体，WeasyPrint 转为多页 PDF
4. **结尾** — 同封面流程，渲染结尾页 HTML 模板
5. **合并** — pikepdf 将三部分按序拼接，输出最终 PDF

## 目录结构

```
├── markdown/                 # 源文档 (.md)，VitePress 和 PDF 系统共用
│   ├── feeder-controller/    # 飞达控制器文档
│   ├── remoteIO/             # 远程IO系统文档
│   ├── web/                  # 开发者指南 (仅网页)
│   ├── company/              # 公司信息
│   └── ...
├── docs/                     # VitePress 网站框架
│   ├── .vitepress/           # 主题、配置、打印样式
│   └── public/fonts/         # HarmonyOS Sans SC 字体文件 (网页+PDF共用)
├── pdf-configs/              # PDF 配置文件 (YAML)
│   ├── datasheet.yaml        # 数据手册
│   └── series-manual.yaml    # 系列合并手册
├── pdf-templates/            # PDF 封面/结尾 HTML 模板 (Jinja2)
│   ├── covers/
│   └── endings/
├── pdf-content/              # 可复用附录 (.md)
│   ├── legal-info.md         # 法律声明
│   └── warning-meanings.md   # 警告标识说明
├── scripts/                  # 构建脚本
│   ├── generate_pdf.py       # PDF 生成主脚本 (Python)
│   └── clean-cache.mjs       # VitePress 缓存清理
├── .github/workflows/        # CI/CD
│   ├── deploy.yml            # 网站自动部署到 GitHub Pages
│   └── markdown-pdf.yml      # PDF 自动编译并发布到 Release
├── package.json              # Node.js 依赖 (仅 VitePress)
└── requirements.txt          # Python 依赖 (仅 PDF)
```

## Windows 本地运行

### 环境准备

```bash
# 1. Node.js ≥ 18 (VitePress)
# 下载安装: https://nodejs.org

# 2. Python ≥ 3.10
# 下载安装: https://python.org

# 3. GTK3 Runtime (WeasyPrint 依赖，PDF 生成必需)
# 下载安装: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
# 默认安装到 C:\Program Files\GTK3-Runtime Win64
```

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/XiaomeiTech/XiaomeiTech.github.io.git
cd XiaomeiTech.github.io

# Node.js 依赖
npm ci --legacy-peer-deps

# Python 依赖
pip install -r requirements.txt
```

### 运行网页开发服务器

```bash
npm run docs:dev
# 打开 http://localhost:5173 预览
```

### 编译 PDF

```bash
# 生成单份 PDF
python scripts/generate_pdf.py -c pdf-configs/datasheet.yaml

# 批量生成全部
bash -c 'for f in pdf-configs/*.yaml; do python scripts/generate_pdf.py -c "$f"; done'

# 精简输出 (只显示警告和错误)
python scripts/generate_pdf.py -c pdf-configs/datasheet.yaml -q

# 调试模式 (显示底层库详细日志)
python scripts/generate_pdf.py -c pdf-configs/datasheet.yaml -v

# 输出到指定路径
python scripts/generate_pdf.py -c pdf-configs/datasheet.yaml -o output/custom.pdf
```


## 新增文档类型

新建一个 YAML 配置即可，以 "应用指南" 为例：

**1. 创建 `pdf-configs/app-guide.yaml`：**

```yaml
company: 小美技术（东莞）有限公司
company_en: Xiaomei Technology (Dongguan) Co., Ltd.
brand: "#dc2626"

title: 应用指南
subtitle: APPLICATION GUIDE
series: 开发与使用指南
description: 本地开发环境搭建 · API 示例

cover:
  template: pdf-templates/covers/cover-generic.html

ending:
  template: pdf-templates/endings/ending-default.html

content:
  base_dir: markdown
  files:
    - web/localsetup.md
    - web/api-examples.md

appendices:
  - pdf-content/legal-info.md

pdf:
  format: A4
  margin: { top: 94, right: 57, bottom: 94, left: 57 }
  font_family: "HarmonyOS Sans SC, SimHei, sans-serif"
  font_dir: docs/public/fonts
  header:
    left: 小美技术（东莞）有限公司
    right: 应用指南

output: artifacts/pdf/app-guide.pdf
```

**2. 生成：**

```bash
python scripts/generate_pdf.py -c pdf-configs/app-guide.yaml
```

可选：如需自定义封面，复制 `pdf-templates/covers/cover-generic.html` 修改即可，然后在配置中指向新模板。

## GitHub Actions CI/CD

### 网站部署 (`.github/workflows/deploy.yml`)

触发条件：推送到 `main` 分支

```bash
git push origin main
→ VitePress 构建静态站 → 部署到 GitHub Pages → https://xiaomeitech.github.io
```

### PDF 编译 (`.github/workflows/markdown-pdf.yml`)

触发条件：推送 `markdown/`、`pdf-configs/`、`pdf-templates/`、`pdf-content/`、`scripts/generate_pdf.py` 的变更

```bash
git push origin main  # 修改了 markdown 文件或 PDF 配置
→ Ubuntu CI 安装 Python + WeasyPrint 系统库
→ pip install -r requirements.txt
→ python scripts/generate_pdf.py -c pdf-configs/*.yaml
→ 上传 artifacts
→ 发布到 GitHub Release (latest-pdf tag)
```

用户可在 [Releases](https://github.com/XiaomeiTech/XiaomeiTech.github.io/releases) 页面下载最新 PDF。

## 自定义封面/结尾模板

模板使用 Jinja2 语法，可用变量：

| 变量 | 来源 | 说明 |
|------|------|------|
| `{{ COMPANY }}` | 配置文件 | 公司中文名 |
| `{{ COMPANY_EN }}` | 配置文件 | 公司英文名 |
| `{{ BRAND }}` | 配置文件 | 品牌色 (#dc2626) |
| `{{ TITLE }}` | 配置文件 | 文档标题 |
| `{{ SUBTITLE }}` | 配置文件 | 英文副标题 |
| `{{ SERIES }}` | 配置文件 | 产品系列名 |
| `{{ DESCRIPTION }}` | 配置文件 | 文档描述 |
| `{{ YEAR }}` | 当前日期 | 年份 (2026) |
| `{{ MONTH }}` | 当前日期 | 月份 (04) |
| `{{ DAY }}` | 当前日期` | 日期 (29) |
| `{{ FONT }}` | 配置文件 | 字体栈 |

封面配置的 `variables` 字段可添加任意自定义变量，如 `order_number`、`version`、`doc_number`，模板中用 `{{ order_number }}` 引用。

## 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 网页框架 | VitePress 2 (alpha) | 文档网站 |
| Markdown → HTML | Python-Markdown | PDF 正文转换 |
| HTML → PDF | WeasyPrint | PDF 渲染引擎 |
| PDF 合并 | pikepdf | 封面+正文+结尾拼接 |
| 模板引擎 | Jinja2 | 封面/结尾 HTML 模板 |
| 字体 | HarmonyOS Sans SC | 正文与封面中文字体 |

## 常见问题

**Q: `python scripts/generate_pdf.py` 报错 `cannot load library libpango`？**

安装 GTK3 Runtime：https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer

**Q: PDF 中文显示为方框？**

检查 `docs/public/fonts/` 下是否有 `HarmonyOS_Sans_SC_*.ttf` 字体文件，CI 中确保 `pip install -r requirements.txt` 时字体文件已被 checkout。

**Q: 图片在 PDF 中不显示？**

图片路径必须是相对路径（相对于 Markdown 文件），Python 脚本会自动转为 `file://` 绝对路径。
