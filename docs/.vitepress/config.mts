import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { fileURLToPath } from 'node:url'
import container from 'markdown-it-container'
import wavedromPlugin from './wavedrom.mts'
import { ioModules } from './theme/components/ioModules'
import fs from 'node:fs'
import path from 'node:path'


const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const repoName = env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserOrOrgPagesRepo = repoName.endsWith('.github.io')
const githubBase = repoName && !isUserOrOrgPagesRepo ? `/${repoName}/` : '/'
const siteBase = env.GITHUB_ACTIONS ? githubBase : '/'
const markdownSrcDir = fileURLToPath(new URL('../../markdown', import.meta.url))

// Helper: create a VitePress-compatible container render function
function makeContainer(title: string): (tokens: any[], idx: number) => string {
  return (tokens, idx) => {
    const token = tokens[idx]
    if (token.nesting === 1) {
      return `<div class="${token.info} custom-block">\n<p class="custom-block-title">${title}</p>\n`
    }
    return '</div>\n'
  }
}


// 侧边栏定义：Pexus 与工业控制器分别被多个路径前缀共用，
// 使 /pexus/ 与 /pexus/edge/、/custom/ 与 /feeder-controller/ 展示同一套导航。
const pexusSidebar = [
  {
    text: 'Pexus 标准自动化控制平台',
    items: [
      { text: '平台总览', link: '/pexus/' },
      { text: 'Pexus PAC 控制器', link: '/pexus/pac' },
      { text: 'Pexus Edge 远程IO', link: '/pexus/edge' },
      { text: 'Pack Studio IDE', link: '/pexus/studio' },
      { text: 'Pack Runtime 运行时', link: '/pexus/runtime' }
    ]
  },
  {
    text: 'Pexus Edge 远程IO',
    items: [
      { text: '系统概述', link: '/pexus/edge/' }
    ]
  },
  {
    text: '耦合器',
    items: [
      { text: 'EtherCAT耦合器', link: '/pexus/edge/EtherCAT/' },
      { text: 'PROFINET耦合器', link: '/pexus/edge/PROFINET/' },
      { text: 'EtherNet/IP耦合器', link: '/pexus/edge/EtherNetIP/' },
      { text: 'Modbus耦合器', link: '/pexus/edge/Modbus/' }
    ]
  },
  {
    text: '扩展模块',
    items: [
      { text: '耦合器与扩展模块选型表', link: '/pexus/edge/Expansion/' },
      { text: '数字量输入 DI', link: '/pexus/edge/DI/' },
      { text: '数字量输出 DO', link: '/pexus/edge/DO/' },
      { text: '模拟量输入 AI', link: '/pexus/edge/AI/' },
      { text: '模拟量输出 AO', link: '/pexus/edge/AO/' }
    ]
  },
  {
    text: '无线模组',
    items: [
      { text: '无线模组', link: '/pexus/edge/Wireless/' },
      { text: 'WM9832 数据手册', link: '/pexus/edge/Wireless/WM9832-datasheet' },
      { text: 'WM9232 数据手册', link: '/pexus/edge/Wireless/WM9232-datasheet' }
    ]
  },
  {
    text: '总线介绍',
    items: [
      { text: 'EtherCAT 总线介绍', link: '/pexus/edge/Bus-intro/ECbus-intro' },
      { text: 'EtherNet/IP 总线介绍', link: '/pexus/edge/Bus-intro/EIPbus-intro' },
      { text: 'PROFINET 总线介绍', link: '/pexus/edge/Bus-intro/PNbus-intro' },
      { text: '接线参考指南', link: '/pexus/edge/Bus-intro/wiring-reference' },
      { text: '安全参考说明', link: '/pexus/edge/Bus-intro/safety-reference' }
    ]
  }
]

const industrialSidebar = [
  {
    text: '工业控制器',
    items: [
      { text: '控制器总览', link: '/custom/' }
    ]
  },
  {
    text: '飞达控制器',
    items: [
      { text: '控制器概述', link: '/feeder-controller/' },
      { text: '操作手册', link: '/feeder-controller/manual' }
    ]
  },
  {
    text: '物流系统控制器',
    items: [
      { text: 'PE3237 小车控制器', link: '/custom/PE3237' },
      { text: 'RLD-VB8-P48-400 直驱伺服滚筒驱动器', link: '/custom/RLD-VB8-P48-400' }
    ]
  },
  {
    text: '定制控制器',
    items: [
      { text: '模块可分离式远程IO', link: '/custom/modular-separable-remote-io' },
      { text: 'IM2610C 定制接口模块', link: '/custom/IM2610C-datasheet' },
      { text: '治具无线负压检测（高速线）', link: '/custom/presssensorH/' },
      { text: '治具无线负压检测（低速线）', link: '/custom/presssensorL/' }
    ]
  }
]


// https://vitepress.yiov.top/
// https://vitepress.dev/reference/site-config
export default withMermaid(
defineConfig({
  lang: 'zh-CN',
  srcDir: markdownSrcDir,
  base: siteBase,
  lastUpdated: true,
  ignoreDeadLinks: true,

  // Keep published model URLs working without duplicating the series documents
  // in local search or the Markdown-to-PDF pipeline.
  buildEnd(siteConfig) {
    for (const row of ioModules) {
      if ((row.category !== 'DI' && row.category !== 'DO') || !row.href) continue
      const target = `${siteConfig.site.base}${row.href.slice(1)}`
      const legacyFile = path.join(siteConfig.outDir, 'pexus', 'edge', row.category, `${row.model}.html`)
      fs.writeFileSync(legacyFile, `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${target}">
<title>正在打开系列文档</title>
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
</head><body><p>文档已合并至<a href="${target}">系列使用说明</a>。</p></body></html>`, 'utf8')
    }
  },

  vite: {
    plugins: [
      {
        name: 'ignore-missing-images',
        enforce: 'pre',
        resolveId(source: string, importer: string | undefined) {
          if (/\.(png|jpe?g|gif|svg|webp)$/i.test(source) && importer) {
            const absolutePath = path.resolve(path.dirname(importer), source)
            
                        // 净化 importer 路径，去掉 Vite 附加的 ?vue 等参数
            const cleanImporter = importer.split('?')[0]

            if (!fs.existsSync(absolutePath)) {
              const mdFile = path.relative(process.cwd(), cleanImporter)
              let lineNumber = '未知行'
              try {
                const fileContent = fs.readFileSync(cleanImporter, 'utf-8')
                const lines = fileContent.split(/\r?\n/)
                
                // 【终极修改】：只提取纯文件名（比如 image.png）去匹配！
                const fileName = path.basename(source) 
                
                // 只要这一行包含这个文件名，就认为是我们要找的那一行
                const lineIndex = lines.findIndex(line => line.includes(fileName))
                if (lineIndex !== -1) {
                  lineNumber = `${lineIndex + 1}`
                }
              } catch (e) {
                // 如果再出未知行，把下面这行注释打开，看看是不是报了其他系统错
                // console.log(`[调试] 文件读取失败: ${cleanImporter}`, e.message)
              }
              
              console.warn(`\n🛡️ [隐私保护] 已隐藏图片: ${source}\n   📄 来源定位: ${mdFile}:${lineNumber} ]`)
              return '\0missing-image-fallback'
            }
          }
          return null
        },
        load(id: string) {
          if (id === '\0missing-image-fallback') {
            return `export default "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"`
          }
        }
      }
    ]
  },


  markdown: {
    config: (md) => {
      md.use(wavedromPlugin)
      // Register caution & notice as custom containers
      md.use(container, 'caution', { render: makeContainer('CAUTION') })
      md.use(container, 'notice',  { render: makeContainer('NOTICE') })
    }
  },

  title: "小美技术",
  description: "Pexus 标准自动化控制平台与工业数字化解决方案",
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo/xmlogo20261109.svg' }],
    ['script', { type: 'module', src: '/js/model-viewer.min.js' }],
    ['script', { src: '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit', async: true }],
    ['script', {}, `
      function googleTranslateElementInit() {
        new google.translate.TranslateElement({
          pageLanguage: 'zh-CN',
          includedLanguages: 'en,zh-CN',
          autoDisplay: false,
          layout: google.translate.TranslateElement.InlineLayout.SIMPLE
        }, 'google_translate_element');
      }
    `]
  ],
  themeConfig: {
    lastUpdated:{text: '最后更新',
      formatOptions: {
          dateStyle: 'full',
          timeStyle: 'medium'
        }
      },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    footer: {
      message: `<span class="footer-beian">
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">粤ICP备2026139328号</a>
        <a href="https://beian.mps.gov.cn/#/query/webSearch?code=44196602000254" target="_blank" rel="noopener noreferrer">
          <img src="${siteBase}logo/public-security-beian.png" alt="" width="18" height="20" />
          <span>粤公网安备44196602000254号</span>
        </a>
      </span>`
    },

    // https://vitepress.dev/reference/default-theme-config
    siteTitle: '小美技术',
    logo: {
      src: '/logo/xmlogo20261109.svg',
      alt: '小美技术 Logo'
    },


    nav: [
      { text: '首页', link: '/' },
      { text: 'Pexus', link: '/pexus/' },
      { text: '工业控制器', link: '/custom/' },
      { text: '关于与支持', items: [
        { text: '关于我们', link: '/company/' },
        { text: 'PDF手册', link: '/pdf/' },
        { text: '网站测试', link: '/web-debug/' },


      ]},
      { text: '资料下载',  items:
        [
          {text: '百度网盘', link:'https://pan.baidu.com/s/5QsFtoVzwyIoA_9J2bah8Zw?'},
          {text: 'Github', link:'https://github.com/XiaomeiTech/XiaomeiTech.github.io/releases'},
        ]
      }
    ],
 
    sidebar: {
      '/pexus/': pexusSidebar,
      '/pexus/edge/': pexusSidebar,

      '/custom/': industrialSidebar,
      '/feeder-controller/': industrialSidebar,

      '/pdf/': [
        {
          text: 'PDF手册',
          items: [
            { text: '导出说明', link: '/pdf/' },
            { text: '数据手册', link: '/pdf/datasheet' },
            { text: '应用指南', link: '/pdf/app-guide' },
            { text: '单品手册', link: '/pdf/product-manual' },
            { text: '系列合并手册', link: '/pdf/series-manual' },
            { text: '法律与合规', link: '/pdf/legal' },
            { text: 'PDF 编译指南', link: '/pdf/pdf-guide' }
          ]
        }
      ],


      '/company/': [
        {
          text: '关于小美',
          items: [
            { text: '公司介绍', link: '/company/' }
          ]
        }
      ],

      // '/web/': [
      //   {
      //     text: '开发指南',
      //     items: [
      //       { text: 'Markdown 示例', link: '/web/markdown-examples' },
      //       { text: 'Runtime API 示例', link: '/web/api-examples' },
      //       { text: '本地开发运行', link: '/web/localsetup' }
      //     ]
      //   }
      // ]
    }
  }
}))
