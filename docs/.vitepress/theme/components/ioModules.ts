export type ModuleCategory = 'IM' | 'DI' | 'DO' | 'AI' | 'AO'
export const productStatuses = ['未发布', '预发布', '正在供货', '不推荐新设计'] as const
export type ProductStatus = typeof productStatuses[number]

export interface IoModule {
  model: string
  category: ModuleCategory
  channels?: number
  channelLabel?: string
  signal: string
  status: ProductStatus
  protocol?: 'EC' | 'EIP' | 'PN'
  href?: string
}

// The version suffix belongs to the model, before an optional protocol suffix.
// In particular, the P in "EIP" is not a performance marker.
export const isPerformanceModule = (row: Pick<IoModule, 'model'>) => row.model.split('-')[0].endsWith('P')

export const moduleCategories: { value: ModuleCategory; label: string }[] = [
  { value: 'IM', label: '耦合器' },
  { value: 'DI', label: '数字量输入' },
  { value: 'DO', label: '数字量输出' },
  { value: 'AI', label: '模拟量输入' },
  { value: 'AO', label: '模拟量输出' }
]

// Explicit catalog, not a Cartesian product of the naming codes.
// Sources: the original Edge overview/naming-reference and the owner's corrections:
// 5 = AO, 6 = AI; analog modules have 8 channels. The owner confirmed analog
// current/voltage/mixed variants and AO code 7 for configurable current/voltage.
// The owner confirmed P performance variants for EM modules and IM couplers.
// Unsuffixed model codes are standard versions. Do not add unconfirmed C variants.
export const ioModules: readonly IoModule[] = [
  // Standard couplers from the Edge overview; IM5620-EIP confirmed by the owner.
  // IM2610C belongs to the custom EM7230L system, not this standard catalog.
  { model: 'IM1620-PN', category: 'IM', signal: 'PROFINET', status: '未发布', protocol: 'PN', href: '/pexus/edge/PROFINET/' },
  { model: 'IM2620-EC', category: 'IM', signal: 'EtherCAT', status: '未发布', protocol: 'EC', href: '/pexus/edge/EtherCAT/' },
  { model: 'IM3620-MT', category: 'IM', signal: 'Modbus TCP', status: '未发布', href: '/pexus/edge/Modbus/' },
  { model: 'IM5620-EIP', category: 'IM', signal: 'EtherNet/IP', status: '未发布', protocol: 'EIP', href: '/pexus/edge/EtherNetIP/' },
  { model: 'IM1620P-PN', category: 'IM', signal: 'PROFINET', status: '未发布', protocol: 'PN', href: '/pexus/edge/PROFINET/' },
  { model: 'IM2620P-EC', category: 'IM', signal: 'EtherCAT', status: '未发布', protocol: 'EC', href: '/pexus/edge/EtherCAT/' },
  { model: 'IM3620P-MT', category: 'IM', signal: 'Modbus TCP', status: '未发布', href: '/pexus/edge/Modbus/' },
  { model: 'IM5620P-EIP', category: 'IM', signal: 'EtherNet/IP', status: '未发布', protocol: 'EIP', href: '/pexus/edge/EtherNetIP/' },
  { model: 'EM1230', category: 'DI', channels: 16, signal: '双向输入', status: '未发布' },
  { model: 'EM1430', category: 'DI', channels: 32, signal: '双向输入', status: '未发布' },
  { model: 'EM2210', category: 'DO', channels: 16, signal: 'PNP 型', status: '未发布' },
  { model: 'EM2220', category: 'DO', channels: 16, signal: 'NPN 型', status: '未发布' },
  { model: 'EM2410', category: 'DO', channels: 32, signal: 'PNP 型', status: '未发布' },
  { model: 'EM2420', category: 'DO', channels: 32, signal: 'NPN 型', status: '未发布' },
  { model: 'EM5140', category: 'AO', channels: 8, signal: '电流', status: '未发布' },
  { model: 'EM5150', category: 'AO', channels: 8, signal: '电压', status: '未发布' },
  { model: 'EM5160', category: 'AO', channels: 8, channelLabel: '4+4', signal: '电流 / 电压混合', status: '未发布' },
  { model: 'EM5170', category: 'AO', channels: 8, signal: '电流 / 电压可配置', status: '未发布' },
  { model: 'EM6140', category: 'AI', channels: 8, signal: '电流', status: '未发布' },
  { model: 'EM6150', category: 'AI', channels: 8, signal: '电压', status: '未发布' },
  { model: 'EM6160', category: 'AI', channels: 8, channelLabel: '4+4', signal: '电流 / 电压混合', status: '未发布' },
  { model: 'EM1230P', category: 'DI', channels: 16, signal: '双向输入', status: '未发布' },
  { model: 'EM1430P', category: 'DI', channels: 32, signal: '双向输入', status: '未发布' },
  { model: 'EM2210P', category: 'DO', channels: 16, signal: 'PNP 型', status: '未发布' },
  { model: 'EM2220P', category: 'DO', channels: 16, signal: 'NPN 型', status: '未发布' },
  { model: 'EM2410P', category: 'DO', channels: 32, signal: 'PNP 型', status: '未发布' },
  { model: 'EM2420P', category: 'DO', channels: 32, signal: 'NPN 型', status: '未发布' },
  { model: 'EM5140P', category: 'AO', channels: 8, signal: '电流', status: '未发布' },
  { model: 'EM5150P', category: 'AO', channels: 8, signal: '电压', status: '未发布' },
  { model: 'EM5160P', category: 'AO', channels: 8, channelLabel: '4+4', signal: '电流 / 电压混合', status: '未发布' },
  { model: 'EM5170P', category: 'AO', channels: 8, signal: '电流 / 电压可配置', status: '未发布' },
  { model: 'EM6140P', category: 'AI', channels: 8, signal: '电流', status: '未发布' },
  { model: 'EM6150P', category: 'AI', channels: 8, signal: '电压', status: '未发布' },
  { model: 'EM6160P', category: 'AI', channels: 8, channelLabel: '4+4', signal: '电流 / 电压混合', status: '未发布' }
]
