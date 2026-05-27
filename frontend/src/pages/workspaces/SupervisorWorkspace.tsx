import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Typography,
  message,
} from 'antd'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { ProjectTable } from '../../components/ProjectTable'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { AssignmentPicker } from '../../components/AssignmentPicker'
import { useAuth } from '../../contexts/AuthContext'
import {
  addPhase,
  deletePhase,
  listAssignments,
  listPhasesGlobal,
  listProjects,
  listRoles,
  updatePhase,
} from '../../api'
import type { Person, Project, ProjectAssignment, ProjectPhase, RoleDefinition } from '../../types'

const ROLE_SEQ: Record<string, number> = { mechanical_designer: 1, production_executor: 2, tuning_executor: 3 }

export function SupervisorWorkspace() {
  const auth = useAuth()
  const showPayment = auth.hasPermission('view_payment_column')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseSub, setNewPhaseSub] = useState('')
  const [editPhaseId, setEditPhaseId] = useState<string | null>(null)

  const selected = projects.find((p) => p.id === selectedId) ?? null

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [p, r] = await Promise.all([listProjects(), listRoles()])
        setProjects(p); setRoles(r)
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedId) { setAssignments([]); setPhases([]); return }
    async function load() {
      const [as, ps] = await Promise.all([
        listAssignments(selectedId),
        listPhasesGlobal({ project_id: selectedId }),
      ])
      setAssignments(as)
      setPhases(ps.sort((a, b) => a.seq - b.seq))
    }
    load()
  }, [selectedId])

  const assignableRoles = (() => {
    const r = roles.find((r) => r.code === auth.role)
    if (!r || !r.assigns_json) return roles.filter((r) => r.category === 'executor')
    try {
      const codes: string[] = JSON.parse(r.assigns_json)
      return roles.filter((r) => codes.includes(r.code))
    } catch { return [] }
  })()

  const phaseRoles = assignableRoles.filter((r) => ROLE_SEQ[r.code] != null)
  const globalRoles = assignableRoles.filter((r) => ROLE_SEQ[r.code] == null)

  async function refreshPhases() {
    if (!selectedId) return
    const ps = await listPhasesGlobal({ project_id: selectedId })
    setPhases(ps.sort((a, b) => a.seq - b.seq))
  }

  async function onAddPhase() {
    if (!selectedId || !newPhaseName.trim()) return
    const seqMap: Record<string, number> = { '机械设计': 1, '生产': 2, '调机': 3, '验收': 4, '尾款': 5 }
    try {
      await addPhase(selectedId, { phase_name: newPhaseName.trim(), sub_name: newPhaseSub.trim(), seq: seqMap[newPhaseName.trim()] || 1, responsible: '' })
      message.success('工序已添加')
      setNewPhaseName(''); setNewPhaseSub(''); setShowAddPhase(false)
      await refreshPhases()
    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
  }

  async function onDeletePhase(phaseId: string) {
    if (!selectedId) return
    try {
      await deletePhase(selectedId, phaseId)
      await refreshPhases()
      setAssignments(await listAssignments(selectedId))
    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
  }

  async function onEditPhase(ph: ProjectPhase, field: string, value: string) {
    try {
      await updatePhase(selectedId!, ph.id, {
        seq: ph.seq, phase_name: ph.phase_name,
        sub_name: field === 'sub_name' ? value : (ph.sub_name || ''),
        responsible: field === 'responsible' ? value : (ph.responsible || ''),
        status: ph.status,
        start_date: field === 'start_date' ? value || null : ph.start_date || null,
        planned_end_date: field === 'planned_end_date' ? value || null : ph.planned_end_date || null,
      })
      await refreshPhases()
    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <WorkspaceShell loading={loading} error={error}>
      <ProjectFilterBar projects={projects}>
        {(filtered) => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card size="small" title="项目列表">
            <ProjectTable
              projects={filtered}
              columns={['order_no', 'equipment', 'payment']}
              showPayment={showPayment}
              pagination={{ pageSize: 10 }}
              scroll={{ y: 400 }}
              onRow={(r) => ({ onClick: () => setSelectedId(r.id), style: { cursor: 'pointer', background: r.id === selectedId ? 'rgba(22,119,255,0.08)' : undefined } })}
            />
        </Card>

        {!selected ? (
          <Card size="small"><Empty description="从左侧选择一个项目" /></Card>
        ) : (
          <Card size="small" title={`${selected.order_no}`}
            extra={
              <Space>
                {selected.contract_effective_date && selected.contract_expected_delivery_date && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {selected.contract_effective_date.slice(5)} ~ {selected.contract_expected_delivery_date.slice(5)}
                  </Typography.Text>
                )}
                <Button size="small" type="primary" onClick={() => setShowAddPhase(!showAddPhase)}>+ 工序</Button>
              </Space>
            }
          >
            {showAddPhase && (
              <div style={{ marginBottom: 12, padding: 8, background: '#fafafa', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Select size="small" style={{ width: 120 }} placeholder="阶段"
                  value={newPhaseName || undefined} onChange={(v) => setNewPhaseName(v)}
                  options={['机械设计', '生产', '调机', '验收', '尾款'].map((s) => ({ label: s, value: s }))} />
                <Input size="small" style={{ width: 140 }} placeholder="子项名称 (可选)" value={newPhaseSub} onChange={(e) => setNewPhaseSub(e.target.value)} />
                <Button size="small" type="primary" onClick={onAddPhase}>确定</Button>
                <Button size="small" onClick={() => setShowAddPhase(false)}>取消</Button>
              </div>
            )}

            {phases.length === 0 ? (
              <Empty description="该项目暂无工序，请添加" />
            ) : (
              <>
                {phases.map((ph) => {
                  const myRoles = phaseRoles.filter((r) => ROLE_SEQ[r.code] === ph.seq)
                  return (
                    <div key={ph.id} style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <Typography.Text strong style={{ fontSize: 13 }}>
                          {ph.phase_name}{ph.sub_name ? ` - ${ph.sub_name}` : ''}
                        </Typography.Text>
                        {editPhaseId === ph.id ? (
                          <>
                            <Input size="small" style={{ width: 100 }} placeholder="子项名" defaultValue={ph.sub_name}
                              onPressEnter={(e) => { onEditPhase(ph, 'sub_name', (e.target as HTMLInputElement).value); setEditPhaseId(null) }}
                              onBlur={() => setEditPhaseId(null)} autoFocus />
                          </>
                        ) : (
                          <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }} onClick={() => setEditPhaseId(ph.id)}>编辑</Button>
                        )}
                        <Button size="small" danger type="text" style={{ fontSize: 11, padding: 0, marginLeft: 'auto' }}
                          onClick={() => onDeletePhase(ph.id)}>删除</Button>
                      </div>

                      {/* 工序日期 */}
                      <div style={{ marginTop: 4, marginBottom: 6, display: 'flex', gap: 12, fontSize: 12, paddingLeft: 8 }}>
                        <span>
                          <Typography.Text type="secondary">开始: </Typography.Text>
                          <DatePicker size="small" style={{ width: 140 }}
                            defaultValue={ph.start_date ? dayjs(ph.start_date.slice(0, 10)) : null}
                            onChange={(date) => { if (date) onEditPhase(ph, 'start_date', date.format('YYYY-MM-DD')) }}
                            locale={zhCNDatePicker} format="YYYY-MM-DD" />
                        </span>
                        <span>
                          <Typography.Text type="secondary">完成: </Typography.Text>
                          <DatePicker size="small" style={{ width: 140 }}
                            defaultValue={ph.planned_end_date ? dayjs(ph.planned_end_date.slice(0, 10)) : null}
                            onChange={(date) => { if (date) onEditPhase(ph, 'planned_end_date', date.format('YYYY-MM-DD')) }}
                            locale={zhCNDatePicker} format="YYYY-MM-DD" />
                        </span>
                        {ph.warning_date && (
                          <span>
                            <Typography.Text type="secondary">预警: </Typography.Text>
                            <Typography.Text>{ph.warning_date.slice(5)}</Typography.Text>
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 4 }}>
                        {myRoles.map((r) => (
                          <AssignmentPicker
                            key={r.code}
                            projectId={selectedId!}
                            roleCode={r.code}
                            roleName={r.name}
                            phaseId={ph.id}
                            assignments={assignments.filter((a) => a.phase_id === ph.id && a.role_code === r.code)}
                            onChange={() => listAssignments(selectedId!).then(setAssignments)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {globalRoles.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid #e8e8e8' }}>
                    <Typography.Text strong style={{ fontSize: 13, color: '#888' }}>项目全局角色</Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      {globalRoles.map((r) => (
                        <AssignmentPicker
                          key={r.code}
                          projectId={selectedId!}
                          roleCode={r.code}
                          roleName={r.name}
                          phaseId={null}
                          assignments={assignments.filter((a) => a.role_code === r.code && a.phase_id == null)}
                          onChange={() => listAssignments(selectedId!).then(setAssignments)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>
        )}
      </ProjectFilterBar>
    </WorkspaceShell>
  )
}
