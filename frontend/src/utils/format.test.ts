import { describe, expect, it } from 'vitest'
import {
  getProjectStatus,
  phaseOverdue,
} from './format'

// ─── Helpers ──────────────────────────────────────────────────

function past(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function future(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── phaseOverdue ────────────────────────────────────────────

describe('phaseOverdue', () => {
  it('returns false when no planned_end_date', () => {
    expect(phaseOverdue({})).toBe(false)
  })

  it('returns false when already completed', () => {
    expect(phaseOverdue({
      planned_end_date: past(5),
      actual_end_date: past(3),
    })).toBe(false)
  })

  it('returns true when past planned_end_date and not completed', () => {
    expect(phaseOverdue({
      planned_end_date: past(3),
    })).toBe(true)
  })

  it('returns false when before planned_end_date', () => {
    expect(phaseOverdue({
      planned_end_date: future(3),
    })).toBe(false)
  })

  it('returns false on the planned_end_date itself', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(phaseOverdue({ planned_end_date: today })).toBe(false)
  })
})

// ─── getProjectStatus ────────────────────────────────────────

describe('getProjectStatus', () => {
  it('逾期 — has at least one overdue phase', () => {
    const phases = [
      { planned_end_date: past(3) },
      { actual_end_date: past(1), planned_end_date: past(5) },
    ]
    expect(getProjectStatus(phases)).toBe('逾期')
  })

  it('已完成 — all phases completed', () => {
    const phases = [
      { actual_end_date: past(3) },
      { actual_end_date: past(1) },
    ]
    expect(getProjectStatus(phases)).toBe('已完成')
  })

  it('正常 — no overdue, not all completed', () => {
    const phases = [
      { planned_end_date: future(10) },
      { actual_end_date: past(1) },
    ]
    expect(getProjectStatus(phases)).toBe('正常')
  })

  it('正常 — empty phases', () => {
    expect(getProjectStatus([])).toBe('正常')
  })
})
