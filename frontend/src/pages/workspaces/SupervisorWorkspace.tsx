import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import {
  addAssignment,
  addPhase,
  deletePhase,
  listAssignments,
  listPersons,
  listPhasesGlobal,
  listProjects,
  listRoles,
  removeAssignment,
  updatePhase,
} from '../../api'
import type { Person, Project, ProjectAssignment, ProjectPhase, RoleDefinition } from '../../types'

export function SupervisorWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [activeAddRole, setActiveAddRole] = useState<string | null>(null)
  const [rolePersons, setRolePersons] = useState<Person[]>([])
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

  // 角色→工序seq的映射
  const ROLE_PHASE_SEQ: Record<string, number | null> = {
    mechanical_designer: 1, production_executor: 2, tuning_executor: 3,
    after_sales_super: null,  // 验收/售后是全局角色
    project_manager: null, software_designer: null, sales_assistant: null,
  }
  // 分两组：工序绑定角色 / 项目全局角色
  const phaseRoles = assignableRoles.filter((r) => ROLE_PHASE_SEQ[r.code] != null)
  const globalRoles = assignableRoles.filter((r) => ROLE_PHASE_SEQ[r.code] == null)

  async function onRemoveAssign(id: string) {
    if (!selectedId) return
    try {
      await removeAssignment(selectedId, id)
      setAssignments((prev) => prev.filter((a) => a.id !== id))
    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
  }

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
        seq: ph.seq, phase_name: ph.phase_name, sub_name: field === 'sub_name' ? value : (ph.sub_name || ''),
        responsible: field === 'responsible' ? value : (ph.responsible || ''),
        status: ph.status,
      })
      await refreshPhases()
    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>工作台 - {auth.roleName}</Typography.Title>
        <Tag color="blue">{auth.person?.name || ''}</Tag>
      </Space>
      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card size="small" title="项目列表">
          {loading ? (<div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>) : (
            <Table<Project>
              rowKey="id" dataSource={projects} size="small" pagination={{ pageSize: 10 }} scroll={{ y: 400 }}
              onRow={(r) => ({ onClick: () => setSelectedId(r.id), style: { cursor: 'pointer', background: r.id === selectedId ? 'rgba(22,119,255,0.08)' : undefined } })}
              columns={[
                { title: '项目', dataIndex: 'order_no' },
                { title: '设备', render: (_, p) => <Tag>{p.equipment_category || '-'}</Tag> },
              ]}
            />
          )}
        </Card>

        {!selected ? (
          <Card size="small"><Empty description="从左侧选择一个项目" /></Card>
        ) : (
          <Card size="small" title={`${selected.order_no}`}
            extra={<Button size="small" type="primary" onClick={() => setShowAddPhase(!showAddPhase)}>+ 工序</Button>}
          >
            {/* Add Phase inline form */}
            {showAddPhase && (
              <div style={{ marginBottom: 12, padding: 8, background: '#fafafa', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Select size="small" style={{ width: 120 }} placeholder="阶段"
                  value={newPhaseName || undefined} onChange={(v) => { setNewPhaseName(v); const seqMap: Record<string, number> = { '机械设计': 1, '生产': 2, '调机': 3, '验收': 4, '尾款': 5 }; }}
                  options={['机械设计', '生产', '调机', '验收', '尾款'].map((s) => ({ label: s, value: s }))} />
                <Input size="small" style={{ width: 140 }} placeholder="子项名称 (可选)" value={newPhaseSub} onChange={(e) => setNewPhaseSub(e.target.value)} />
                <Button size="small" type="primary" onClick={onAddPhase}>确定</Button>
                <Button size="small" onClick={() => setShowAddPhase(false)}>取消</Button>
              </div>
            )}
            {/* 按工序分组显示 */}
            {phases.length === 0 ? (
              <Empty description="该项目暂无工序，请添加" />
            ) : (
              <>
                {phases.map((ph) => {
                  const myRoles = phaseRoles.filter((r) => ROLE_PHASE_SEQ[r.code] === ph.seq)
                  return (
                    <div key={ph.id} style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                      <div style={{ marginTop: 4 }}>
                        {myRoles.map((r) => {
                          const assigned = assignments.filter((a) => a.phase_id === ph.id && a.role_code === r.code)
                          return (
                            <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, fontSize: 12, paddingLeft: 8 }}>
                              <Typography.Text style={{ width: 80, color: '#666' }}>{r.name}</Typography.Text>
                              {assigned.map((a) => (
                                <Tag key={a.id} closable onClose={() => onRemoveAssign(a.id)} color="blue" style={{ fontSize: 11 }}>{a.person_name}</Tag>
                              ))}
                              {activeAddRole === r.code ? (
                                <Select size="small" autoFocus style={{ width: 110 }} placeholder="选人"
                                  showSearch
                                  filterOption={(input, option) => (option?.label as string || '').includes(input)}
                                  options={rolePersons.map((p) => ({ label: p.name, value: p.name }))}
                                  onChange={async (name) => {
                                    if (name && selectedId) {
                                      try {
                                        await addAssignment(selectedId, { person_name: name, role_code: r.code, phase_id: ph.id })
                                        setAssignments(await listAssignments(selectedId))
                                      } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
                                    }
                                    setActiveAddRole(null)
                                  }}
                                  onBlur={() => setActiveAddRole(null)}
                                />
                              ) : (
                                <Button size="small" type="dashed" style={{ padding: '0 4px', fontSize: 11, height: 22 }}
                                  onClick={async () => {
                                    setActiveAddRole(r.code)
                                    try { setRolePersons(await listPersons(r.code)) } catch { setRolePersons([]) }
                                  }}>+</Button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {/* 项目全局角色 */}
                {globalRoles.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid #e8e8e8' }}>
                    <Typography.Text strong style={{ fontSize: 13, color: '#888' }}>项目全局角色</Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      {globalRoles.map((r) => {
                        const assigned = assignments.filter((a) => a.role_code === r.code && a.phase_id == null)
                        return (
                          <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, fontSize: 12, paddingLeft: 8 }}>
                            <Typography.Text style={{ width: 80, color: '#666' }}>{r.name}</Typography.Text>
                            {assigned.map((a) => (
                              <Tag key={a.id} closable onClose={() => onRemoveAssign(a.id)} color="blue" style={{ fontSize: 11 }}>{a.person_name}</Tag>
                            ))}
                            {activeAddRole === r.code ? (
                              <Select size="small" autoFocus style={{ width: 110 }} placeholder="选人"
                                showSearch
                                filterOption={(input, option) => (option?.label as string || '').includes(input)}
                                options={rolePersons.map((p) => ({ label: p.name, value: p.name }))}
                                onChange={async (name) => {
                                  if (name && selectedId) {
                                    try {
                                      await addAssignment(selectedId, { person_name: name, role_code: r.code, phase_id: null })
                                      setAssignments(await listAssignments(selectedId))
                                    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
                                  }
                                  setActiveAddRole(null)
                                }}
                                onBlur={() => setActiveAddRole(null)}
                              />
                            ) : (
                              <Button size="small" type="dashed" style={{ padding: '0 4px', fontSize: 11, height: 22 }}
                                onClick={async () => {
                                  setActiveAddRole(r.code)
                                  try { setRolePersons(await listPersons(r.code)) } catch { setRolePersons([]) }
                                }}>+</Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </Space>
  )
}
