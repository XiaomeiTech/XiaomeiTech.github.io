---
layout: doc
pageClass: manual-theme
---

# PDF 手册导出中心

这里提供统一的 PDF 手册导出入口。每个文档模板都走同一套 Vue 渲染链路，仅在打印样式与结构上有区别。

## 可用模板

- 数据手册: /pdf/datasheet
- 应用指南: /pdf/app-guide
- 单品手册: /pdf/product-manual
- 系列合并手册: /pdf/series-manual
- 法律与合规: /pdf/legal

## 使用说明

本地导出单本:

```bash
npm run docs:pdf:datasheet
```

导出全部:

```bash
npm run docs:pdf
```
