import { useState } from 'react'
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
import { Link, useLoaderData, useRevalidator } from 'react-router-dom'
import { createProject, listTemplates } from '../api'
import type { Project, PhaseTemplate } from '../types'
import { useEffect } from 'react'

const EQUIP_CATEGORIES = ['关节', '桁架', '视觉桁架', '联线', '其他']

export function ProjectsPage() {
  const { projects } = useLoaderData() as { projects: Project[] }
  const revalidator = useRevalidator()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<PhaseTemplate[]>([])

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {})
  }, [])

  async function onCreate(values: {
    customer_code: string
    order_no: string
    template_id: string
    equipment_category: string
    equipment_spec: string
    equipment_quantity: number
    contract_payment_progress: number
    contract_start_date: string
    contract_duration_days: number
  }) {
    setLoading(true)
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
      revalidator.revalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  function fmtDate(d: string | null) {
    if (!d) return '-'
    return d.slice(5)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        项目列表
      </Typography.Title>
      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <Card>
          <Table<Project>
            rowKey="id"
            dataSource={projects}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            columns={[
              {
                title: '项目',
                key: 'name',
                render: (_, p) => (
                  <Space direction="vertical" size={0}>
                    <Link to={`/projects/${p.id}`} style={{ fontWeight: 700 }}>
                      {p.order_no}
                    </Link>
                    {p.end_customer && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        终端: {p.end_customer}
                      </Typography.Text>
                    )}
                  </Space>
                ),
                sorter: (a, b) => a.order_no.localeCompare(b.order_no),
              },
              {
                title: '设备',
                key: 'equipment',
                render: (_, p) => (
                  <Space size={4}>
                    <Tag>{p.equipment_category || '-'}</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      ×{p.equipment_quantity}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: '状态',
                dataIndex: 'is_abnormal',
                render: (v: boolean) => (v ? <Tag color="red">异常</Tag> : <Tag color="green">正常</Tag>),
              },
              {
                title: '收款',
                dataIndex: 'contract_payment_progress',
                render: (v: number | null) =>
                  v != null ? (
                    <Tag color={v >= 1 ? 'green' : v >= 0.6 ? 'blue' : 'orange'}>
                      {(v * 100).toFixed(0)}%
                    </Tag>
                  ) : (
                    '-'
                  ),
              },
              {
                title: '交期',
                key: 'delivery',
                render: (_, p) => fmtDate(p.contract_expected_delivery_date),
              },
              {
                title: '工序',
                key: 'phases',
                render: (_, p) => (
                  <Space size={2}>
                    {p.phases.slice(0, 5).map((ph) => {
                      const overdue = ph.planned_end_date && ph.actual_end_date
                        ? new Date(ph.actual_end_date) > new Date(ph.planned_end_date)
                        : false
                      return (
                        <Tag
                          key={ph.seq}
                          color={overdue ? 'red' : ph.actual_end_date ? 'green' : 'default'}
                          style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px' }}
                        >
                          {ph.phase_name}
                        </Tag>
                      )
                    })}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card title="新建项目">
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
                {templates.map((t) => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="equipment_category" label="设备类型">
              <Select allowClear placeholder="桁架">
                {EQUIP_CATEGORIES.map((c) => (
                  <Select.Option key={c} value={c}>
                    {c}
                  </Select.Option>
                ))}
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
            <Button type="primary" htmlType="submit" loading={loading} block>
              创建
            </Button>
          </Form>
        </Card>
      </div>
    </Space>
  )
}
