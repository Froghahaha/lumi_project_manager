/** Phase config — mirrors backend lifecycle, single source for frontend constants.
 *  NEVER hardcode phase seq/name in component code. Use this module. */
import type { Project } from '../types'

// ── Phase identity ──────────────────────────────────────────

export const PHASE_ORDER = ['机械设计', '生产', '调机', '尾款'] as const
export type PhaseName = typeof PHASE_ORDER[number]

export const PHASE_SEQ: Record<string, number> = {
  '机械设计': 1, '生产': 2, '调机': 3, '尾款': 4,
}

export const SEQ_NAME: Record<number, string> = {
  1: '机械设计', 2: '生产', 3: '调机', 4: '尾款',
}

export const SEQ_FIRST = 1
export const SEQ_LAST = 4

// ── Urgency key mapping ─────────────────────────────────────

const URGENCY_PREFIX: Record<number, string> = {
  1: 'design', 2: 'prod', 3: 'tune', 4: 'tail',
}

export function urgencyKey(phaseName: string, level: 'warn' | 'overdue'): string {
  const seq = PHASE_SEQ[phaseName] || 0
  return `${URGENCY_PREFIX[seq] || 'normal'}_${level}`
}

// ── Role-scoped phase visibility ────────────────────────────

/** Which seq a role is responsible for (maps to phase_responsibility:N) */
export const ROLE_RESPONSIBILITY: Record<string, number[]> = {
  mechanical_designer:  [1],
  software_designer:    [1],
  production_executor:  [2],
  tuning_executor:      [3],
  acceptance_executor:  [3],
}

/** Role -> assignable role codes (mirrors seed.py ROLE_DEFINITIONS assigns_json) */
export const ROLE_ASSIGNS: Record<string, string[]> = {
  tech_supervisor:    ['project_manager', 'mechanical_designer', 'software_designer', 'production_executor'],
  after_sales_super:  ['tuning_executor', 'acceptance_executor'],
}

// ── Phase-specific warnings (backend should ideally compute these) ──

export function phaseWarnings(p: Project): { type: string; message: string }[] {
  const warnings: { type: string; message: string }[] = []

  // 图纸已下发 but no agreement
  const designPhases = p.phases.filter((ph) => ph.seq === 1)
  if (designPhases.some((ph) => ph.status === '图纸已下发') && !p.agreement_filename) {
    warnings.push({ type: 'design_no_agreement', message: '图纸已下发但未上传技术协议，请联系销售上传' })
  }

  // 已发货 but no agreement
  const prodPhases = p.phases.filter((ph) => ph.seq === 2)
  if (prodPhases.some((ph) => ph.status === '已发货') && !p.agreement_filename) {
    warnings.push({ type: 'ship_no_agreement', message: '已发货但未上传技术协议' })
  }

  // Payment due date overdue
  if (p.payment_due_date && new Date(p.payment_due_date) < new Date()) {
    warnings.push({ type: 'payment_due', message: `尾款到期 ${p.payment_due_date.slice(0, 10)}` })
  }

  return warnings
}

// ── Supervisor managed phases ───────────────────────────────

/** Which seqs each supervisor role manages */
export const SUPERVISOR_SEQS: Record<string, number[]> = {
  tech_supervisor: [1, 2],
  after_sales_super: [3, 4],
}

export function managedByRole(roleCode: string): number[] {
  return SUPERVISOR_SEQS[roleCode] || []
}

// ── Phase-level permissions per role ────────────────────────
// Central config: which role can do what on which phase seq.
// Mirrors backend: add_assignment role check + deny_salesman on write ops.

export interface PhasePerms {
  canEditDates: boolean
  canAssign: boolean
  roleCodeForAssign: string
  canUpdateStatus: boolean
  canAddIncident: boolean
  canDelete: boolean
}

const SEQ_TO_ROLE: Record<number, string> = {
  1: 'mechanical_designer', 2: 'production_executor',
  3: 'tuning_executor', 4: 'salesman',
}

export function phasePermissions(
  role: string,
  seq: number,
  isMyPhase: boolean,
  isProjectMember: boolean,
): PhasePerms {
  const isAdmin = role === 'admin'
  const isTechSuper = role === 'tech_supervisor'
  const isAfterSales = role === 'after_sales_super'
  const managed = (isTechSuper && [1, 2].includes(seq)) || (isAfterSales && [3, 4].includes(seq))
  const canEdit = isAdmin || managed

  return {
    canEditDates: canEdit,
    canAssign: canEdit,
    roleCodeForAssign: SEQ_TO_ROLE[seq] || '',
    canUpdateStatus: isMyPhase || isAdmin || managed,
    canAddIncident: isAdmin || ['tech_supervisor', 'after_sales_super'].includes(role)
      || isMyPhase || isProjectMember
      || (seq === 4 && role === 'salesman'),
    canDelete: canEdit,
  }
}
