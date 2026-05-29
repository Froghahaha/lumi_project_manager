import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  Form,
  Input,
  message,
  Modal,
} from 'antd'
import type { ColumnType } from 'antd/es/table'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { ProjectTable } from '../../components/ProjectTable'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import {
  createCustomer,
  createProject,
  getAgreementUrl,
  getNextOrderSeq,
  listCustomers,
  listPersons,
  listProjects,
  listTemplates,
  updateProject,
  uploadAgreement,
} from '../../api'
import { EQUIP_CATEGORIES } from '../../constants'
import type { Customer, Person, Project, PhaseTemplate } from '../../types'

export function SalesWorkspace() {
  const auth = useAuth()
  const canEdit = auth.hasPermission('create_project_form')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<PhaseTemplate[]>([])
  const [form] = Form.useForm()
  const [creating, setCreating] = useState(false)
  const [nextSeq, setNextSeq] = useState<number | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerModal, setCustomerModal] = useState(false)
  const [customerForm] = Form.useForm()
  const [agreementFile, setAgreementFile] = useState<File | null>(null)
  const [salesmen, setSalesmen] = useState<Person[]>([])

  const customerId = Form.useWatch('customer_id', form)

  useEffect(() => {
    if (customerId && customers.length > 0) {
      const c = customers.find(c => c.id === customerId)
      setSelectedCustomer(c || null)
    } else {
      setSelectedCustomer(null)
    }
  }, [customerId, customers])

  useEffect(() => {
    if (selectedCustomer?.code) {
      getNextOrderSeq(selectedCustomer.code).then(r => setNextSeq(r.next_seq)).catch(() => setNextSeq(null))
    } else {
      setNextSeq(null)
    }
  }, [selectedCustomer])

  async function load() {
    setLoading(true)
    try {
      const [p, t, c, s] = await Promise.all([listProjects(), listTemplates(), listCustomers(), listPersons('salesman')])
      setProjects(p)
      setTemplates(t)
      setCustomers(c)
      setSalesmen(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const effectiveCount = projects.filter((p) => p.contract_effective_date).length
  const fullPaidCount = projects.filter((p) => (p.contract_payment_progress ?? 0) >= 1).length

  async function onCreate(values: {
    customer_id: string; contract_number: string; contract_amount: number
    template_id: string; end_customer: string; salesman_name: string
    equipment_list: { category: string; spec: string; quantity: number }[]
    contract_deposit_ratio: number; contract_start_date: dayjs.Dayjs | null; contract_duration_days: number
    payment_due_type: string; payment_due_days: number
  }) {
    if (!canEdit || !selectedCustomer || !nextSeq) return
    setCreating(true)
    setError(null)
    const order_no = `${selectedCustomer.code}-${nextSeq}`
    const equip = values.equipment_list || []
    const assignments = values.salesman_name
      ? [{ person_name: values.salesman_name, role_code: 'salesman' }]
      : []
    try {
      const created = await createProject({
        order_no,
        customer_id: selectedCustomer.id,
        end_customer: values.end_customer || null,
        contract_number: values.contract_number || null,
        contract_amount: values.contract_amount || null,
        contract_deposit_ratio: values.contract_deposit_ratio || null,
        template_id: values.template_id,
        contract_start_date: values.contract_start_date?.format('YYYY-MM-DD') ?? null,
        contract_duration_days: values.contract_duration_days || null,
        payment_due_type: values.payment_due_type || null,
        payment_due_days: values.payment_due_days || null,
        equipment_list: equip,
        assignments,
      })
      if (agreementFile) {
        await uploadAgreement(created.id, agreementFile)
        setAgreementFile(null)
      }
      form.resetFields()
      setNextSeq(null)
      setSelectedCustomer(null)
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
      const project = projects.find((p) => p.id === projectId)
      const threshold = project?.contract_deposit_ratio || 0.3
      setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, contract_payment_progress: v, contract_effective_date: v >= threshold && !p.contract_effective_date ? new Date().toISOString().slice(0, 10) : p.contract_effective_date } : p))
      if (v >= 0.3) {
        message.success('收款已更新，项目已生效')
      } else {
        message.success('收款已更新')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function onSpecialApprove(projectId: string) {
    try {
      const today = dayjs().format('YYYY-MM-DD')
      await updateProject(projectId, { contract_effective_date: today })
      message.success('项目已特批生效')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function onUploadAgreement(projectId: string, file: File) {
    try {
      await uploadAgreement(projectId, file)
      message.success('技术协议已上传')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
    return false
  }

  async function onSaveCustomer(values: { code: string; name: string }) {
    try {
      const created = await createCustomer(values)
      message.success('客户已创建')
      setCustomerModal(false)
      customerForm.resetFields()
      setCustomers(prev => [...prev, created])
      form.setFieldsValue({ customer_id: created.id })
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  const extraColumns: ColumnType<Project>[] = [
    {
      title: '合同金额',
      dataIndex: 'contract_amount',
      render: (v: number | null) => v != null ? `¥${v.toLocaleString()}` : '-',
    },
    {
      title: '收款比例',
      key: 'payment_edit',
      render: (_, record) => canEdit ? (
        <InputNumber
          size="small"
          min={0} max={1} step={0.1}
          value={record.contract_payment_progress}
          onChange={(val) => onUpdatePayment(record.id, val)}
          style={{ width: 80 }}
        />
      ) : (
        <Tag color={record.contract_payment_progress != null && record.contract_payment_progress >= 1 ? 'green' : record.contract_payment_progress != null && record.contract_payment_progress >= 0.6 ? 'blue' : 'orange'}>
          {record.contract_payment_progress != null ? `${(record.contract_payment_progress * 100).toFixed(0)}%` : '-'}
        </Tag>
      ),
    },
    {
      title: '生效',
      dataIndex: 'contract_effective_date',
      render: (v: string | null, record) => v
        ? <Tag color="green">{v.slice(5)}</Tag>
        : (
          <Space size={4}>
            <Tag>待生效</Tag>
            {canEdit && (
              <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }} onClick={() => onSpecialApprove(record.id)}>
                特批生效
              </Button>
            )}
          </Space>
        ),
    },
    {
      title: '协议',
      key: 'agreement',
      render: (_, p) => p.agreement_filename ? (
        <a href={getAgreementUrl(p.id)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>已上传</a>
      ) : canEdit ? (
        <Upload beforeUpload={(file) => { onUploadAgreement(p.id, file); return false }} showUploadList={false}>
          <Button size="small" type="link" style={{ fontSize: 12 }}>上传</Button>
        </Upload>
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>未上传</Typography.Text>
      ),
    },
    {
      title: '交期',
      key: 'delivery',
      render: (_, p) => {
        if (!p.contract_expected_delivery_date) return '-'
        return (
          <Typography.Text style={{ color: p.contract_effective_date && new Date() > new Date(p.contract_expected_delivery_date) ? 'red' : undefined, fontSize: 12 }}>
            {p.contract_expected_delivery_date.slice(5)}
          </Typography.Text>
        )
      },
    },
  ]

  return (
    <WorkspaceShell loading={loading} error={error} extra={
      <><Tag color="green">已生效 {effectiveCount}</Tag><Tag color="purple">完结 {fullPaidCount}</Tag></>
    }>
      <ProjectFilterBar projects={projects}>
        {(filtered) => (
      <div style={{ display: 'grid', gridTemplateColumns: canEdit ? '1fr 420px' : '1fr', gap: 16 }}>
        <Card size="small" title="收款进度">
          <ProjectTable
            projects={filtered}
            columns={['order_no']}
            extraColumns={extraColumns}
          />
        </Card>

        {canEdit && (
          <Card size="small" title="新建项目">
            <Form form={form} layout="vertical" onFinish={onCreate}>
              <Form.Item name="customer_id" label="客户" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="搜索客户名称或简称"
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                  }
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ borderTop: '1px solid #e8e8e8', padding: 8 }}>
                        <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => {
                          setCustomerModal(true)
                          customerForm.resetFields()
                        }}>
                          创建新客户
                        </Button>
                      </div>
                    </>
                  )}
                  options={customers.map(c => ({
                    label: `${c.code} - ${c.name}`,
                    value: c.id,
                  }))}
                />
              </Form.Item>
              <Form.Item label="项目编号">
                <Input value={selectedCustomer?.code && nextSeq ? `${selectedCustomer.code}-${nextSeq}` : '等待选择客户...'} disabled />
              </Form.Item>
              <Form.Item name="contract_number" label="合同编号">
                <Input placeholder="如 HT-2026-001" />
              </Form.Item>
              <Form.Item name="contract_amount" label="合同金额">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="如 100000" prefix="¥" />
              </Form.Item>
              <Form.Item name="template_id" label="工序模板">
                <Select allowClear placeholder="生产项目模板(默认)">
                  {templates.map((t) => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="end_customer" label="终端客户">
                <Input placeholder="如 玉环武创（可选）" />
              </Form.Item>
              <Form.Item name="salesman_name" label="销售负责人">
                <Select allowClear placeholder="选择销售人员">
                  {salesmen.map((s) => <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>)}
                </Select>
              </Form.Item>

              {/* 多设备列表 */}
              <Typography.Text strong style={{ fontSize: 12 }}>设备列表</Typography.Text>
              <Form.List name="equipment_list" initialValue={[{ category: '', spec: '', quantity: 1 }]}>
                {(fields, { add, remove }) => (
                  <div style={{ marginBottom: 8 }}>
                    {fields.map(({ key, name, ...restField }, _idx) => (
                      <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                        <Form.Item {...restField} name={[name, 'category']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0, flex: 1 }}>
                          <Select placeholder="机型" size="small" options={EQUIP_CATEGORIES.map((c) => ({ label: c, value: c }))} />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'spec']} style={{ margin: 0, width: 130 }}>
                          <Input placeholder="描述" size="small" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'quantity']} style={{ margin: 0, width: 70 }}>
                          <InputNumber placeholder="数量" size="small" min={1} style={{ width: 70 }} />
                        </Form.Item>
                        {fields.length > 1 && (
                          <DeleteOutlined onClick={() => remove(name)} style={{ marginTop: 4, color: '#999', cursor: 'pointer' }} />
                        )}
                      </div>
                    ))}
                    <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => add({ category: '', spec: '', quantity: 1 })} block>
                      添加设备
                    </Button>
                  </div>
                )}
              </Form.List>

              <Space>
                <Form.Item name="contract_duration_days" label="合同天数">
                  <InputNumber min={0} style={{ width: 90 }} placeholder="30" />
                </Form.Item>
                <Form.Item name="contract_deposit_ratio" label="首付比例(阈值)">
                  <InputNumber min={0} max={1} step={0.1} style={{ width: 90 }} placeholder="0.3" />
                </Form.Item>
              </Space>
              <Form.Item name="contract_start_date" label="立项日期">
                <DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="payment_due_type" label="尾款开始征收条件">
                <Select allowClear placeholder="选择合同约定的前置条件" options={[
                  { label: '验收完成', value: 'after_acceptance' },
                  { label: '已发货', value: 'after_shipping' },
                  { label: '安调完成', value: 'after_tuning' },
                ]} />
              </Form.Item>
              <Form.Item name="payment_due_days" label="尾款到期天数">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="合同约定的天数" />
              </Form.Item>
              <Form.Item label="技术协议">
                <Upload
                  beforeUpload={(file) => { setAgreementFile(file); return false }}
                  showUploadList={false}
                >
                  <Button size="small" icon={<UploadOutlined />}>
                    {agreementFile ? agreementFile.name : '选择技术协议（可跳过）'}
                  </Button>
                </Upload>
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={creating} block>创建</Button>
            </Form>
          </Card>
        )}
      </div>
        )}
      </ProjectFilterBar>

      {/* Customer creation modal */}
      <Modal
        open={customerModal}
        title="创建新客户"
        onCancel={() => setCustomerModal(false)}
        onOk={() => customerForm.submit()}
      >
        <Form form={customerForm} layout="vertical" onFinish={onSaveCustomer}>
          <Form.Item name="code" label="客户简称" rules={[{ required: true }]}>
            <Input placeholder="如 ZJDGM" />
          </Form.Item>
          <Form.Item name="name" label="客户全称" rules={[{ required: true }]}>
            <Input placeholder="如 浙江东格马" />
          </Form.Item>
        </Form>
      </Modal>
    </WorkspaceShell>
  )
}
