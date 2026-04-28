# 绘制 SPI 波形图

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