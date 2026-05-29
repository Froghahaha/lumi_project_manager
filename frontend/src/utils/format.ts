import type { ProjectEquipment } from '../types'
import { COLOR } from '../design-tokens'

export function equipSummary(list: ProjectEquipment[]) {
  if (!list || list.length === 0) return { category: '-', spec: '-', quantity: 0 }
  const cats = [...new Set(list.map(e => e.category).filter(Boolean))]
  const specs = list.map(e => e.spec).filter(Boolean)
  const total = list.reduce((s, e) => s + (e.quantity || 0), 0)
  return { category: cats.join('/') || '-', spec: specs.join('/') || '-', quantity: total }
}

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
  if (ph.actual_end_date) return false
  const today = new Date().toISOString().slice(0, 10)
  return today > ph.planned_end_date
}

// ─── Phase status constants (typed) ────────────────────────

export function phaseStatusOptions(ph: { sub_statuses_json?: string }): string[] {
  if (ph.sub_statuses_json) {
    try {
      const arr = JSON.parse(ph.sub_statuses_json) as string[]
      if (arr.length > 0) return arr
    } catch { /* ignore parse errors */ }
  }
  return []
}


// ─── Phase progress status ─────────────────────────────────

export type PhaseProgressStatus = '未开始' | '进行中' | '预警' | '逾期' | '已完成'


/** Hex values — mapped to centralized design tokens. */
export const PROGRESS_HEX: Record<PhaseProgressStatus, string> = {
  '未开始': COLOR.disabled,
  '进行中': COLOR.primary,
  '预警':   COLOR.warningOrange,
  '逾期':   COLOR.error,
  '已完成': COLOR.success,
}

// ─── Phase status tag display ───────────────────────────────
// Shows the actual phase status text, colored by terminal awareness:
//   未开始 → gray(default)  其他 → blue(processing)   terminal → green(success)

export function phaseStatusTagProps(ph: { status?: string; terminal_statuses_json?: string }): { text: string; color: 'default' | 'processing' | 'success' } {
  const s = ph.status || '未开始'
  if (!s || s === '未开始') return { text: '未开始', color: 'default' }
  if (ph.terminal_statuses_json) {
    try {
      const terminal = JSON.parse(ph.terminal_statuses_json) as string[]
      if (terminal.includes(s)) return { text: s, color: 'success' }
    } catch { /* ignore parse errors */ }
  }
  return { text: s, color: 'processing' }
}


// ─── Phase days display ────────────────────────────────────
// Returns countdown to planned_end_date or days elapsed if overdue.
//   -N天 (正常)  -3天 (预警黄色)  +N天 (逾期红色)

export function phaseDaysDisplay(ph: {
  start_date?: string | null
  planned_end_date?: string | null
  actual_end_date?: string | null
  status?: string
  phase_progress?: string
}): { text: string; color: string } | null {
  if (!ph.start_date) return null
  if (ph.phase_progress === '已完成') {
    const endStr = ph.actual_end_date || ph.planned_end_date || ph.start_date
    const end = new Date(endStr)
    end.setHours(0, 0, 0, 0)
    const start = new Date(ph.start_date!)
    start.setHours(0, 0, 0, 0)
    const days = Math.round((end.getTime() - start.getTime()) / 86400000)
    return { text: days > 0 ? days + '天' : '-', color: 'rgba(0,0,0,0.25)' }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (ph.planned_end_date) {
    const end = new Date(ph.planned_end_date)
    end.setHours(0, 0, 0, 0)
    const diff = Math.round((end.getTime() - today.getTime()) / 86400000)
    if (diff < 0) return { text: `+${Math.abs(diff)}天`, color: 'red' }
    if (diff <= 3) return { text: `-${diff}天`, color: '#faad14' }  // yellow
    return { text: `-${diff}天`, color: '#1677ff' }  // blue
  }
  // No planned_end_date — show days since start
  const start = new Date(ph.start_date)
  start.setHours(0, 0, 0, 0)
  const elapsed = Math.round((today.getTime() - start.getTime()) / 86400000)
  return { text: `${elapsed}天`, color: '#666' }
}


// ─── Project-level status derived from phases ─────────────

export type ProjectSummaryStatus = '正常' | '逾期' | '已完成'

export function getProjectStatus(phases: { status?: string; planned_end_date?: string | null; actual_end_date?: string | null; terminal_statuses_json?: string }[]): ProjectSummaryStatus {
  const hasOverdue = phases.some(ph => !ph.actual_end_date && phaseOverdue(ph))
  if (hasOverdue) return '逾期'
  const allDone = phases.length > 0 && phases.every(ph => {
    const tsj = ph.terminal_statuses_json
    if (tsj) { try { return !!(ph.status && JSON.parse(tsj).includes(ph.status)) } catch { return false } }
    return !!ph.actual_end_date
  })
  if (allDone) return '已完成'
  return '正常'
}
