import type { Project } from '../types'
import { anyPhaseOfName } from './phases'
import { PHASE_ORDER, urgencyKey } from './phaseConfig'

export type UrgencyGroup =
  | 'normal'
  | 'design_warn' | 'design_overdue'
  | 'prod_warn' | 'prod_overdue'
  | 'tune_warn' | 'tune_overdue'
  | 'tail_warn' | 'tail_overdue'
  | 'rectify'
  | 'completed'

export const GROUP_LABELS: Record<UrgencyGroup, string> = {
  normal: '正常运行中',
  design_warn: '机械设计预警', design_overdue: '机械设计逾期',
  prod_warn: '生产预警', prod_overdue: '生产逾期',
  tune_warn: '调机预警', tune_overdue: '调机逾期',
  tail_warn: '尾款预警', tail_overdue: '尾款逾期',
  rectify: '整改中',
  completed: '已完结',
}

export const GROUP_ORDER: UrgencyGroup[] = [
  'normal',
  'design_warn', 'design_overdue',
  'prod_warn', 'prod_overdue',
  'tune_warn', 'tune_overdue',
  'tail_warn', 'tail_overdue',
  'rectify',
  'completed',
]

export function projectUrgency(p: Project): UrgencyGroup {
  if (p.phases.some((ph) => ph.is_rectify && !ph.actual_end_date)) return 'rectify'
  for (const name of PHASE_ORDER) {
    if (anyPhaseOfName(p.phases, name, (ph) => ph.phase_progress === '逾期')) {
      return urgencyKey(name, 'overdue') as UrgencyGroup
    }
    if (anyPhaseOfName(p.phases, name, (ph) => ph.phase_progress === '预警')) {
      return urgencyKey(name, 'warn') as UrgencyGroup
    }
  }
  if (p.project_status === '已完成') return 'completed'
  return 'normal'
}

export function groupByUrgency(projects: Project[]): Record<UrgencyGroup, Project[]> {
  const map: Record<UrgencyGroup, Project[]> = Object.fromEntries(
    GROUP_ORDER.map((g) => [g, [] as Project[]])
  ) as Record<UrgencyGroup, Project[]>
  for (const p of projects) {
    map[projectUrgency(p)].push(p)
  }
  return map
}

// Roles that see ALL urgency groups (admin-level views)
const FULL_VIEW_ROLES = ['admin', 'tech_supervisor', 'after_sales_super', 'project_manager', 'sales_assistant', 'salesman']

// Per-role tab visibility: each executor role sees their own phase + normal/completed/rectify
const ROLE_URGENCY: Record<string, UrgencyGroup[]> = {
  mechanical_designer: ['normal', 'design_warn', 'design_overdue', 'rectify', 'completed'],
  production_executor:   ['normal', 'prod_warn', 'prod_overdue', 'rectify', 'completed'],
  tuning_executor:       ['normal', 'tune_warn', 'tune_overdue', 'rectify', 'completed'],
}

export function visibleGroups(roleCodes: string[]): UrgencyGroup[] {
  if (roleCodes.some((r) => FULL_VIEW_ROLES.includes(r))) return GROUP_ORDER
  for (const r of roleCodes) {
    if (ROLE_URGENCY[r]) return ROLE_URGENCY[r]
  }
  return GROUP_ORDER
}
