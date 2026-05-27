import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  Popconfirm,
  Upload,
  Row,
  Col,
} from 'antd'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import {
  TeamOutlined,
  FileTextOutlined,
  DeleteOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import { AssignmentPicker } from '../components/AssignmentPicker'
import {
  addIncident,
  addPhase,
  deletePhase,
  deleteProject,
  getAgreementUrl,
  listRoles,
  updateProject,
  uploadAgreement,
} from '../api'
import { fmtDate, phaseStatusTagProps } from '../utils/format'
import { INCIDENT_COLORS } from '../constants'
import { COLOR, FONT, SPACE, RADIUS } from '../design-tokens'
import { getRoleName } from '../utils/roles'
import { useAuth } from '../contexts/AuthContext'
import { PhaseProgress } from '../components/PhaseProgress'
import { PhaseStatusSelect } from '../components/PhaseStatusSelect'
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
  const [editModal, setEditModal] = useState(false)
  const [editForm] = Form.useForm()

  useEffect(() => {
    listRoles().then(setRoles).catch(() => {})
  }, [])

  async function onUpdatePayment(v: number | null) {
    if (v == null) return
    await updateProject(project.id, { contract_payment_progress: v })
    revalidator.revalidate()
  }

  async function onAddIncident(values: { occurred_at: dayjs.Dayjs; category: string; description: string }) {
    if (!incidentModal) return
    await addIncident(incidentModal, {
      occurred_at: values.occurred_at.format('YYYY-MM-DD'),
      category: values.category,
      description: values.description,
    })
    setIncidentModal(null)
    incidentForm.resetFields()
    revalidator.revalidate()
  }

  async function onAddPhase(values: { phase_name: string; sub_name: string; seq: number; responsible: string; is_rectify?: boolean }) {
    if (!projectId) return
    await addPhase(projectId, values)
    setPhaseModal(false)
    phaseForm.resetFields()
    revalidator.revalidate()
    message.success(values.is_rectify ? '整改工序已添加' : '工序已添加')
  }

  async function onDeletePhase(phaseId: string) {
    if (!projectId) return
    await deletePhase(projectId, phaseId)
    revalidator.revalidate()
    message.success('工序已删除')
  }

  async function onDelete() {
    if (!projectId) return
    await deleteProject(projectId)
    window.location.href = '/'
  }

  async function onEditProject(values: {
    end_customer?: string
    contract_start_date?: dayjs.Dayjs | null
    contract_duration_days?: number | null
    contract_expected_delivery_date?: dayjs.Dayjs | null
  }) {
    if (!projectId) return
    await updateProject(projectId, {
      ...values,
      contract_start_date: values.contract_start_date?.format('YYYY-MM-DD') ?? null,
      contract_expected_delivery_date: values.contract_expected_delivery_date?.format('YYYY-MM-DD') ?? null,
    })
    setEditModal(false)
    revalidator.revalidate()
    message.success('项目信息已更新')
  }

  const auth = useAuth()
  const sortedPhases = [...project.phases].sort((a, b) => a.seq - b.seq)

  // Current user's phase assignments
  const myPhaseIds = new Set(
    project.assignments
      .filter((a) => a.person_name === auth.person?.name && a.phase_id != null)
      .map((a) => a.phase_id!)
  )
  const isProjectMember = project.assignments.some((a) => a.person_name === auth.person?.name)
  const isSupervisor = auth.hasPermission('phases:add')

  // split assignments: global (no phase) vs phase-bound
  const globalAssignments = project.assignments.filter((a) => a.phase_id == null)
  const phaseAssignments = project.assignments.filter((a) => a.phase_id != null)

  function groupByRole(as: typeof project.assignments) {
    const map = new Map<string, typeof project.assignments>()
    for (const a of as) {
      const key = a.role_code
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }

  const globalByRole = groupByRole(globalAssignments)
  const phaseByRole = groupByRole(phaseAssignments)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* ─── Unified Header Card ─────────────────────────── */}
      <Card
        style={{ borderRadius: RADIUS.md, overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Top bar */}
        <div style={{ background: `linear-gradient(135deg, ${COLOR.headerGradientStart} 0%, ${COLOR.headerGradientEnd} 100%)`, padding: `14px ${SPACE.xl}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={12}>
            <Typography.Title level={4} style={{ margin: 0, color: COLOR.headerText }}>
              {project.order_no}
            </Typography.Title>
            {project.end_customer && (
              <Tag color="geekblue" style={{ margin: 0 }}>{project.end_customer}</Tag>
            )}
            {/* Global role members in header */}
            {Array.from(globalByRole.entries()).map(([roleCode, as]) => (
              <Tooltip key={roleCode} title={getRoleName(roleCode)}>
                <span style={{ color: COLOR.headerTextDim, fontSize: FONT.label, whiteSpace: 'nowrap' }}>
                  {as.map((a) => a.person_name).join('/')}
                </span>
              </Tooltip>
            ))}
            {(() => {
              const ps = project.project_status || '正常'
              if (ps === '逾期') return <Tag color="error" icon={<WarningOutlined />}>逾期</Tag>
              if (ps === '已完成') return <Tag color="success">已完成</Tag>
              return null
            })()}
          </Space>
          <Space size={8}>
            <Button size="small" onClick={() => {
              editForm.setFieldsValue({
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
        <div style={{ padding: `${SPACE.lg}px ${SPACE.xl}px` }}>
          <Row gutter={32}>
            {/* Left — Project Info */}
            <Col xs={24} md={14}>
              <Row gutter={[12, 8]}>
                <Col span={24}>
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>设备列表</Typography.Text>
                  <div style={{ marginTop: SPACE.xs }}>
                    {project.equipment_list.length === 0 ? (
                      <Typography.Text type="secondary">-</Typography.Text>
                    ) : (
                      <Space wrap size={[8, 4]}>
                        {project.equipment_list.map((eq) => (
                          <span key={eq.id} style={{ whiteSpace: 'nowrap' }}>
                            <Tag color="blue" style={{ margin: 0 }}>{eq.category || '-'}</Tag>
                            <Typography.Text style={{ margin: `0 ${SPACE.xs}px` }}>{eq.spec || '-'}</Typography.Text>
                            <Tag style={{ margin: 0 }}>×{eq.quantity}</Tag>
                          </span>
                        ))}
                      </Space>
                    )}
                  </div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>立项</Typography.Text>
                  <div style={{ fontWeight: 500 }}>{fmtDate(project.contract_start_date)}</div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>合同天数</Typography.Text>
                  <div style={{ fontWeight: 500 }}>{project.contract_duration_days ?? '-'} 天</div>
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>预计交期</Typography.Text>
                  <div style={{ fontWeight: 600, color: project.contract_expected_delivery_date && new Date() > new Date(project.contract_expected_delivery_date) ? COLOR.errorText : undefined }}>
                    {fmtDate(project.contract_expected_delivery_date)}
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: `${SPACE.md}px 0` }} />

              {/* Quick controls row */}
              <Row gutter={[16, 8]} align="middle">
                <Col>
                  <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>收款进度</Typography.Text>
                    <InputNumber size="small" min={0} max={1} step={0.1} value={project.contract_payment_progress}
                      onChange={onUpdatePayment} style={{ width: 72 }} />
                  </Space>
                </Col>
                <Col flex="auto" />
                <Col>
                  <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>技术协议</Typography.Text>
                    {project.agreement_filename ? (
                      <>
                        <a href={getAgreementUrl(project.id)} target="_blank" rel="noreferrer" style={{ fontSize: FONT.value }}>
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
                          <Button size="small" type="link" style={{ padding: 0, fontSize: FONT.label }}>替换</Button>
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
              <div style={{ background: COLOR.bgLayout, borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.lg}px`, minHeight: '100%' }}>
                <Space style={{ marginBottom: SPACE.sm }}>
                  <TeamOutlined style={{ color: COLOR.primary }} />
                  <Typography.Text strong style={{ fontSize: FONT.value }}>项目团队</Typography.Text>
                </Space>
                {globalByRole.size === 0 && phaseByRole.size === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>暂无团队成员</Typography.Text>
                ) : (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    {Array.from(globalByRole.entries()).map(([roleCode, as]) => (
                      <AssignmentPicker
                        key={roleCode}
                        projectId={project.id}
                        roleCode={roleCode}
                        roleName={getRoleName(roleCode)}
                        phaseId={null}
                        assignments={as}
                        onChange={() => revalidator.revalidate()}
                      />
                    ))}
                    {globalByRole.size > 0 && phaseByRole.size > 0 && (
                      <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                    )}
                    {Array.from(phaseByRole.entries()).map(([roleCode, as]) => (
                      <AssignmentPicker
                        key={roleCode}
                        projectId={project.id}
                        roleCode={roleCode}
                        roleName={getRoleName(roleCode)}
                        phaseId={as[0]?.phase_id ?? null}
                        assignments={as}
                        onChange={() => revalidator.revalidate()}
                      />
                    ))}
                  </Space>
                )}
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      {/* ─── Phases Card ─────────────────────────────────── */}
      <Card size="small" title="工序" extra={
        <Space size={8}>
          <Popconfirm title="添加整改工序?" description="整改工序会向所有相关人员发出警示" onConfirm={() => {
            addPhase(projectId!, { phase_name: '整改', sub_name: '', seq: sortedPhases.length + 1, responsible: '', is_rectify: true })
              .then(() => { message.success('整改工序已添加'); revalidator.revalidate() })
              .catch((e) => message.error(e instanceof Error ? e.message : String(e)))
          }}>
            <Button size="small" icon={<ExclamationCircleOutlined />} type="primary" ghost>+ 整改</Button>
          </Popconfirm>
          <Button size="small" onClick={() => setPhaseModal(true)}>+ 工序</Button>
        </Space>
      }>
        {/* Progress overview bar */}
        {sortedPhases.length > 0 && (
          <div style={{ marginBottom: SPACE.lg }}>
            <PhaseProgress phases={sortedPhases} mode="full" />
          </div>
        )}

        {/* Rectify warning */}
        {sortedPhases.some((ph) => ph.is_rectify && !ph.actual_end_date) && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="该项目有未完成的整改工序，请相关人员及时更新进度"
            style={{ marginBottom: SPACE.lg }}
          />
        )}

        {sortedPhases.map((ph) => {
          const status = phaseStatusTagProps(ph).text
          const color = phaseStatusTagProps(ph).color
          const isActiveRectify = ph.is_rectify && !ph.actual_end_date
          return (
            <Card
              key={ph.id} size="small" type="inner" style={{
                marginBottom: SPACE.sm,
                borderColor: isActiveRectify ? COLOR.warning : undefined,
                borderWidth: isActiveRectify ? 2 : 1,
              }}
              title={(() => {
                const phaseAssign = project.assignments.find((a) => a.phase_id === ph.id)
                const resp = ph.responsible || phaseAssign?.person_name || ''
                return (
                  <Space>
                    {ph.is_rectify && <ExclamationCircleOutlined style={{ color: COLOR.warning }} />}
                    <Tooltip title={status}>
                      <Tag color={color}>
                        {ph.is_rectify ? `整改${ph.sub_name ? ` - ${ph.sub_name}` : ''}` : `${ph.phase_name}${ph.sub_name ? ` - ${ph.sub_name}` : ''}`}
                      </Tag>
                    </Tooltip>
                    {!ph.is_rectify && <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>{resp || '未指定'}</Typography.Text>}
                  </Space>
                )
              })()}
              extra={
                <Space size={4}>
                  {ph.is_rectify && (
                    <PhaseStatusSelect phase={ph} size="small" />
                  )}
                  <Popconfirm title="确认删除?" onConfirm={() => onDeletePhase(ph.id)}>
                    <Button danger size="small" type="text">×</Button>
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{
                display: 'flex', gap: SPACE.lg, flexWrap: 'wrap',
                padding: '6px 0', marginBottom: SPACE.sm,
                borderBottom: `1px solid ${COLOR.border}`,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs }}>
                  <CalendarOutlined style={{ color: COLOR.primary, fontSize: FONT.value }} />
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>开始</Typography.Text>
                  <Typography.Text strong style={{ fontSize: FONT.value }}>{fmtDate(ph.start_date)}</Typography.Text>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs }}>
                  <ClockCircleOutlined style={{ color: COLOR.warningOrange, fontSize: FONT.value }} />
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>预期完成</Typography.Text>
                  <Typography.Text strong style={{ fontSize: FONT.value }}>{fmtDate(ph.planned_end_date)}</Typography.Text>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs }}>
                  <CheckCircleOutlined style={{ color: ph.actual_end_date ? COLOR.success : COLOR.disabled, fontSize: FONT.value }} />
                  <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>实际完成</Typography.Text>
                  <Typography.Text strong style={{ fontSize: FONT.value }}>
                    {ph.actual_end_date ? fmtDate(ph.actual_end_date) : '—'}
                  </Typography.Text>
                </span>
              </div>
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
              {(isSupervisor || (ph.is_rectify && isProjectMember) || myPhaseIds.has(ph.id) || (ph.phase_name === '尾款' && auth.role === 'salesman')) && (
                <Button type="link" size="small" style={{ marginTop: SPACE.xs }}
                  onClick={() => { setIncidentModal(ph.id); incidentForm.resetFields() }}>+ 添加事件</Button>
              )}

            </Card>
          )
        })}
      </Card>

      {/* Incident Modal */}
      <Modal open={!!incidentModal} title="添加事故事件" onCancel={() => setIncidentModal(null)} onOk={() => incidentForm.submit()}>
        <Form form={incidentForm} layout="vertical" onFinish={onAddIncident}>
          <Form.Item name="occurred_at" label="日期" rules={[{ required: true }]}>
            <DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} />
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
            <Select options={['机械设计', '生产', '调机', '验收', '尾款', '整改'].map((s) => ({ label: s, value: s }))} />
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
          <Form.Item name="end_customer" label="终端客户">
            <Input />
          </Form.Item>
          <Form.Item name="contract_start_date" label="立项日期">
            <DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contract_duration_days" label="合同天数">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contract_expected_delivery_date" label="预计交期">
            <DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

    </Space>
  )
}
