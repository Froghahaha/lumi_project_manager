import { COLOR } from './design-tokens'

export const EQUIP_CATEGORIES = [
  '关节', '桁架', '视觉桁架', '工业机器人', '协作机器人',
  '智能上下料打磨机床', '输送带', '板链机', '顶升机', '提升机',
  '非标设备', '联线', '其他',
]

export const INCIDENT_COLORS: Record<string, string> = {
  原因: 'red',
  现状: 'blue',
  应急: COLOR.warningOrange,
  长效: COLOR.success,
}
