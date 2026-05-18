export function fmtDate(d: string | null): string {
  if (!d) return '-'
  return d.slice(0, 10)
}

export function fmtShortDate(d: string | null): string {
  if (!d) return '-'
  return d.slice(5)
}

export function phaseOverdue(ph: { planned_end_date?: string | null; actual_end_date?: string | null }): boolean {
  if (!ph.planned_end_date) return false
  const end = ph.actual_end_date ? new Date(ph.actual_end_date) : new Date()
  return end > new Date(ph.planned_end_date)
}

const STATUS_MAP: Record<string, string[]> = {
  '机械设计': ['未开始', '设计中', '图纸已下发'],
  '生产': ['未开始', '生产中', '生产完成', '已发货'],
  '调机': ['未开始', '安调中', '安调完成'],
  '验收': ['未开始', '已验收'],
  '尾款': [],
}

export function defaultStatuses(phaseName: string): string[] {
  return STATUS_MAP[phaseName] || ['未开始', '进行中', '已完成']
}

const STATUS_COLORS: Record<string, string> = {
  '未开始': 'default',
  '设计中': 'processing',
  '图纸已下发': 'success',
  '生产中': 'processing',
  '生产完成': 'success',
  '已发货': 'success',
  '安调中': 'processing',
  '安调完成': 'success',
  '已验收': 'success',
}

export function phaseStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'default'
}
