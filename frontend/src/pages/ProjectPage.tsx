import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd'
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import {
  addAssignment,
  addIncident,
  addPhase,
  deletePhase,
  deleteProject,
  listRoles,
  removeAssignment,
  updateProject,
} from '../api'
import type { Project, ProjectPhase, RoleDefinition } from '../types'

function phaseOverdue(ph: ProjectPhase): boolean {
  if (!ph.planned_end_date) return false
  const end = ph.actual_end_date ? new Date(ph.actual_end_date) : new Date()
  return end > new Date(ph.planned_end_date)
}

function fmtDate(d: string | null): string {
  if (!d) return '-'
  return d.slice(0, 10)
}

function defaultStatuses(phaseName: string): string[] {
  switch (phaseName) {
    case '机械设计': return ['未开始', '设计中', '图纸已下发']
    case '生产': return ['未开始', '生产中', '生产完成', '已发货']
    case '调机': return ['未开始', '安调中', '安调完成']
    case '验收': return ['未开始', '已验收']
    case '尾款': return []
    default: return ['未开始', '进行中', '已完成']
  }
}

export function ProjectPage() {
  const { project } = useLoaderData() as { project: Project }
  const { projectId } = useParams<{ projectId: string }>()
  const revalidator = useRevalidator()

  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [incidentModal, setIncidentModal] = useState<string | null>(null)
  const [incidentForm] = Form.useForm()
  const [phaseModal, setPhaseModal] = useState(false)
  const [phaseForm] = Form.useForm()
  const [assignModal, setAssignModal] = useState(false)
  const [assignForm] = Form.useForm()

  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r.name]))

  useEffect(() => {
    listRoles().then(setRoles).catch(() => {})
  }, [])

  async function onToggleAbnormal(v: boolean) {
    await updateProject(project.id, { is_abnormal: v })
    revalidator.revalidate()
  }

  async function onUpdatePayment(v: number | null) {
    if (v == null) return
    await updateProject(project.id, { contract_payment_progress: v })
    revalidator.revalidate()
  }

  async function onAddIncident(values: { occurred_at: string; category: string; description: string }) {
    if (!incidentModal) return
    await addIncident(incidentModal, values)
    setIncidentModal(null)
    incidentForm.resetFields()
    revalidator.revalidate()
  }

  async function onAddPhase(values: { phase_name: string; sub_name: string; seq: number; responsible: string }) {
    if (!projectId) return
    await addPhase(projectId, values)
    setPhaseModal(false)
    phaseForm.resetFields()
    revalidator.revalidate()
    message.success('工序已添加')
  }

  async function onDeletePhase(phaseId: string) {
    if (!projectId) return
    await deletePhase(projectId, phaseId)
    revalidator.revalidate()
    message.success('工序已删除')
  }

  async function onAddAssign(values: { person_name: string; role_code: string }) {
    if (!projectId) return
    await addAssignment(projectId, values)
    setAssignModal(false)
    assignForm.resetFields()
    revalidator.revalidate()
  }

  async function onRemoveAssign(assignmentId: string) {
    if (!projectId) return
    await removeAssignment(projectId, assignmentId)
    revalidator.revalidate()
  }

  async function onDelete() {
    if (!projectId) return
    await deleteProject(projectId)
    window.location.href = '/'
  }

  const sortedPhases = [...project.phases].sort((a, b) => a.seq - b.seq)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {project.order_no}
          {project.end_customer && (
            <Typography.Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
              终端: {project.end_customer}
            </Typography.Text>
          )}
        </Typography.Title>
        <Popconfirm title="确认删除?" onConfirm={onDelete}>
          <Button danger size="small">删除</Button>
        </Popconfirm>
      </Space>

      <Card size="small">
        <Descriptions column={6} size="small">
          <Descriptions.Item label="设备">{project.equipment_spec || '-'}</Descriptions.Item>
          <Descriptions.Item label="类型"><Tag>{project.equipment_category || '-'}</Tag></Descriptions.Item>
          <Descriptions.Item label="数量">{project.equipment_quantity}</Descriptions.Item>
          <Descriptions.Item label="异常标记">
            <Select value={project.is_abnormal} onChange={onToggleAbnormal} size="small" style={{ width: 80 }}
              options={[{ label: '正常', value: false }, { label: '异常', value: true }]} />
          </Descriptions.Item>
          <Descriptions.Item label="收款进度">
            <InputNumber size="small" min={0} max={1} step={0.1} value={project.contract_payment_progress}
              onChange={onUpdatePayment} style={{ width: 80 }} />
          </Descriptions.Item>
          <Descriptions.Item label="立项">{fmtDate(project.contract_start_date)}</Descriptions.Item>
          <Descriptions.Item label="合同天数">{project.contract_duration_days ?? '-'}天</Descriptions.Item>
          <Descriptions.Item label="预计交期">{fmtDate(project.contract_expected_delivery_date)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="工序" extra={<Button size="small" onClick={() => setPhaseModal(true)}>+ 工序</Button>}>
        {sortedPhases.map((ph) => {
          const overdue = phaseOverdue(ph)
          return (
            <Card
              key={ph.id} size="small" type="inner" style={{ marginBottom: 8 }}
              title={(() => {
                const phaseAssign = project.assignments.find((a) => a.phase_id === ph.id)
                const resp = ph.responsible || phaseAssign?.person_name || ''
                return (
                  <Space>
                    <Tag color={overdue ? 'red' : ph.actual_end_date ? 'green' : 'blue'}>
                      {ph.phase_name}{ph.sub_name ? ` - ${ph.sub_name}` : ''}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{resp || '未指定'}</Typography.Text>
                  </Space>
                )
              })()}
              extra={
                <Space size={4}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {fmtDate(ph.start_date)} → {fmtDate(ph.planned_end_date)}
                    {ph.actual_end_date && ` → ${fmtDate(ph.actual_end_date)}`}
                    {ph.actual_duration != null && ` (${ph.actual_duration}天)`}
                  </Typography.Text>
                  <Popconfirm title="确认删除?" onConfirm={() => onDeletePhase(ph.id)}>
                    <Button danger size="small" type="text">×</Button>
                  </Popconfirm>
                </Space>
              }
            >
              {/* Incidents table */}
              <Table<Project['phases'][0]['incidents'][0]>
                rowKey="id" dataSource={ph.incidents} size="small" pagination={false}
                locale={{ emptyText: '无事故事件' }}
                columns={[
                  { title: '日期', dataIndex: 'occurred_at', width: 100, render: (v: string) => (v ? v.slice(0, 10) : '-') },
                  { title: '类别', dataIndex: 'category', width: 80, render: (v: string) => {
                    const colors: Record<string, string> = { 原因: 'red', 现状: 'blue', 应急: 'orange', 长效: 'green' }
                    return v ? <Tag color={colors[v] || 'default'}>{v}</Tag> : null
                  }},
                  { title: '描述', dataIndex: 'description' },
                ]}
              />
              <Button type="link" size="small" style={{ marginTop: 4 }}
                onClick={() => { setIncidentModal(ph.id); incidentForm.resetFields() }}>+ 添加事件</Button>

            </Card>
          )
        })}
      </Card>

      <Card size="small" title="团队" extra={<Button size="small" onClick={() => setAssignModal(true)}>+ 成员</Button>}>
        {project.assignments.length === 0 ? (
          <Typography.Text type="secondary">暂无团队成员</Typography.Text>
        ) : (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {(() => {
              const grouped = new Map<string, typeof project.assignments>()
              for (const a of project.assignments) {
                const key = a.role_code
                if (!grouped.has(key)) grouped.set(key, [])
                grouped.get(key)!.push(a)
              }
              return Array.from(grouped.entries()).map(([roleCode, as]) => (
                <div key={roleCode}>
                  <Typography.Text strong style={{ fontSize: 13 }}>{roleMap[roleCode] || roleCode}:</Typography.Text>
                  <Space wrap style={{ marginLeft: 8 }}>
                    {as.map((a) => (
                      <Tag key={a.id} closable onClose={() => onRemoveAssign(a.id)}>
                        {a.person_name}
                        {a.phase_id != null ? ` → ${(() => {
                          const ph = project.phases.find((p) => p.id === a.phase_id)
                          return ph ? (ph.sub_name || ph.phase_name) : ''
                        })()}` : ''}
                      </Tag>
                    ))}
                  </Space>
                </div>
              ))
            })()}
          </Space>
        )}
      </Card>

      {/* Incident Modal */}
      <Modal open={!!incidentModal} title="添加事故事件" onCancel={() => setIncidentModal(null)} onOk={() => incidentForm.submit()}>
        <Form form={incidentForm} layout="vertical" onFinish={onAddIncident}>
          <Form.Item name="occurred_at" label="日期" rules={[{ required: true }]}>
            <Input placeholder="2026-05-01" />
          </Form.Item>
          <Form.Item name="category" label="类别">
            <Select options={[
              { label: '现状', value: '现状' }, { label: '原因', value: '原因' },
              { label: '应急', value: '应急' }, { label: '长效', value: '长效' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Phase Modal */}
      <Modal open={phaseModal} title="添加工序" onCancel={() => setPhaseModal(false)} onOk={() => phaseForm.submit()}>
        <Form form={phaseForm} layout="vertical" onFinish={onAddPhase}
          onValuesChange={(changed) => {
            if (changed.phase_name) {
              const map: Record<string, number> = { '机械设计': 1, '生产': 2, '调机': 3, '验收': 4, '尾款': 5 }
              phaseForm.setFieldsValue({ seq: map[changed.phase_name] || 1 })
            }
          }}
        >
          <Form.Item name="phase_name" label="阶段" rules={[{ required: true }]}>
            <Select options={['机械设计', '生产', '调机', '验收', '尾款'].map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item name="sub_name" label="子项名称">
            <Input placeholder="如：料盘设计、机械手设计" />
          </Form.Item>
          <Form.Item name="seq" hidden><InputNumber /></Form.Item>
          <Form.Item name="responsible" label="责任人">
            <Input placeholder="王文哲" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assignment Modal */}
      <Modal open={assignModal} title="添加成员" onCancel={() => setAssignModal(false)} onOk={() => assignForm.submit()}>
        <Form form={assignForm} layout="vertical" onFinish={onAddAssign}>
          <Form.Item name="person_name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="王文哲" />
          </Form.Item>
          <Form.Item name="role_code" label="角色">
            <Select options={roles.map((r) => ({ label: r.name, value: r.code }))} />
          </Form.Item>
        </Form>
      </Modal>

    </Space>
  )
}
