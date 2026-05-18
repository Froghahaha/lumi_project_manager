import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Divider,
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
  Upload,
  Row,
  Col,
} from 'antd'
import {
  TeamOutlined,
  FileTextOutlined,
  DeleteOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import {
  addAssignment,
  addIncident,
  addPhase,
  deletePhase,
  deleteProject,
  getAgreementUrl,
  listRoles,
  removeAssignment,
  updateProject,
  uploadAgreement,
} from '../api'
import { fmtDate, phaseOverdue } from '../utils/format'
import { INCIDENT_COLORS } from '../constants'
import { getRoleName } from '../utils/roles'
import type { Project, ProjectPhase, RoleDefinition } from '../types'

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
  const [editModal, setEditModal] = useState(false)
  const [editForm] = Form.useForm()

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

  async function onEditProject(values: {
    equipment_category?: string
    equipment_spec?: string
    equipment_quantity?: number
    end_customer?: string
    contract_start_date?: string
    contract_duration_days?: number | null
    contract_expected_delivery_date?: string
  }) {
    if (!projectId) return
    await updateProject(projectId, values)
    setEditModal(false)
    revalidator.revalidate()
    message.success('项目信息已更新')
  }

  const sortedPhases = [...project.phases].sort((a, b) => a.seq - b.seq)

  // group assignments by role for team display
  const teamByRole = new Map<string, typeof project.assignments>()
  for (const a of project.assignments) {
    const key = a.role_code
    if (!teamByRole.has(key)) teamByRole.set(key, [])
    teamByRole.get(key)!.push(a)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* ─── Unified Header Card ─────────────────────────── */}
      <Card
        style={{ borderRadius: 8, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Top bar */}
        <div style={{ background: 'linear-gradient(135deg, #001529 0%, #003a70 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={12}>
            <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
              {project.order_no}
            </Typography.Title>
            {project.end_customer && (
              <Tag color="geekblue" style={{ margin: 0 }}>{project.end_customer}</Tag>
            )}
            {project.is_abnormal && (
              <Tag color="error" icon={<WarningOutlined />}>异常</Tag>
            )}
          </Space>
          <Space size={8}>
            <Button size="small" onClick={() => {
              editForm.setFieldsValue({
                equipment_category: project.equipment_category,
                equipment_spec: project.equipment_spec,
                equipment_quantity: project.equipment_quantity,
                end_customer: project.end_customer,
                contract_start_date: project.contract_start_date,
                contract_duration_days: project.contract_duration_days,
                contract_expected_delivery_date: project.contract_expected_delivery_date,
              })
              setEditModal(true)
            }}>编辑</Button>
            <Button size="small" icon={<TeamOutlined />} type="primary" ghost onClick={() => setAssignModal(true)}>
              添加成员
            </Button>
            <Popconfirm title="确认删除此项目?" onConfirm={onDelete}>
              <Button size="small" danger icon={<DeleteOutlined />} ghost>删除</Button>
            </Popconfirm>
          </Space>
        </div>

        {/* Body: two-column layout */}
        <div style={{ padding: '16px 20px' }}>
          <Row gutter={32}>
            {/* Left — Project Info */}
            <Col xs={24} md={14}>
              <Row gutter={[12, 8]}>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>设备</Typography.Text>
                  <div style={{ fontWeight: 500 }}>{project.equipment_spec || '-'}</div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>类型</Typography.Text>
                  <div><Tag style={{ margin: 0 }}>{project.equipment_category || '-'}</Tag></div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>数量</Typography.Text>
                  <div style={{ fontWeight: 500 }}>{project.equipment_quantity}</div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>立项</Typography.Text>
                  <div style={{ fontWeight: 500 }}>{fmtDate(project.contract_start_date)}</div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>合同天数</Typography.Text>
                  <div style={{ fontWeight: 500 }}>{project.contract_duration_days ?? '-'} 天</div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>预计交期</Typography.Text>
                  <div style={{ fontWeight: 600, color: project.contract_expected_delivery_date && new Date() > new Date(project.contract_expected_delivery_date) ? '#cf1322' : undefined }}>
                    {fmtDate(project.contract_expected_delivery_date)}
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />

              {/* Quick controls row */}
              <Row gutter={[16, 8]} align="middle">
                <Col>
                  <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>异常标记</Typography.Text>
                    <Select value={project.is_abnormal} onChange={onToggleAbnormal} size="small" style={{ width: 76 }}
                      options={[{ label: '正常', value: false }, { label: '异常', value: true }]} />
                  </Space>
                </Col>
                <Col>
                  <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>收款进度</Typography.Text>
                    <InputNumber size="small" min={0} max={1} step={0.1} value={project.contract_payment_progress}
                      onChange={onUpdatePayment} style={{ width: 72 }} />
                  </Space>
                </Col>
                <Col flex="auto" />
                <Col>
                  <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>技术协议</Typography.Text>
                    {project.agreement_filename ? (
                      <>
                        <a href={getAgreementUrl(project.id)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          <FileTextOutlined /> {project.agreement_filename}
                        </a>
                        <Upload
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          showUploadList={false}
                          beforeUpload={(file) => {
                            uploadAgreement(project.id, file)
                              .then(() => { message.success('上传成功'); revalidator.revalidate() })
                              .catch((e) => message.error(e instanceof Error ? e.message : String(e)))
                            return false
                          }}
                        >
                          <Button size="small" type="link" style={{ padding: 0, fontSize: 12 }}>替换</Button>
                        </Upload>
                      </>
                    ) : (
                      <Upload
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        showUploadList={false}
                        beforeUpload={(file) => {
                          uploadAgreement(project.id, file)
                            .then(() => { message.success('上传成功'); revalidator.revalidate() })
                            .catch((e) => message.error(e instanceof Error ? e.message : String(e)))
                          return false
                        }}
                      >
                        <Button size="small" icon={<FileTextOutlined />}>上传协议</Button>
                      </Upload>
                    )}
                  </Space>
                </Col>
              </Row>
            </Col>

            {/* Right — Team */}
            <Col xs={24} md={10}>
              <div style={{ background: '#fafafa', borderRadius: 6, padding: '12px 16px', minHeight: '100%' }}>
                <Space style={{ marginBottom: 8 }}>
                  <TeamOutlined style={{ color: '#1677ff' }} />
                  <Typography.Text strong style={{ fontSize: 13 }}>项目团队</Typography.Text>
                </Space>
                {teamByRole.size === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>暂无团队成员</Typography.Text>
                ) : (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    {Array.from(teamByRole.entries()).map(([roleCode, as]) => (
                      <div key={roleCode} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <Typography.Text style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', minWidth: 70, marginTop: 2 }}>
                          {getRoleName(roleCode)}:
                        </Typography.Text>
                        <Space wrap size={[4, 2]}>
                          {as.map((a) => (
                            <Tag key={a.id} closable onClose={() => onRemoveAssign(a.id)} style={{ fontSize: 11, margin: 0 }}>
                              {a.person_name}
                              {a.phase_id != null && (() => {
                                const ph = project.phases.find((p) => p.id === a.phase_id)
                                return ph ? ` · ${ph.sub_name || ph.phase_name}` : ''
                              })()}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    ))}
                  </Space>
                )}
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      {/* ─── Phases Card ─────────────────────────────────── */}
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
              <Table<Project['phases'][0]['incidents'][0]>
                rowKey="id" dataSource={ph.incidents} size="small" pagination={false}
                locale={{ emptyText: '无事故事件' }}
                columns={[
                  { title: '日期', dataIndex: 'occurred_at', width: 100, render: (v: string) => (v ? v.slice(0, 10) : '-') },
                  { title: '类别', dataIndex: 'category', width: 80, render: (v: string) => {
                    return v ? <Tag color={INCIDENT_COLORS[v] || 'default'}>{v}</Tag> : null
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

      {/* Edit Project Modal */}
      <Modal open={editModal} title="编辑项目信息" onCancel={() => setEditModal(false)} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={onEditProject}>
          <Form.Item name="equipment_category" label="类型">
            <Input />
          </Form.Item>
          <Form.Item name="equipment_spec" label="设备">
            <Input />
          </Form.Item>
          <Form.Item name="equipment_quantity" label="数量">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_customer" label="终端客户">
            <Input />
          </Form.Item>
          <Form.Item name="contract_start_date" label="立项日期">
            <Input placeholder="2026-05-01" />
          </Form.Item>
          <Form.Item name="contract_duration_days" label="合同天数">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contract_expected_delivery_date" label="预计交期">
            <Input placeholder="2026-05-01" />
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
