import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import {
  addAssignment,
  listAssignments,
  listPersons,
  listPhasesGlobal,
  listProjects,
  removeAssignment,
} from '../../api'
import type { Project, ProjectAssignment, ProjectPhase } from '../../types'

export function AfterSalesWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{ project: Project; productionPhase: ProjectPhase; tuningPhase: ProjectPhase; assignments: ProjectAssignment[] }[]>([])
  const [persons, setPersons] = useState<string[]>([])
  const [form] = Form.useForm()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const allProjects = await listProjects()
        const allPersons = await listPersons()
        setPersons(allPersons)

        const rows: typeof data = []
        for (const p of allProjects) {
          const phases = await listPhasesGlobal({ project_id: p.id })
          const prod = phases.find((ph) => ph.seq === 2)
          const tuning = phases.find((ph) => ph.seq === 3)
          // 只显示已进入生产阶段的项目
          if (prod && prod.status !== '' && prod.status !== '未开始') {
            const as = await listAssignments(p.id)
            rows.push({ project: p, productionPhase: prod, tuningPhase: tuning!, assignments: as })
          }
        }
        setData(rows)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function onAssign(projectId: string, values: { person_name: string | string[] }) {
    const name = Array.isArray(values.person_name) ? values.person_name[0] : values.person_name
    if (!name) return
    try {
      await addAssignment(projectId, { person_name: name, role_code: 'tuning_executor' })
      message.success('安调执行人已指派')
      // 刷新
      const rows = [...data]
      for (const r of rows) {
        if (r.project.id === projectId) {
          r.assignments = await listAssignments(projectId)
        }
      }
      setData(rows)
      form.resetFields()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function onRemoveAssign(projectId: string, assignmentId: string) {
    try {
      await removeAssignment(projectId, assignmentId)
      const rows = [...data]
      for (const r of rows) {
        if (r.project.id === projectId) {
          r.assignments = r.assignments.filter((a) => a.id !== assignmentId)
        }
      }
      setData(rows)
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : data.length === 0 ? (
        <Empty description="暂无进入生产阶段的项目" />
      ) : (
        data.map(({ project, productionPhase, tuningPhase, assignments }) => {
          const tuningAssignments = assignments.filter((a) => a.role_code === 'tuning_executor')
          return (
            <Card key={project.id} size="small" title={project.order_no}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space>
                  <Tag color="blue">生产: {productionPhase.status || '-'}</Tag>
                  <Tag color={tuningPhase?.status === '安调完成' ? 'green' : 'orange'}>
                    调机: {tuningPhase?.status || '未开始'}
                  </Tag>
                </Space>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>安调执行人:</Typography.Text>
                  <Space wrap style={{ marginLeft: 8 }}>
                    {tuningAssignments.length === 0 ? (
                      <Tag>未指派</Tag>
                    ) : (
                      tuningAssignments.map((a) => (
                        <Tag
                          key={a.id}
                          closable
                          onClose={() => onRemoveAssign(project.id, a.id)}
                          color="blue"
                        >
                          {a.person_name}
                        </Tag>
                      ))
                    )}
                  </Space>
                </div>
                <Form form={form} layout="inline" onFinish={(v) => onAssign(project.id, v)}>
                  <Form.Item name="person_name" rules={[{ required: true }]}>
                    <Select mode="tags" maxCount={1} style={{ width: 150 }} placeholder="人员姓名" options={persons.map((p) => ({ label: p, value: p }))} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" size="small" htmlType="submit">指派安调</Button>
                  </Form.Item>
                </Form>
              </Space>
            </Card>
          )
        })
      )}
    </Space>
  )
}
