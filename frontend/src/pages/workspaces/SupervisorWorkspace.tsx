import { useEffect, useMemo, useState } from 'react'
import {
  Button, Col, DatePicker, Drawer, Empty, Row, Select, Space, Tabs,
  Typography, Popconfirm,
} from 'antd'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ProjectCard } from '../../components/ProjectCard'
import { AssignmentPicker } from '../../components/AssignmentPicker'
import {
  addPhase, deletePhase, listAssignments, listPhasesGlobal,
  listProjects, listRoles, updatePhase,
} from '../../api'
import { groupByUrgency, GROUP_LABELS, GROUP_ORDER } from '../../utils/urgency'
import type { Project, ProjectAssignment, ProjectPhase, RoleDefinition } from '../../types'
import { anyPhaseOfSeq } from '../../utils/phases'

const MANAGED_SEQS = [1, 2]
const ADDABLE_PHASES = ['机械设计', '生产']

function missingAssignments(p: Project): string[] {
  const m: string[] = []
  const hasPm = p.assignments.some((a) => a.role_code === 'project_manager')
  if (anyPhaseOfSeq(p.phases, 1, (ph) => !ph.responsible && !p.assignments.some((a) => a.phase_id === ph.id)))
    m.push('need_design')
  if (anyPhaseOfSeq(p.phases, 2, (ph) => !ph.responsible && !p.assignments.some((a) => a.phase_id === ph.id)))
    m.push('need_production')
  if (!hasPm) m.push('need_pm')
  return m
}

export function SupervisorWorkspace() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [selected, setSelected] = useState<Project | null>(null)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try { const [p, r] = await Promise.all([listProjects(), listRoles()]); setProjects(p); setRoles(r) }
      catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!selected) return
    (async () => {
      const [as, ps] = await Promise.all([
        listAssignments(selected.id), listPhasesGlobal({ project_id: selected.id }),
      ])
      setAssignments(as); setPhases(ps.sort((a, b) => a.seq - b.seq))
    })()
  }, [selected])

  async function refresh() {
    if (!selected) return
    const [pList, as, ps] = await Promise.all([
      listProjects(), listAssignments(selected.id), listPhasesGlobal({ project_id: selected.id }),
    ])
    setProjects(pList); setAssignments(as); setPhases(ps.sort((a, b) => a.seq - b.seq))
  }

  async function onAddPhase() {
    if (!selected || !newPhaseName) return
    const seqMap: Record<string, number> = { '机械设计': 1, '生产': 2 }
    await addPhase(selected.id, {
      phase_name: newPhaseName, sub_name: '',
      seq: seqMap[newPhaseName] || 1, responsible: '',
    })
    setShowAddPhase(false); setNewPhaseName('')
    await refresh()
  }

  async function onDeletePhase(phaseId: string) {
    if (!selected) return
    await deletePhase(selected.id, phaseId)
    await refresh()
  }

  async function onEditPhase(ph: ProjectPhase, field: string, value: string | null) {
    await updatePhase(selected!.id, ph.id, { ...ph, [field]: value } as any)
    setPhases((prev) => prev.map((p) => p.id === ph.id ? { ...p, [field]: value } : p))
  }

  const grouped = useMemo(() => {
    const needs: Record<string, Project[]> = { need_design: [], need_production: [], need_pm: [] }
    const rest: Project[] = []
    for (const p of projects) {
      const m = missingAssignments(p)
      if (m.length) { for (const k of m) needs[k].push(p) }
      else rest.push(p)
    }
    const result: { key: string; label: string; items: Project[] }[] = []
    const L: Record<string, string> = { need_design: '缺机械设计', need_production: '缺生产执行人', need_pm: '缺项目经理' }
    for (const k of ['need_design', 'need_production', 'need_pm'])
      result.push({ key: k, label: L[k], items: needs[k] })
    const umap = groupByUrgency(rest)
    for (const g of GROUP_ORDER)
      if (umap[g].length) result.push({ key: g, label: GROUP_LABELS[g], items: umap[g] })
    return result
  }, [projects])

  const [activeTab, setActiveTab] = useState(grouped[0]?.key || 'normal')
  const MANAGED_ROLES: Record<number, string> = { 1: 'mechanical_designer', 2: 'production_executor' }

  return (
    <WorkspaceShell loading={loading} error={error}>
      {!projects.length ? <Empty description="暂无项目" /> : (
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="small"
          items={grouped.map((g) => ({
            key: g.key, label: `${g.label} (${g.items.length})`,
            children: (
              <Row gutter={[8, 8]}>
                {g.items.map((p) => (
                  <Col key={p.id} xs={24} sm={24} md={12} lg={8}>
                    <ProjectCard project={p} onClick={() => setSelected(p)} />
                  </Col>
                ))}
              </Row>
            ),
          }))}
        />
      )}

      <Drawer title={selected?.order_no} open={!!selected}
        onClose={() => { setSelected(null); setShowAddPhase(false) }} width={480}>
        {selected && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Button type="primary" size="small" onClick={() => navigate(`/projects/${selected.id}`)}>
              打开项目主页
            </Button>

            <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
              <Typography.Text strong>项目经理</Typography.Text>
              <AssignmentPicker projectId={selected.id} roleCode="project_manager"
                roleName="项目经理" phaseId={null}
                assignments={assignments.filter((a) => a.role_code === 'project_manager')}
                onChange={refresh} />
            </div>

            {phases.filter((ph) => MANAGED_SEQS.includes(ph.seq)).map((ph) => (
              <div key={ph.id} style={{ paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                <Space style={{ marginBottom: 6 }}>
                  <Typography.Text strong>{ph.phase_name}{ph.sub_name ? ` - ${ph.sub_name}` : ''}</Typography.Text>
                  <Popconfirm title="确认删除?" onConfirm={() => onDeletePhase(ph.id)}>
                    <Button size="small" type="link" danger>删除</Button>
                  </Popconfirm>
                </Space>
                <Space size={4} wrap style={{ marginBottom: 4 }}>
                  <DatePicker size="small" locale={zhCNDatePicker} placeholder="开始日期"
                    value={ph.start_date ? dayjs(ph.start_date) : null}
                    onChange={(d) => onEditPhase(ph, 'start_date', d?.format('YYYY-MM-DD') ?? null)} />
                  <DatePicker size="small" locale={zhCNDatePicker} placeholder="计划完成"
                    value={ph.planned_end_date ? dayjs(ph.planned_end_date) : null}
                    onChange={(d) => onEditPhase(ph, 'planned_end_date', d?.format('YYYY-MM-DD') ?? null)} />
                </Space>
                {MANAGED_ROLES[ph.seq] && (
                  <AssignmentPicker projectId={selected.id} roleCode={MANAGED_ROLES[ph.seq]}
                    roleName={roles.find((r) => r.code === MANAGED_ROLES[ph.seq])?.name || ''}
                    phaseId={ph.id}
                    assignments={assignments.filter((a) => a.role_code === MANAGED_ROLES[ph.seq] && a.phase_id === ph.id)}
                    onChange={refresh} />
                )}
              </div>
            ))}

            {showAddPhase ? (
              <Space>
                <Select size="small" style={{ width: 100 }} value={newPhaseName || undefined}
                  onChange={setNewPhaseName}
                  options={ADDABLE_PHASES.map((s) => ({ label: s, value: s }))} />
                <Button size="small" type="primary" onClick={onAddPhase}>确定</Button>
                <Button size="small" onClick={() => setShowAddPhase(false)}>取消</Button>
              </Space>
            ) : (
              <Button size="small" onClick={() => setShowAddPhase(true)}>+ 添加工序</Button>
            )}
          </Space>
        )}
      </Drawer>
    </WorkspaceShell>
  )
}
