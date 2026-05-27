import { useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  createCustomer,
  createPerson,
  deleteCustomer,
  deletePerson,
  listCustomers,
  listPersons,
  listProjects,
  listRoles,
  resetPersonPassword,
  togglePersonActive,
  updateCustomer,
  updatePerson,
} from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { ProjectTable } from '../../components/ProjectTable'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import type { Customer, Person, Project, RoleDefinition } from '../../types'

export function AdminWorkspace() {
  const navigate = useNavigate()
  const auth = useAuth()
  const showPayment = auth.hasPermission('view_payment_column')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Customer modal state
  const [customerOpen, setCustomerOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerForm] = Form.useForm()

  // Person modal state
  const [personOpen, setPersonOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [personSaving, setPersonSaving] = useState(false)
  const [personForm] = Form.useForm()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, s, r, c] = await Promise.all([listProjects(), listPersons(), listRoles(), listCustomers()])
      setProjects(p)
      setPersons(s)
      setRoles(r)
      setCustomers(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const overduePhases = projects.flatMap((p) =>
    p.phases
      .filter((ph) => ph.phase_progress === '逾期')
      .map((ph) => ({ ...ph, project_order_no: p.order_no, project_id: p.id }))
  )
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r.name]))

  // ─── Customer handlers ─────────────────────────────────────

  function openCustomerModal(edit?: Customer) {
    if (edit) {
      setEditingCustomer(edit)
      customerForm.setFieldsValue({ code: edit.code, name: edit.name })
    } else {
      setEditingCustomer(null)
      customerForm.resetFields()
    }
    setCustomerOpen(true)
  }

  async function onSaveCustomer() {
    try {
      const values = await customerForm.validateFields()
      setCustomerSaving(true)
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, values)
        message.success('客户已更新')
      } else {
        await createCustomer(values)
        message.success('客户已创建')
      }
      setCustomerOpen(false)
      setEditingCustomer(null)
      customerForm.resetFields()
      setCustomers(await listCustomers())
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    }
    setCustomerSaving(false)
  }

  async function onDeleteCustomer(id: string) {
    try {
      await deleteCustomer(id)
      message.success('客户已删除')
      setCustomers(await listCustomers())
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  // ─── Person handlers ───────────────────────────────────────

  function openPersonModal(edit?: Person) {
    if (edit) {
      setEditingPerson(edit)
      personForm.setFieldsValue({ name: edit.name, department: edit.department, role_code: edit.role_code })
    } else {
      setEditingPerson(null)
      personForm.resetFields()
    }
    setPersonOpen(true)
  }

  async function onSavePerson() {
    try {
      const values = await personForm.validateFields()
      setPersonSaving(true)
      if (editingPerson) {
        await updatePerson(editingPerson.id, values)
        message.success('已更新')
      } else {
        await createPerson(values)
        message.success('已创建')
      }
      setPersonOpen(false)
      setEditingPerson(null)
      personForm.resetFields()
      await load()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    }
    setPersonSaving(false)
  }

  async function onDeletePerson(id: string) {
    try {
      await deletePerson(id)
      message.success('已删除')
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function onResetPassword(id: string) {
    try {
      const res = await resetPersonPassword(id, '123456')
      message.success(`密码已重置为: ${res.password}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function onTogglePersonActive(id: string, active: boolean) {
    try {
      await togglePersonActive(id, active)
      message.success(active ? '已启用' : '已停用')
      setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: active } : p)))
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  // ─── Render ────────────────────────────────────────────────

  const stats = (
    <><Tag color="blue">项目 {projects.length}</Tag><Tag color="purple">人员 {persons.length}</Tag>
    <Tag color="cyan">客户 {customers.length}</Tag>
    {overduePhases.length > 0 && <Tag color="red">逾期 {overduePhases.length}</Tag>}</>
  )

  return (
    <WorkspaceShell loading={loading} error={error} extra={stats}>
      <Tabs items={[
          {
            key: 'overview', label: '项目总览',
            children: (
              <ProjectFilterBar projects={projects}>
                {(filtered) => (
              <ProjectTable
                projects={filtered}
                columns={['order_no', 'equipment', 'end_customer', 'status', 'payment', 'phases']}
                showPayment={showPayment}
                endCustomerInline={false}
                onRow={(r) => ({ onClick: () => navigate(`/projects/${r.id}`), style: { cursor: 'pointer' } })}
              />
                )}
              </ProjectFilterBar>
            ),
          },
          {
            key: 'customers', label: `客户管理 (${customers.length})`,
            children: (
              <div>
                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => openCustomerModal()}>添加客户</Button>
                </div>
                <Table<Customer>
                  rowKey="id" dataSource={customers} size="small" pagination={{ pageSize: 15 }}
                  columns={[
                    { title: '客户简称', dataIndex: 'code', sorter: (a, b) => a.code.localeCompare(b.code), width: 120 },
                    { title: '客户全称', dataIndex: 'name', render: (v: string) => v || '-' },
                    { title: '创建时间', dataIndex: 'created_at', render: (v: string) => v ? v.slice(0, 10) : '-' },
                    { title: '操作', key: 'actions', width: 150, render: (_, c) => (
                      <Space size={0}>
                        <Button size="small" type="link" onClick={() => openCustomerModal(c)}>编辑</Button>
                        <Popconfirm title={`确认删除客户 ${c.code}?`} onConfirm={() => onDeleteCustomer(c.id)}>
                          <Button size="small" type="link" danger>删除</Button>
                        </Popconfirm>
                      </Space>
                    )},
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'persons', label: `人员管理 (${persons.length})`,
            children: (
              <div>
                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => openPersonModal()}>添加人员</Button>
                </div>
                <Table<Person>
                  rowKey="id" dataSource={persons} size="small" pagination={{ pageSize: 15 }}
                  columns={[
                    { title: '姓名', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
                    { title: '部门', dataIndex: 'department', render: (v: string) => v || '-' },
                    { title: '角色', key: 'role_code', render: (_, p) => (
                      <Tag style={{ fontSize: 11 }}>{roleMap[p.role_code] || p.role_code || '-'}</Tag>
                    )},
                    { title: '启用', key: 'is_active', width: 60, render: (_, p) => (
                      <Switch size="small" checked={p.is_active} onChange={(v) => onTogglePersonActive(p.id, v)} />
                    )},
                    { title: '操作', key: 'actions', width: 220, render: (_, p) => (
                      <Space size={0}>
                        <Button size="small" type="link" onClick={() => openPersonModal(p)}>编辑</Button>
                        <Popconfirm title={`重置 ${p.name} 的密码?`} onConfirm={() => onResetPassword(p.id)}>
                          <Button size="small" type="link">密码</Button>
                        </Popconfirm>
                        <Popconfirm title={`确认删除 ${p.name}?`} onConfirm={() => onDeletePerson(p.id)}>
                          <Button size="small" type="link" danger>删除</Button>
                        </Popconfirm>
                      </Space>
                    )},
                  ]}
                />
              </div>
            ),
          },
        ]} />

      {/* Customer Modal */}
      <Modal
        open={customerOpen}
        title={editingCustomer ? '编辑客户' : '添加客户'}
        onCancel={() => { setCustomerOpen(false); setEditingCustomer(null); customerForm.resetFields() }}
        onOk={onSaveCustomer}
        confirmLoading={customerSaving}
        destroyOnClose
      >
        <Form form={customerForm} layout="vertical">
          <Form.Item name="code" label="客户简称" rules={[{ required: true, message: '请输入客户简称' }]}>
            <Input placeholder="如 ZJDGM" autoFocus />
          </Form.Item>
          <Form.Item name="name" label="客户全称" rules={[{ required: true, message: '请输入客户全称' }]}>
            <Input placeholder="如 浙江东格马" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Person Modal */}
      <Modal
        open={personOpen}
        title={editingPerson ? '编辑人员' : '添加人员'}
        onCancel={() => { setPersonOpen(false); setEditingPerson(null); personForm.resetFields() }}
        onOk={onSavePerson}
        confirmLoading={personSaving}
        destroyOnClose
      >
        <Form form={personForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="王文哲" autoFocus />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="技术部" />
          </Form.Item>
          <Form.Item name="role_code" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roles.map((r) => ({ label: r.name, value: r.code }))} />
          </Form.Item>
        </Form>
      </Modal>
    </WorkspaceShell>
  )
}
