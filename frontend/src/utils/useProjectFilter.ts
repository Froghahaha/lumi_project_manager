/** Shared project filtering, sorting, and searching logic for all workspaces. */
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { Project } from '../types'
import { groupByUrgency, GROUP_ORDER } from './urgency'

export type StatusFilter = 'all' | 'normal' | 'warn' | 'overdue' | 'completed' | 'rectify'
export type PhaseTypeFilter = 'all' | '机械设计' | '生产' | '调机' | '尾款'

export interface ProjectFilterState {
  statusFilter: StatusFilter
  phaseTypeFilter: PhaseTypeFilter
  searchText: string
  sortAsc: boolean
}

export interface ProjectFilterData {
  sortedProjects: Project[]
  filteredProjects: Project[]
  statusCounts: Record<StatusFilter, number>
}

export interface ProjectFilterActions {
  setStatusFilter: Dispatch<SetStateAction<StatusFilter>>
  setPhaseTypeFilter: Dispatch<SetStateAction<PhaseTypeFilter>>
  setSearchText: Dispatch<SetStateAction<string>>
  setSortAsc: Dispatch<SetStateAction<boolean>>
}

export function useProjectFilter(
  projects: Project[],
  customerMap: Record<string, string>,
): ProjectFilterState & ProjectFilterData & ProjectFilterActions {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [phaseTypeFilter, setPhaseTypeFilter] = useState<PhaseTypeFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [sortAsc, setSortAsc] = useState(false)

  // ── Pre-compute urgency grouping ──────────────────────────
  const grouped = useMemo(() => groupByUrgency(projects), [projects])

  // ── Sort ──────────────────────────────────────────────────
  const sortedProjects = useMemo(() => {
    const dir = sortAsc ? 1 : -1
    function cmpDate(a: string | null, b: string | null): number {
      if (!a && !b) return 0
      if (!a) return 1
      if (!b) return -1
      return dir * (new Date(a).getTime() - new Date(b).getTime())
    }
    return [...projects].sort((a, b) => {
      let d = cmpDate(a.contract_effective_date, b.contract_effective_date)
      if (d !== 0) return d
      d = cmpDate(a.contract_start_date, b.contract_start_date)
      if (d !== 0) return d
      return dir * a.order_no.localeCompare(b.order_no)
    })
  }, [projects, sortAsc])

  // ── Filter + search ────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    // Step 1: status filter
    let result: Project[]
    if (phaseTypeFilter === 'all') {
      if (statusFilter === 'all') {
        result = sortedProjects
      } else if (statusFilter === 'normal') {
        result = grouped.normal
      } else if (statusFilter === 'warn') {
        result = GROUP_ORDER.filter(g => g.endsWith('_warn')).flatMap(g => grouped[g])
      } else if (statusFilter === 'overdue') {
        result = GROUP_ORDER.filter(g => g.endsWith('_overdue')).flatMap(g => grouped[g])
      } else if (statusFilter === 'completed') {
        result = grouped.completed
      } else if (statusFilter === 'rectify') {
        result = grouped.rectify
      } else {
        result = sortedProjects
      }
    } else {
      result = sortedProjects.filter(p => {
        const ph = p.phases.find(ph => ph.phase_name === phaseTypeFilter)
        if (!ph) return false
        if (statusFilter === 'all') return true
        if (statusFilter === 'rectify') return ph.is_rectify && !ph.actual_end_date
        const prog = ph.phase_progress
        if (statusFilter === 'normal') return prog === '进行中' || prog === '未开始'
        if (statusFilter === 'warn') return prog === '预警'
        if (statusFilter === 'overdue') return prog === '逾期'
        if (statusFilter === 'completed') return prog === '已完成'
        return true
      })
    }

    // Step 2: full-text search
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(p => {
        const haystack = [
          p.order_no,
          p.contract_number,
          p.end_customer,
          p.project_manager_name,
          p.salesman_name,
          customerMap[p.customer_id],
          ...p.equipment_list.flatMap(e => [e.category, e.spec]),
          ...p.assignments.map(a => a.person_name),
          ...p.phases.flatMap(ph => [ph.phase_name, ph.status, ph.responsible]),
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }
    return result
  }, [sortedProjects, grouped, statusFilter, phaseTypeFilter, searchText, customerMap])

  // ── Dynamic counts ─────────────────────────────────────────
  const statusCounts = useMemo((): Record<StatusFilter, number> => {
    if (phaseTypeFilter === 'all') {
      return {
        all: projects.length,
        normal: grouped.normal.length,
        warn: GROUP_ORDER.filter(g => g.endsWith('_warn')).reduce((s, g) => s + (grouped[g]?.length || 0), 0),
        overdue: GROUP_ORDER.filter(g => g.endsWith('_overdue')).reduce((s, g) => s + (grouped[g]?.length || 0), 0),
        completed: grouped.completed.length,
        rectify: grouped.rectify.length,
      }
    }
    const phases = projects.flatMap(p => p.phases.filter(ph => ph.phase_name === phaseTypeFilter))
    return {
      all: phases.length,
      normal: phases.filter(ph => ph.phase_progress === '进行中' || ph.phase_progress === '未开始').length,
      warn: phases.filter(ph => ph.phase_progress === '预警').length,
      overdue: phases.filter(ph => ph.phase_progress === '逾期').length,
      completed: phases.filter(ph => ph.phase_progress === '已完成').length,
      rectify: phases.filter(ph => ph.is_rectify && !ph.actual_end_date).length,
    }
  }, [projects, grouped, phaseTypeFilter])

  return {
    // data
    sortedProjects, filteredProjects, statusCounts,
    // state
    statusFilter, phaseTypeFilter, searchText, sortAsc,
    // actions
    setStatusFilter, setPhaseTypeFilter, setSearchText, setSortAsc,
  }
}
