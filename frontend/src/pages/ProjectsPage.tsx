import { useMemo, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tag, Typography, Upload, message } from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { Link, useLoaderData, useRevalidator } from 'react-router-dom'
import { createProject, uploadProjectOverviewImage } from '../api'
import type { Project } from '../types'

const PROJECT_TYPES = ['研发项目', '品质项目', '品质问题跟踪'] as const

function yyyymmdd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function ProjectsPage() {
  const { projects } = useLoaderData() as { projects: Project[] }
  const revalidator = useRevalidator()

  const [form] = Form.useForm<{ name: string; type: (typeof PROJECT_TYPES)[number]; priority: number; overview?: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generatedCode = useMemo(() => {
    const day = yyyymmdd(new Date())
    const prefix = `PRJ-${day}-`
    const count = projects.filter((p) => (p.code ?? '').startsWith(prefix)).length
    return `${prefix}${String(count + 1).padStart(3, '0')}`
  }, [projects])

  const [images, setImages] = useState<RcFile[]>([])
  const uploadFileList: UploadFile[] = images.map((f) => ({
    uid: f.uid,
    name: f.name,
    size: f.size,
    type: f.type,
    originFileObj: f,
  }))

  async function onCreate(values: { name: string; type: (typeof PROJECT_TYPES)[number]; priority: number; overview?: string }) {
    setLoading(true)
    setError(null)
    try {
      const created = await createProject({
        name: values.name.trim(),
        type: values.type,
        priority: values.priority,
        overview: values.overview?.trim() || undefined,
      })
      for (const f of images) {
        await uploadProjectOverviewImage(created.id, f)
      }
      form.resetFields()
      setImages([])
      message.success('项目已创建')
      revalidator.revalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
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
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            columns={[
              {
                title: '项目',
                dataIndex: 'name',
                render: (_, p) => (
                  <Space direction="vertical" size={0}>
                    <Link to={`/projects/${p.id}`} style={{ fontWeight: 700 }}>
                      {p.name}
                    </Link>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {p.code ?? '-'}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: '类型',
                dataIndex: 'type',
                render: (v: Project['type']) => v ?? '-',
              },
              {
                title: '优先级',
                dataIndex: 'priority',
                render: (v: number) => <Tag color={v >= 4 ? 'red' : v >= 3 ? 'orange' : 'green'}>{v}</Tag>,
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: Project['status']) => <Tag color="blue">{v}</Tag>,
              },
              {
                title: '',
                key: 'actions',
                width: 90,
                render: (_, p) => (
                  <Link to={`/projects/${p.id}`} style={{ fontSize: 12 }}>
                    工作台
                  </Link>
                ),
              },
            ]}
          />
        </Card>

        <Card title="新建项目">
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void onCreate(values)}
            initialValues={{ name: '', type: '研发项目', priority: 3, overview: '' }}
          >
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
              <Input placeholder="例如：天裕" />
            </Form.Item>
            <Form.Item label="项目编号">
              <Input value={generatedCode} disabled />
            </Form.Item>
            <Form.Item name="type" label="项目类型" rules={[{ required: true, message: '请选择项目类型' }]}>
              <Select options={PROJECT_TYPES.map((t) => ({ label: t, value: t }))} />
            </Form.Item>
            <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请输入优先级' }]}>
              <InputNumber min={1} max={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="overview" label="项目概述">
              <Input.TextArea rows={4} placeholder="输入项目的大概描述（可用于会议快速对齐背景）" />
            </Form.Item>
            <Form.Item label="概述图片">
              <Upload
                multiple
                beforeUpload={(f) => {
                  setImages((prev) => [...prev, f])
                  return false
                }}
                onRemove={(f) => {
                  setImages((prev) => prev.filter((x) => x.uid !== f.uid))
                }}
                fileList={uploadFileList}
              >
                <Button disabled={loading}>选择图片</Button>
              </Upload>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              创建
            </Button>
          </Form>
        </Card>
      </div>
    </Space>
  )
}

