export type ModelLabProfile = {
  id: string
  path: string
  title: string
  note: string
  storageKey: string
  orbit: string
  revision?: string
  closeup?: { orbit: string; target: string }
  contactsView?: { orbit: string; target: string }
  oppositeView?: { orbit: string; target: string }
  panel?: boolean
  connectorCount?: 1 | 2
  cad?: 'slave' | 'master'
  labels?: string[]
}

export const modelLabProfiles: ModelLabProfile[] = [
  ...(['green', 'black'] as const).flatMap(color => ([1, 2] as const).map(count => ({
    id: `io-slave-${color}-${count}`,
    path: `/models/io-slave-${color}-${count}.glb`,
    title: `从模块 · ${color === 'green' ? '绿色' : '黑色'} · ${count === 1 ? '单' : '双'}连接器`,
    note: `${color === 'green' ? 'DI / AI 输入配色' : 'DO / AO 输出配色'}；${count === 1 ? '仅保留下方 2×9 pin，上方连接器已移除。' : '上方 2×8 pin，下方 2×9 pin。'}`,
    storageKey: `xm-model-lab-io-slave-${color}-${count}-v4`,
    revision: 'contacts-buttons-4',
    connectorCount: count,
    cad: 'slave' as const,
    orbit: '35deg 75deg 105%',
    closeup: { orbit: '15deg 65deg 0.095m', target: '-0.0196m -0.02135m 0.081m' },
    contactsView: { orbit: '65deg 70deg 0.09m', target: '-0.006m 0.038m 0.014m' },
    oppositeView: { orbit: '-65deg 65deg 0.09m', target: '-0.032m 0.038m 0.014m' }
  }))),
  {
    id: 'io-master-compatible', path: '/models/io-master-compatible.glb',
    title: '主模块 · SolidWorks 装配体',
    note: '兼容版装配体；外壳沿用冷灰细纹注塑材质，其他部件可独立调整。',
    storageKey: 'xm-model-lab-io-master-v1', orbit: '35deg 75deg 105%', cad: 'master'
  },
  {
    id: 'im2620-ec', path: '/models/im2620c-ec-panel.glb',
    title: 'IM2620 · EtherCAT 实体前面板',
    note: '原有实物参考预设，包含 0.35 mm 实体前面板与右侧 USB 开孔。',
    storageKey: 'xm-model-lab-im2620-ec-solid-v1', orbit: '25deg 70deg 105%', panel: true, cad: 'master',
    labels: ['外壳 · 冷灰细纹', '接口 · 金属屏蔽壳', '网口 · 黑色内芯', '触点 · 镀金', 'USB · 金属外壳', 'USB · 绝缘内芯', '内部金属件', '电源 · 黑色端子', '绿色指示灯', '黄色指示灯', 'USB 接触片', '其他结构件', '前面板 · IM2620 EC', '前面板 · 实体切边']
  }
]
