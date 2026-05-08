import { Alert, Button, Form, Input, Layout as AntLayout, Menu, Modal, Select, Space, Typography, Upload, message } from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { createProject, uploadProjectOverviewImage } from '../api'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedKey = location.pathname.startsWith('/meeting') ? '/meeting' : '/'

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm] = Form.useForm<{ name: string; type: string; priority: number; overview?: string }>()
  const [createImages, setCreateImages] = useState<RcFile[]>([])
  const uploadFileList: UploadFile[] = createImages.map((f) => ({
    uid: f.uid,
    name: f.name,
    size: f.size,
    type: f.type,
    originFileObj: f,
  }))

  async function onCreate(values: { name: string; type: string; priority: number; overview?: string }) {
    setCreateLoading(true)
    setCreateError(null)
    try {
      const created = await createProject({
        name: values.name.trim(),
        type: values.type,
        priority: values.priority,
        overview: values.overview?.trim() || undefined,
      })
      for (const f of createImages) {
        await uploadProjectOverviewImage(created.id, f)
      }
      message.success('项目已创建')
      setCreateOpen(false)
      createForm.resetFields()
      setCreateImages([])
      navigate(`/projects/${created.id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
    }
    setCreateLoading(false)
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Sider collapsible width={220} style={{ background: '#001529' }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 700 }}>项目管理</Typography.Text>
          </Link>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            { key: '/', label: <Link to="/">仪表盘</Link> },
            { key: '/meeting', label: <Link to="/meeting">会议Check</Link> },
          ]}
        />
      </AntLayout.Sider>

      <AntLayout>
        <AntLayout.Header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Input.Search placeholder="搜索项目/事项" allowClear style={{ maxWidth: 520 }} />
          <Space size={8} style={{ marginLeft: 'auto' }}>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              新建项目
            </Button>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>X-User: demo</Typography.Text>
          </Space>
        </AntLayout.Header>
        <AntLayout.Content style={{ padding: 16 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Outlet />
          </div>
        </AntLayout.Content>
      </AntLayout>

      <Modal title="新建项目" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} destroyOnClose>
        {createError ? <Alert type="error" showIcon message="创建失败" description={createError} style={{ marginBottom: 12 }} /> : null}
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => void onCreate(values)}
          initialValues={{ name: '', type: '研发项目', priority: 3, overview: '' }}
        >
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：天裕" disabled={createLoading} />
          </Form.Item>
          <Form.Item label="项目编号">
            <Input value="创建后自动生成" disabled />
          </Form.Item>
          <Form.Item name="type" label="项目类型" rules={[{ required: true, message: '请选择项目类型' }]}>
            <Select
              disabled={createLoading}
              options={[
                { label: '研发项目', value: '研发项目' },
                { label: '品质项目', value: '品质项目' },
                { label: '品质问题跟踪', value: '品质问题跟踪' },
              ]}
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
            <Select
              disabled={createLoading}
              options={[
                { label: '紧急', value: 4 },
                { label: '重要', value: 3 },
                { label: '中等', value: 2 },
                { label: '较低', value: 1 },
              ]}
            />
          </Form.Item>
          <Form.Item name="overview" label="项目概述">
            <Input.TextArea rows={4} placeholder="输入项目的大概描述（可用于会议快速对齐背景）" disabled={createLoading} />
          </Form.Item>
          <Form.Item label="概述图片">
            <Upload
              multiple
              beforeUpload={(f) => {
                setCreateImages((prev) => [...prev, f])
                return false
              }}
              onRemove={(f) => {
                setCreateImages((prev) => prev.filter((x) => x.uid !== f.uid))
              }}
              fileList={uploadFileList}
            >
              <Button disabled={createLoading}>选择图片</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createLoading} block>
            创建
          </Button>
        </Form>
      </Modal>
    </AntLayout>
  )
}
