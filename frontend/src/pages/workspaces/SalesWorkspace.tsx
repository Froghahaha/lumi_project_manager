import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { createProject, listProjects, listTemplates, updateProject } from '../../api'
import type { Project, PhaseTemplate } from '../../types'

const EQUIP_CATEGORIES = ['关节', '桁架', '视觉桁架', '联线', '其他']

export function SalesWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<PhaseTemplate[]>([])
  const [form] = Form.useForm()
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const p = await listProjects({ assigned_person: auth.person?.name || '' || undefined, role_code: auth.role })
      setProjects(p)
      const t = await listTemplates()
      setTemplates(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [auth.person?.name || '', auth.role])

  async function onCreate(values: {
    customer_code: string; order_no: string; template_id: string
    equipment_category: string; equipment_spec: string; equipment_quantity: number
    contract_payment_progress: number; contract_start_date: string; contract_duration_days: number
  }) {
    setCreating(true)
    setError(null)
    const order_no = `${values.customer_code}-${values.order_no}`
    try {
      await createProject({
        order_no,
        template_id: values.template_id,
        equipment_category: values.equipment_category,
        equipment_spec: values.equipment_spec,
        equipment_quantity: values.equipment_quantity,
        contract_payment_progress: values.contract_payment_progress,
        contract_start_date: values.contract_start_date || null,
        contract_duration_days: values.contract_duration_days || null,
      })
      form.resetFields()
      message.success('项目已创建')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setCreating(false)
  }

  async function onUpdatePayment(projectId: string, v: number | null) {
    if (v == null) return
    try {
      await updateProject(projectId, { contract_payment_progress: v })
      setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, contract_payment_progress: v } : p))
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        工作台 - {auth.roleName}
      </Typography.Title>
      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <Card size="small" title="收款进度">
          <Table<Project>
            rowKey="id"
            dataSource={projects}
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '项目', dataIndex: 'order_no' },
              {
                title: '收款', dataIndex: 'contract_payment_progress',
                render: (v: number | null, record) => (
                  <InputNumber
                    size="small"
                    min={0} max={1} step={0.1}
                    value={v}
                    onChange={(val) => onUpdatePayment(record.id, val)}
                    style={{ width: 80 }}
                  />
                ),
              },
              {
                title: '进度', dataIndex: 'contract_payment_progress',
                render: (v: number | null) => v != null ? (
                  <Tag color={v >= 1 ? 'green' : v >= 0.6 ? 'blue' : 'orange'}>{(v * 100).toFixed(0)}%</Tag>
                ) : '-',
              },
            ]}
          />
        </Card>

        <Card size="small" title="新建项目">
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Space style={{ width: '100%' }}>
              <Form.Item name="customer_code" label="客户" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Input placeholder="浙江东格马" />
              </Form.Item>
              <Form.Item name="order_no" label="序号" rules={[{ required: true }]} style={{ width: 80 }}>
                <Input placeholder="13" />
              </Form.Item>
            </Space>
            <Form.Item name="template_id" label="工序模板">
              <Select allowClear placeholder="生产项目模板(默认)">
                {templates.map((t) => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="equipment_category" label="设备类型">
              <Select allowClear placeholder="桁架">
                {EQUIP_CATEGORIES.map((c) => <Select.Option key={c} value={c}>{c}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="equipment_spec" label="设备描述">
              <Input placeholder="2台桁架一拖一" />
            </Form.Item>
            <Space>
              <Form.Item name="equipment_quantity" label="数量" initialValue={1}>
                <InputNumber min={1} style={{ width: 80 }} />
              </Form.Item>
              <Form.Item name="contract_duration_days" label="合同天数">
                <InputNumber min={0} style={{ width: 90 }} placeholder="30" />
              </Form.Item>
            </Space>
            <Space>
              <Form.Item name="contract_payment_progress" label="收款进度">
                <InputNumber min={0} max={1} step={0.1} style={{ width: 90 }} placeholder="0.3" />
              </Form.Item>
              <Form.Item name="contract_start_date" label="立项日期">
                <Input placeholder="2026-05-01" style={{ width: 110 }} />
              </Form.Item>
            </Space>
            <Button type="primary" htmlType="submit" loading={creating} block>创建</Button>
          </Form>
        </Card>
      </div>
    </Space>
  )
}
