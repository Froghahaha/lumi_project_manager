import { useState } from 'react'
import {
  Alert, Button, Card, DatePicker, Divider, Form, Input,
  InputNumber, Modal, Progress, Row, Col, Select, Space, Tag,
  Tooltip, Typography, message, Popconfirm, Upload,
} from 'antd'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import { TeamOutlined, FileTextOutlined, DeleteOutlined, WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import { AssignmentPicker } from '../components/AssignmentPicker'
import { PhaseCard } from '../components/PhaseCard'
import { PhaseProgress } from '../components/PhaseProgress'
import { useAuth } from '../contexts/AuthContext'
import { addIncident, addPhase, deletePhase, deleteProject, getAgreementUrl, updatePhase, updateProject, uploadAgreement, uploadIncidentImage } from '../api'
import { fmtDate } from '../utils/format'
import { COLOR, FONT, SPACE, RADIUS } from '../design-tokens'
import { getRoleName } from '../utils/roles'
import type { Project } from '../types'

export function ProjectPage() {
  const { project } = useLoaderData() as { project: Project }
  const { projectId } = useParams<{ projectId: string }>()
  const revalidator = useRevalidator()
  const auth = useAuth()

  const [incidentModal, setIncidentModal] = useState<string | null>(null)
  const [incidentForm] = Form.useForm()
  const [phaseModal, setPhaseModal] = useState(false)
  const [phaseForm] = Form.useForm()
  const [editModal, setEditModal] = useState(false)
  const [editForm] = Form.useForm()

  const sortedPhases = [...project.phases].sort((a, b) => a.seq - b.seq)
  const isSupervisor = auth.hasPermission('phases:add')

  function phaseControls(ph: typeof project.phases[0]) {
    const isMyPhase = project.assignments.some((a) => a.person_name === auth.person?.name && a.phase_id === ph.id)
    const isProjectMember = project.assignments.some((a) => a.person_name === auth.person?.name)
    const isAdmin = auth.role === 'admin'
    const isTechSuper = auth.role === 'tech_supervisor'
    const isAfterSales = auth.role === 'after_sales_super'
    const managed = (isTechSuper && [1, 2].includes(ph.seq)) || (isAfterSales && [3, 4].includes(ph.seq))
    const canEdit = isAdmin || managed
    const roleMap: Record<number, string> = { 1: 'mechanical_designer', 2: 'production_executor', 3: 'tuning_executor', 4: 'salesman' }
    return {
      canEditDates: canEdit, canAssign: canEdit, roleCodeForAssign: roleMap[ph.seq] || '',
      canUpdateStatus: isMyPhase || isAdmin || managed,
      canAddIncident: isSupervisor || (ph.is_rectify && isProjectMember) || isMyPhase || (ph.phase_name === '尾款' && auth.role === 'salesman'),
      canDelete: canEdit,
    }
  }

  async function onUpdatePayment(v: number | null) { if (v == null) return; await updateProject(project.id, { contract_payment_progress: v }); revalidator.revalidate() }
  const [incidentFiles, setIncidentFiles] = useState<File[]>([])

  async function onAddIncident(values: { category: string; description: string }) {
    if (!incidentModal) return
    try {
      const created = await addIncident(incidentModal, {
        occurred_at: new Date().toISOString().slice(0, 10),
        category: values.category || '现状描述',
        description: values.description,
      })
      // Upload images one by one to the newly created incident
      if (incidentFiles.length > 0) {
        for (const file of incidentFiles) {
          try {
            await uploadIncidentImage(created.id, file)
          } catch (e) { message.warning(`图片 ${file.name} 上传失败: ${e instanceof Error ? e.message : String(e)}`) }
        }
      }
      setIncidentModal(null); incidentForm.resetFields(); setIncidentFiles([])
      revalidator.revalidate()
    } catch (e) { message.error(e instanceof Error ? e.message : String(e)) }
  }
  async function onAddPhase(values: { phase_name: string; sub_name: string; responsible: string; is_rectify?: boolean }) {
    if (!projectId) return
    const m: Record<string, number> = { '机械设计': 1, '生产': 2, '调机': 3, '尾款': 4 }
    await addPhase(projectId, { ...values, seq: m[values.phase_name] || 1 })
    setPhaseModal(false); phaseForm.resetFields(); revalidator.revalidate()
  }
  async function onDeletePhase(phaseId: string) { if (!projectId) return; await deletePhase(projectId, phaseId); revalidator.revalidate() }
  async function onDelete() { if (!projectId) return; await deleteProject(projectId); window.location.href = '/' }
  async function onEditProject(values: Record<string, any>) {
    if (!projectId) return
    await updateProject(projectId, { ...values, contract_start_date: values.contract_start_date?.format('YYYY-MM-DD') ?? null, contract_expected_delivery_date: values.contract_expected_delivery_date?.format('YYYY-MM-DD') ?? null })
    setEditModal(false); revalidator.revalidate()
  }
  async function onEditPhase(phaseId: string, field: string, value: string | null) {
    const ph = project.phases.find((p) => p.id === phaseId)
    if (!ph) return; await updatePhase(projectId!, phaseId, { ...ph, [field]: value } as any); revalidator.revalidate()
  }

  const globalAssignments = project.assignments.filter((a) => a.phase_id == null)
  const phaseAssignments = project.assignments.filter((a) => a.phase_id != null)
  function groupByRole(as: typeof project.assignments) {
    const map = new Map<string, typeof project.assignments>()
    for (const a of as) { const k = a.role_code; if (!map.has(k)) map.set(k, []); map.get(k)!.push(a) }
    return map
  }
  const globalByRole = groupByRole(globalAssignments)
  const phaseByRole = groupByRole(phaseAssignments)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card style={{ borderRadius: RADIUS.md, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <div style={{ background: `linear-gradient(135deg, ${COLOR.headerGradientStart} 0%, ${COLOR.headerGradientEnd} 100%)`, padding: `14px ${SPACE.xl}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={12}>
            <Typography.Title level={4} style={{ margin: 0, color: COLOR.headerText }}>{project.order_no}</Typography.Title>
            {project.contract_number && <Tag color="gold" style={{ margin: 0 }}>合同: {project.contract_number}</Tag>}
            {project.end_customer && <Tag color="geekblue" style={{ margin: 0 }}>{project.end_customer}</Tag>}
            {[...globalByRole.entries()].map(([rc, as]) => (<Tooltip key={rc} title={getRoleName(rc)}><span style={{ color: COLOR.headerTextDim, fontSize: FONT.label }}>{as.map((a) => a.person_name).join('/')}</span></Tooltip>))}
            {project.project_status === '逾期' && <Tag color="error" icon={<WarningOutlined />}>逾期</Tag>}
            {project.project_status === '已完成' && <Tag color="success">已完成</Tag>}
          </Space>
          <Space size={8}>
            <Button size="small" onClick={() => { editForm.setFieldsValue({ end_customer: project.end_customer, contract_start_date: project.contract_start_date, contract_duration_days: project.contract_duration_days, contract_expected_delivery_date: project.contract_expected_delivery_date, payment_due_type: project.payment_due_type, payment_due_days: project.payment_due_days }); setEditModal(true) }}>编辑</Button>
            <Popconfirm title="确认删除此项目?" onConfirm={onDelete}><Button size="small" danger icon={<DeleteOutlined />} ghost>删除</Button></Popconfirm>
          </Space>
        </div>
        <div style={{ padding: `${SPACE.lg}px ${SPACE.xl}px` }}>
          <Row gutter={32}>
            <Col xs={24} md={14}>
              <Row gutter={[12, 8]}>
                <Col span={24}><Typography.Text type="secondary" style={{ fontSize: FONT.label }}>设备列表</Typography.Text><div style={{ marginTop: SPACE.xs }}>{project.equipment_list.length === 0 ? <Typography.Text type="secondary">-</Typography.Text> : <Space wrap size={[8, 4]}>{project.equipment_list.map((eq) => (<span key={eq.id} style={{ whiteSpace: 'nowrap' }}><Tag color="blue" style={{ margin: 0 }}>{eq.category || '-'}</Tag><Typography.Text style={{ margin: `0 ${SPACE.xs}px` }}>{eq.spec || '-'}</Typography.Text><Tag style={{ margin: 0 }}>×{eq.quantity}</Tag></span>))}</Space>}</div></Col>
                <Col span={8}><Typography.Text type="secondary" style={{ fontSize: FONT.label }}>立项</Typography.Text><div style={{ fontWeight: 500 }}>{fmtDate(project.contract_start_date)}</div></Col>
                <Col span={8}><Typography.Text type="secondary" style={{ fontSize: FONT.label }}>合同天数</Typography.Text><div style={{ fontWeight: 500 }}>{project.contract_duration_days ?? '-'} 天</div></Col>
                <Col span={8}><Typography.Text type="secondary" style={{ fontSize: FONT.label }}>预计交期</Typography.Text><div style={{ fontWeight: 600, color: project.contract_expected_delivery_date && new Date() > new Date(project.contract_expected_delivery_date) ? COLOR.errorText : undefined }}>{fmtDate(project.contract_expected_delivery_date)}</div></Col>
              </Row>
              <Divider style={{ margin: `${SPACE.md}px 0` }} />
              <Row gutter={[16, 8]} align="middle">
                <Col><Space size={4}><Typography.Text type="secondary" style={{ fontSize: FONT.label }}>收款进度</Typography.Text><InputNumber size="small" min={0} max={1} step={0.1} value={project.contract_payment_progress} onChange={onUpdatePayment} style={{ width: 72 }} /><Progress percent={Math.round((project.contract_payment_progress || 0) * 100)} size="small" style={{ width: 120, margin: 0 }} /></Space></Col>
                <Col flex="auto" />
                <Col><Space size={4}><Typography.Text type="secondary" style={{ fontSize: FONT.label }}>技术协议</Typography.Text>{project.agreement_filename ? (<><a href={getAgreementUrl(project.id)} target="_blank" rel="noreferrer" style={{ fontSize: FONT.value }}><FileTextOutlined /> {project.agreement_filename}</a><Upload accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" showUploadList={false} beforeUpload={(file) => { uploadAgreement(project.id, file).then(() => { message.success('上传成功'); revalidator.revalidate() }).catch((e) => message.error(e instanceof Error ? e.message : String(e))); return false }}><Button size="small" type="link" style={{ padding: 0, fontSize: FONT.label }}>替换</Button></Upload></>) : (<Upload accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" showUploadList={false} beforeUpload={(file) => { uploadAgreement(project.id, file).then(() => { message.success('上传成功'); revalidator.revalidate() }).catch((e) => message.error(e instanceof Error ? e.message : String(e))); return false }}><Button size="small" icon={<FileTextOutlined />}>上传协议</Button></Upload>)}</Space></Col>
              </Row>
            </Col>
            <Col xs={24} md={10}>
              <div style={{ background: COLOR.bgLayout, borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.lg}px`, minHeight: '100%' }}>
                <Space style={{ marginBottom: SPACE.sm }}><TeamOutlined style={{ color: COLOR.primary }} /><Typography.Text strong style={{ fontSize: FONT.value }}>项目团队</Typography.Text></Space>
                {globalByRole.size === 0 && phaseByRole.size === 0 ? <Typography.Text type="secondary" style={{ fontSize: FONT.label }}>暂无团队成员</Typography.Text> : (<Space direction="vertical" size={4} style={{ width: '100%' }}>{[...globalByRole.entries()].map(([rc, as]) => (<AssignmentPicker key={rc} projectId={project.id} roleCode={rc} roleName={getRoleName(rc)} phaseId={null} assignments={as} onChange={() => revalidator.revalidate()} />))}{globalByRole.size > 0 && phaseByRole.size > 0 && <Divider style={{ margin: `${SPACE.xs}px 0` }} />}{[...phaseByRole.entries()].map(([rc, as]) => (<AssignmentPicker key={rc} projectId={project.id} roleCode={rc} roleName={getRoleName(rc)} phaseId={as[0]?.phase_id ?? null} assignments={as} onChange={() => revalidator.revalidate()} />))}</Space>)}
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      <Card size="small" title="工序" extra={<Space size={8}><Popconfirm title="添加整改工序?" onConfirm={() => { addPhase(projectId!, { phase_name: '整改', sub_name: '', seq: sortedPhases.length + 1, responsible: '', is_rectify: true }).then(() => { message.success('整改工序已添加'); revalidator.revalidate() }).catch((e) => message.error(e instanceof Error ? e.message : String(e))) }}><Button size="small" icon={<ExclamationCircleOutlined />} type="primary" ghost>+ 整改</Button></Popconfirm><Button size="small" onClick={() => setPhaseModal(true)}>+ 工序</Button></Space>}>
        {sortedPhases.length > 0 && <div style={{ marginBottom: SPACE.lg }}><PhaseProgress phases={sortedPhases} mode="full" /></div>}
        {sortedPhases.some((ph) => ph.is_rectify && !ph.actual_end_date) && <Alert type="warning" showIcon icon={<ExclamationCircleOutlined />} message="该项目有未完成的整改工序，请相关人员及时更新进度" style={{ marginBottom: SPACE.lg }} />}
        {sortedPhases.map((ph) => { const c = phaseControls(ph); return <PhaseCard key={ph.id} ph={ph} project={project} canEditDates={c.canEditDates} canAssign={c.canAssign} roleCodeForAssign={c.roleCodeForAssign} canUpdateStatus={c.canUpdateStatus} canAddIncident={c.canAddIncident} canDelete={c.canDelete} onAddIncident={(id) => { setIncidentModal(id); incidentForm.resetFields() }} onDeletePhase={onDeletePhase} onEditPhase={onEditPhase} onRefresh={() => revalidator.revalidate()} /> })}
      </Card>

      <Modal open={!!incidentModal} title="添加事故事件" onCancel={() => { setIncidentModal(null); setIncidentFiles([]) }} onOk={() => incidentForm.submit()}>
        <Form form={incidentForm} layout="vertical" onFinish={onAddIncident}>
          <Form.Item name="category" label="类别" initialValue="现状描述">
            <Select options={[{ label: '现状描述', value: '现状描述' }, { label: '逾期原因', value: '逾期原因' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="图片（可选）">
            <Upload
              accept="image/*"
              listType="picture-card"
              multiple
              beforeUpload={(file) => { setIncidentFiles(prev => [...prev, file]); return false }}
              onRemove={(file) => { setIncidentFiles(prev => prev.filter(f => f.name !== file.name && f.size !== file.size)) }}
              fileList={incidentFiles.map((f, i) => ({ uid: `-${i}`, name: f.name, status: 'done' as const, originFileObj: f as any }))}
            >
              {incidentFiles.length < 5 && '+ 上传'}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
      <Modal open={phaseModal} title="添加工序" onCancel={() => setPhaseModal(false)} onOk={() => phaseForm.submit()}><Form form={phaseForm} layout="vertical" onFinish={onAddPhase} onValuesChange={(c) => { if (c.phase_name) { const m: Record<string, number> = { '机械设计': 1, '生产': 2, '调机': 3, '尾款': 4 }; phaseForm.setFieldsValue({ seq: m[c.phase_name] || 1 }) } }}><Form.Item name="phase_name" label="阶段" rules={[{ required: true }]}><Select options={['机械设计', '生产', '调机', '尾款', '整改'].map((s) => ({ label: s, value: s }))} /></Form.Item><Form.Item name="sub_name" label="子项名称"><Input /></Form.Item><Form.Item name="seq" hidden><InputNumber /></Form.Item><Form.Item name="responsible" label="责任人"><Input /></Form.Item></Form></Modal>
      <Modal open={editModal} title="编辑项目信息" onCancel={() => setEditModal(false)} onOk={() => editForm.submit()} width={480}><Form form={editForm} layout="vertical" onFinish={onEditProject}><Form.Item name="end_customer" label="终端客户"><Input /></Form.Item><Form.Item name="contract_start_date" label="立项日期"><DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} /></Form.Item><Form.Item name="contract_duration_days" label="合同天数"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Form.Item name="contract_expected_delivery_date" label="预计交期"><DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} /></Form.Item><Form.Item name="payment_due_type" label="尾款到期条件"><Select allowClear options={[{ label: '安调/验收完成后 N 天', value: 'after_tuning' }, { label: '已发货后 N 天', value: 'after_shipping' }]} /></Form.Item><Form.Item name="payment_due_days" label="尾款到期天数 N"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Form></Modal>
    </Space>
  )
}
