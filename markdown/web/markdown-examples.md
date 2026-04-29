# Markdown Extension Examples

This page demonstrates some of the built-in markdown extensions provided by VitePress.

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
