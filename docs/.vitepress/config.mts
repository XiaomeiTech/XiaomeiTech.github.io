import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import wavedromPlugin from './wavedrom.mts'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const repoName = env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserOrOrgPagesRepo = repoName.endsWith('.github.io')
const githubBase = repoName && !isUserOrOrgPagesRepo ? `/${repoName}/` : '/'
const markdownSrcDir = fileURLToPath(new URL('../../markdown', import.meta.url))


// https://vitepress.yiov.top/
// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  srcDir: markdownSrcDir,
  base: env.GITHUB_ACTIONS ? githubBase : '/',
  lastUpdated: true,
  
  markdown: {
    config: (md) => {
      md.use(wavedromPlugin)
    }
  },

  title: "小美技术",
  description: "工业数字化解决方案",
  head: [
    ['link', { rel: 'icon', href: '/logo/xm-logo.png' }]
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

    // footer: {
    //   message: 'Released under the MIT License.',
    //   copyright: 'Copyright © 2019-present Evan You'
    // },  

    // https://vitepress.dev/reference/default-theme-config
    siteTitle: '小美技术',
    logo: {
      src: '/logo/xm-logo.png',
      alt: '小美技术 Logo'
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '远程IO系统', link: '/remoteIO/' },
      { text: '飞达控制器', link: '/feeder-controller/' },
      { text: '定制项目', link: '/custom/' },
      { text: '关于与支持', items: [
        { text: '关于我们', link: '/company/' },
        { text: 'PDF手册', link: '/pdf/' },
        { text: 'Markdown 示例', link: '/web/markdown-examples' },
        { text: 'Runtime API 示例', link: '/web/api-examples' },
        { text: '本地开发运行', link: '/web/localsetup' },
        { text: '波形图示例', link: '/web/wavedrom' },

      ]},
      { text: '下载中心', link: 'https://github.com/XiaomeiTech/XiaomeiTech.github.io/releases'},
    ],
 
    sidebar: {
      '/remoteIO/': [
        {
          text: '远程IO系统',
          items: [
            { text: '系统概述', link: '/remoteIO/' },
          ]
        },
        {
          text: '耦合器',
          items: [
            { text: 'EtherCAT耦合器', link: '/remoteIO/EtherCAT/' },
            { text: 'PROFINET耦合器', link: '/remoteIO/PROFINET/' },
            { text: 'EtherNet/IP耦合器', link: '/remoteIO/EtherNetIP/' },
            { text: 'Modbus耦合器', link: '/remoteIO/Modbus/' }
          ]
        },
        {
          text: '拓展模块',
          items: [
            { text: '模拟量输入AI', link: '/remoteIO/AI/' },
            { text: '模拟量输出AO', link: '/remoteIO/AO/' },
            { text: '数字量输入DI', link: '/remoteIO/DI/' },
            { text: '数字量输出DO', link: '/remoteIO/DO/' },
          ]
        }
      ],


      '/feeder-controller/': [
        {
          text: '飞达控制器',
          items: [
            { text: '控制器概述', link: '/feeder-controller/' }, 
            { text: '控制器说明', link: '/feeder-controller/manual/' },
          ]
        }
      ],


      '/custom/': [
        {
          text: '定制项目',
          items: [
            { text: '项目概览', link: '/custom/' }
          ]
        }
      ],

      '/pdf/': [
        {
          text: 'PDF手册',
          items: [
            { text: '导出说明', link: '/pdf/' },
            { text: '数据手册', link: '/pdf/datasheet' },
            { text: '应用指南', link: '/pdf/app-guide' },
            { text: '单品手册', link: '/pdf/product-manual' },
            { text: '系列合并手册', link: '/pdf/series-manual' },
            { text: '法律与合规', link: '/pdf/legal' }
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

      '/web/': [
        {
          text: '开发指南',
          items: [
            { text: 'Markdown 示例', link: '/web/markdown-examples' },
            { text: 'Runtime API 示例', link: '/web/api-examples' },
            { text: '本地开发运行', link: '/web/localsetup' }
          ]
        }
      ]
    }
  }
})
