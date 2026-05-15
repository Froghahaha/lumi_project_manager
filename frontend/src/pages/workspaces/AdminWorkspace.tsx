import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  createPerson,
  listPersons,
  listProjects,
  listRoles,
  updatePerson,
} from '../../api'
import type { Person, Project, RoleDefinition } from '../../types'

export function AdminWorkspace() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [personModal, setPersonModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [personForm] = Form.useForm()

  async function load() {
    setLoading(true)
    try {
      const [p, s, r] = await Promise.all([listProjects(), listPersons(), listRoles()])
      setProjects(p)
      setPersons(s)
      setRoles(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const overduePhases = projects.flatMap((p) =>
    p.phases
      .filter((ph) => ph.planned_end_date && !ph.actual_end_date && new Date() > new Date(ph.planned_end_date))
      .map((ph) => ({ ...ph, project_order_no: p.order_no, project_id: p.id }))
  )
  const abnormalProjects = projects.filter((p) => p.is_abnormal)
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r.name]))

  async function onSavePerson(values: { name: string; department: string; roles: string[] }) {
    try {
      if (editingPerson) {
        await updatePerson(editingPerson.id, values)
        message.success('已更新')
      } else {
        await createPerson(values)
        message.success('已创建')
      }
      setPersonModal(false)
      setEditingPerson(null)
      personForm.resetFields()
      await load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>工作台 - {auth.roleName}</Typography.Title>
        <Space size={8}>
          <Tag color="blue">项目 {projects.length}</Tag>
          <Tag color="purple">人员 {persons.length}</Tag>
          {overduePhases.length > 0 && <Tag color="red">逾期 {overduePhases.length}</Tag>}
        </Space>
      </Space>
      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <Tabs items={[
          {
            key: 'overview', label: '项目总览',
            children: (
              <Table<Project>
                rowKey="id" dataSource={projects} size="small" pagination={{ pageSize: 15 }}
                onRow={(r) => ({ onClick: () => navigate(`/projects/${r.id}`), style: { cursor: 'pointer' } })}
                columns={[
                  { title: '项目', dataIndex: 'order_no', sorter: (a, b) => a.order_no.localeCompare(b.order_no) },
                  { title: '设备', render: (_, p) => <Tag>{p.equipment_category || '-'}</Tag> },
                  { title: '终端', dataIndex: 'end_customer', render: (v: string | null) => v || '-' },
                  { title: '状态', dataIndex: 'is_abnormal', render: (v: boolean) => v ? <Tag color="red">异常</Tag> : <Tag color="green">正常</Tag> },
                  { title: '工序', key: 'phases', render: (_, p) => (
                    <Space size={2}>{p.phases.slice(0, 5).map((ph) => (
                      <Tag key={ph.seq} color={ph.status && ph.status !== '未开始' ? 'blue' : 'default'} style={{ fontSize: 10, padding: '0 4px' }}>
                        {ph.sub_name || ph.phase_name[0]}
                      </Tag>
                    ))}</Space>
                  )},
                ]}
              />
            ),
          },
          {
            key: 'warnings', label: `预警 (${overduePhases.length + abnormalProjects.length})`,
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {abnormalProjects.length > 0 && (
                  <Card size="small" title="异常项目" type="inner">
                    <Space wrap>{abnormalProjects.map((p) => (
                      <Tag key={p.id} color="red" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>{p.order_no}</Tag>
                    ))}</Space>
                  </Card>
                )}
                {overduePhases.length > 0 ? (
                  <Card size="small" title="逾期工序" type="inner">
                    <Table rowKey="id" dataSource={overduePhases} size="small" pagination={false}
                      columns={[
                        { title: '项目', dataIndex: 'project_order_no', render: (v: string, r: { project_id: string }) => <a onClick={() => navigate(`/projects/${r.project_id}`)}>{v}</a> },
                        { title: '工序', dataIndex: 'phase_name' },
                        { title: '计划完成', dataIndex: 'planned_end_date', render: (v: string) => v?.slice(0, 10) || '-' },
                      ]}
                    />
                  </Card>
                ) : <Empty description="暂无预警" />}
              </Space>
            ),
          },
          {
            key: 'persons', label: `人员管理 (${persons.length})`,
            extra: <Button size="small" onClick={() => { setEditingPerson(null); personForm.resetFields(); setPersonModal(true) }}>+ 人员</Button>,
            children: (
              <Table<Person>
                rowKey="id" dataSource={persons} size="small" pagination={{ pageSize: 15 }}
                columns={[
                  { title: '姓名', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
                  { title: '部门', dataIndex: 'department', render: (v: string) => v || '-' },
                  { title: '角色', key: 'roles', render: (_, p) => (
                    <Space size={2}>{p.roles.map((rc) => <Tag key={rc} style={{ fontSize: 11 }}>{roleMap[rc] || rc}</Tag>)}</Space>
                  )},
                  { title: '状态', dataIndex: 'is_active', render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag> },
                  { title: '操作', key: 'actions', render: (_, p) => (
                    <Button size="small" type="link" onClick={() => {
                      setEditingPerson(p)
                      personForm.setFieldsValue({ name: p.name, department: p.department, roles: p.roles })
                      setPersonModal(true)
                    }}>编辑</Button>
                  )},
                ]}
              />
            ),
          },
        ]} />
      )}

      {/* Person Modal */}
      <Modal
        open={personModal}
        title={editingPerson ? '编辑人员' : '添加人员'}
        onCancel={() => { setPersonModal(false); setEditingPerson(null) }}
        onOk={() => personForm.submit()}
      >
        <Form form={personForm} layout="vertical" onFinish={onSavePerson}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="王文哲" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="技术部" />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true }]}>
            <Select mode="multiple" options={roles.map((r) => ({ label: r.name, value: r.code }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
