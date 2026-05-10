<script setup>
import { ref, onMounted } from 'vue'

// 原始数据
const traceResult = ref('正在获取 Cloudflare trace 信息...')
// 解析后数据
const parsedData = ref({})

onMounted(() => {
  // 强制获取当前网站 /cdn-cgi/trace
  const url = new URL('/cdn-cgi/trace', window.location.origin).href

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('当前网站未接入 Cloudflare')
      return response.text()
    })
    .then(data => {
      traceResult.value = data

      // 自动解析
      let obj = {}
      data.split('\n').forEach(line => {
        if (line.includes('=')) {
          let [k, v] = line.split('=')
          obj[k.trim()] = v.trim()
        }
      })
      parsedData.value = obj
    })
    .catch(error => {
      traceResult.value = '获取失败: ' + error
    })
})
</script>

## [Cloudflare Test](/cdn-cgi/trace) Result

### 🔍 解析后信息
<div style="margin:1em 0; border:1px solid #eee; border-radius:6px; overflow:hidden;">
  <div v-for="(val, key) in parsedData" :key="key" style="display:flex; flex-wrap:wrap; padding:10px 14px; border-bottom:1px solid #eee; background:#fafafa;">
    <span style="font-weight:600; min-width:100px; color:#2c3e50;">{{ key }}:</span>
    <span style="color:#3498db; flex:1; word-break:break-all;">{{ val }}</span>
  </div>
</div>

### 📄 原始数据
<pre
  style="
    white-space: pre-wrap;
    word-break: break-all;
    padding: 1rem;
    border-radius: 6px;
    line-height: 1.6;
    background: #f7f7f7;
  "
>
{{ traceResult }}
</pre>

## Syntax Highlighting

VitePress provides Syntax Highlighting powered by [Shiki](https://github.com/shikijs/shiki), with additional features like line-highlighting:

**Input**

````md
```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```
````

**Output**

```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

## Custom Containers

**Input**

```md
::: danger
表示即将发生的危险情况，如果不避免将导致死亡或严重伤害
:::
::: warning
表示潜在的危险情况，如果不避免可能导致死亡或严重伤害
:::
::: caution
表示潜在的危险情况，如果不避免可能导致轻微或中度伤害
:::
::: notice
表示与人身伤害无关的操作注意事项，如设备损坏、数据丢失、程序异常等风险
:::
::: info
表示补充信息，提供额外的背景说明、原理解释、附加提示内容
:::
::: tip
表示实用技巧、最佳实践、快捷方法、经验建议等指导性内容
:::
::: details
可放置冗余说明、参数附表、操作附录、扩展阅读等次要补充内容
::: 
```

**Output**


::: danger
表示即将发生的危险情况，如果不避免将导致死亡或严重伤害
:::
::: warning
表示潜在的危险情况，如果不避免可能导致死亡或严重伤害
:::
::: caution
表示潜在的危险情况，如果不避免可能导致轻微或中度伤害
:::
::: notice
表示与人身伤害无关的操作注意事项，如设备损坏、数据丢失、程序异常等风险
:::
::: info
表示补充信息，提供额外的背景说明、原理解释、附加提示内容
:::
::: tip
表示实用技巧、最佳实践、快捷方法、经验建议等指导性内容
:::
::: details
可放置冗余说明、参数附表、操作附录、扩展阅读等次要补充内容
::: 

## More

Check out the documentation for the [full list of markdown extensions](https://vitepress.dev/guide/markdown).



## 绘制 SPI 波形图

在 VitePress 中绘制 WaveDrom 波形，通常可以通过配置 Markdown 插件（例如 `markdown-it-wavedrom` 或 `vitepress-plugin-wavedrom`）来实现。以下是一个标准的 SPI 通信波形示例（SPI Mode 0）。

## SPI (Serial Peripheral Interface) - Mode 0
特性：你提供的 Mode 0 经典时序，CS 拉低片选有效，SCK 空闲为低（CPOL=0），在第一个上升沿采样数据（CPHA=0）。

```wavedrom
{ "signal": [
  { "name": "CS",   "wave": "10........1" },
  { "name": "SCK",  "wave": "0.p.......0" },
  { "name": "MOSI", "wave": "x.========x", "data": ["D7","D6","D5","D4","D3","D2","D1","D0"] },
  { "name": "MISO", "wave": "x.========x", "data": ["D7","D6","D5","D4","D3","D2","D1","D0"] }
]}
```

## I2C (Inter-Integrated Circuit)
特性：

Start 条件：SCL 为高电平时，SDA 产生下降沿。

数据传输：SCL 高电平时采样，SDA 在 SCL 低电平时允许翻转。

ACK 应答：第 9 个时钟周期，接收方拉低 SDA 作为应答。

Stop 条件：SCL 为高电平时，SDA 产生上升沿。
```wavedrom
{ "signal": [
  { "name": "SCL", "wave": "1.0p........01.." },
  { "name": "SDA", "wave": "10.=========0.1.", "data": ["D7","D6","D5","D4","D3","D2","D1","D0", "ACK"] }
]}
```


## I3C (Improved Inter-Integrated Circuit) - SDR 模式
特性：I3C 向下兼容 I2C，但在高速单数据速率（SDR）模式下，使用推挽（Push-Pull）驱动。与 I2C 最大的不同是，数据传输阶段用 1 位的 T-Bit（Transition Bit，通常用作奇偶校验或结束标志）替代了 I2C 的 ACK 位。
```wavedrom
{ "signal": [
  { "name": "SCL", "wave": "1.0p........01.." },
  { "name": "SDA", "wave": "10.=========0.1.", "data": ["D7","D6","D5","D4","D3","D2","D1","D0", "T-Bit"] }
]}
```
## UART (Universal Asynchronous Receiver-Transmitter)
特性：异步通信，无时钟线。默认空闲为高电平（1），通过拉低产生 Start Bit（0），紧接着传输 8 位数据（通常是 LSB 优先，先传 D0），最后通过拉高产生 Stop Bit（1）。
```wavedrom
{ "signal": [
  { "name": "TX/RX", "wave": "1=========1..", "data": ["Start", "LSB", "D1", "D2", "D3", "D4", "D5", "D6", "MSB", "Stop"] }
]}
```


### 注意事项：
在 VitePress 中实际预览此波形时，依赖于 `vitepress-plugin-wavedrom` 及 `wavedrom` 包提供在网页的渲染支持。现在已经为您配置好。
您可以本地运行 `npm run docs:dev` 进行效果预览！


