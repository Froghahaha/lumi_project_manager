import { useState } from 'react'
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
  Steps,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from 'antd'
import dayjs from 'dayjs'
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import {
  addIncident,
  addPhase,
  addTeamMember,
  deletePhase,
  deleteProject,
  removeTeamMember,
  updateProject,
} from '../api'
import type { Project, ProjectPhase } from '../types'

function phaseOverdue(ph: ProjectPhase): boolean {
  if (!ph.planned_end_date) return false
  const end = ph.actual_end_date ? new Date(ph.actual_end_date) : new Date()
  return end > new Date(ph.planned_end_date)
}

function fmtDate(d: string | null): string {
  if (!d) return '-'
  return d.slice(0, 10)
}

export function ProjectPage() {
  const { project } = useLoaderData() as { project: Project }
  const { projectId } = useParams<{ projectId: string }>()
  const revalidator = useRevalidator()

  const [incidentModal, setIncidentModal] = useState<string | null>(null)
  const [incidentForm] = Form.useForm()

  const [phaseModal, setPhaseModal] = useState(false)
  const [phaseForm] = Form.useForm()

  const [teamModal, setTeamModal] = useState(false)
  const [teamForm] = Form.useForm()

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

  async function onAddPhase(values: { phase_name: string; seq: number; responsible: string }) {
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

  async function onAddTeam(values: { person_name: string; role: string }) {
    if (!projectId) return
    await addTeamMember(projectId, values)
    setTeamModal(false)
    teamForm.resetFields()
    revalidator.revalidate()
  }

  async function onRemoveTeam(teamId: string) {
    if (!projectId) return
    await removeTeamMember(projectId, teamId)
    revalidator.revalidate()
  }

  async function onDelete() {
    if (!projectId) return
    await deleteProject(projectId)
    window.location.href = '/'
  }

  const sortedPhases = [...project.phases].sort((a, b) => a.seq - b.seq)
  const maxSeq = sortedPhases.length > 0 ? sortedPhases[sortedPhases.length - 1].seq : 0

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
          <Descriptions.Item label="类型">
            <Tag>{project.equipment_category || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="数量">{project.equipment_quantity}</Descriptions.Item>
          <Descriptions.Item label="异常标记">
            <Select
              value={project.is_abnormal}
              onChange={onToggleAbnormal}
              size="small"
              style={{ width: 80 }}
              options={[
                { label: '正常', value: false },
                { label: '异常', value: true },
              ]}
            />
          </Descriptions.Item>
          <Descriptions.Item label="收款进度">
            <InputNumber
              size="small"
              min={0}
              max={1}
              step={0.1}
              value={project.contract_payment_progress}
              onChange={onUpdatePayment}
              style={{ width: 80 }}
            />
          </Descriptions.Item>
          <Descriptions.Item label="立项">{fmtDate(project.contract_start_date)}</Descriptions.Item>
          <Descriptions.Item label="合同天数">
            {project.contract_duration_days ?? '-'}天
          </Descriptions.Item>
          <Descriptions.Item label="预计交期">
            {fmtDate(project.contract_expected_delivery_date)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title="工序"
        extra={
          <Space>
            <Button size="small" onClick={() => setPhaseModal(true)}>
              + 工序
            </Button>
          </Space>
        }
      >
        {sortedPhases.map((ph) => {
          const overdue = phaseOverdue(ph)
          return (
            <Card
              key={ph.id}
              size="small"
              type="inner"
              style={{ marginBottom: 8 }}
              title={
                <Space>
                  <Tag color={overdue ? 'red' : ph.actual_end_date ? 'green' : 'blue'}>
                    {ph.phase_name}
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {ph.responsible || '未指定'}
                  </Typography.Text>
                </Space>
              }
              extra={
                <Space size={4}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {fmtDate(ph.start_date)} → {fmtDate(ph.planned_end_date)}
                    {ph.actual_end_date && ` → ${fmtDate(ph.actual_end_date)}`}
                    {ph.actual_duration != null && ` (${ph.actual_duration}天)`}
                  </Typography.Text>
                  <Popconfirm title="确认删除?" onConfirm={() => onDeletePhase(ph.id)}>
                    <Button danger size="small" type="text">
                      ×
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              <Table<Project['phases'][0]['incidents'][0]>
                rowKey="id"
                dataSource={ph.incidents}
                size="small"
                pagination={false}
                locale={{ emptyText: '无事故事件' }}
                columns={[
                  {
                    title: '日期',
                    dataIndex: 'occurred_at',
                    width: 100,
                    render: (v: string) => (v ? v.slice(0, 10) : '-'),
                  },
                  {
                    title: '类别',
                    dataIndex: 'category',
                    width: 80,
                    render: (v: string) => {
                      const colors: Record<string, string> = {
                        原因: 'red',
                        现状: 'blue',
                        应急: 'orange',
                        长效: 'green',
                      }
                      return v ? <Tag color={colors[v] || 'default'}>{v}</Tag> : null
                    },
                  },
                  { title: '描述', dataIndex: 'description' },
                ]}
              />
              <Button
                type="link"
                size="small"
                style={{ marginTop: 4 }}
                onClick={() => {
                  setIncidentModal(ph.id)
                  incidentForm.resetFields()
                }}
              >
                + 添加事件
              </Button>
            </Card>
          )
        })}
      </Card>

      <Card
        size="small"
        title="团队"
        extra={<Button size="small" onClick={() => setTeamModal(true)}>+ 成员</Button>}
      >
        <Space wrap>
          {project.team.map((t) => (
            <Tag
              key={t.id}
              closable
              onClose={() => onRemoveTeam(t.id)}
            >
              {t.person_name} ({t.role})
            </Tag>
          ))}
        </Space>
      </Card>

      {/* Incident Modal */}
      <Modal
        open={!!incidentModal}
        title="添加事故事件"
        onCancel={() => setIncidentModal(null)}
        onOk={() => incidentForm.submit()}
      >
        <Form form={incidentForm} layout="vertical" onFinish={onAddIncident}>
          <Form.Item name="occurred_at" label="日期" rules={[{ required: true }]}>
            <Input placeholder="2026-05-01" />
          </Form.Item>
          <Form.Item name="category" label="类别">
            <Select
              options={[
                { label: '现状', value: '现状' },
                { label: '原因', value: '原因' },
                { label: '应急', value: '应急' },
                { label: '长效', value: '长效' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Phase Modal */}
      <Modal
        open={phaseModal}
        title="添加工序"
        onCancel={() => setPhaseModal(false)}
        onOk={() => phaseForm.submit()}
      >
        <Form form={phaseForm} layout="vertical" onFinish={onAddPhase}>
          <Form.Item name="phase_name" label="工序名" rules={[{ required: true }]}>
            <Input placeholder="出厂前预验收" />
          </Form.Item>
          <Form.Item name="seq" label="排序" initialValue={maxSeq + 1}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="responsible" label="责任人">
            <Input placeholder="王文哲" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Team Modal */}
      <Modal
        open={teamModal}
        title="添加成员"
        onCancel={() => setTeamModal(false)}
        onOk={() => teamForm.submit()}
      >
        <Form form={teamForm} layout="vertical" onFinish={onAddTeam}>
          <Form.Item name="person_name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="王文哲" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select
              options={[
                { label: '销售', value: '销售' },
                { label: '项目经理', value: '项目经理' },
                { label: '设计', value: '设计' },
                { label: '生产', value: '生产' },
                { label: '调机', value: '调机' },
                { label: '验收', value: '验收' },
                { label: '收款', value: '收款' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
