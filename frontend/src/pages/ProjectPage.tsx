import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Image,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Row,
  Col,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import { Link, useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import { SubTaskBoard } from '../components/SubTaskBoard'
import {
  addComment,
  createSubTask,
  createIssue,
  createProjectTimelineEvent,
  getIssue,
  listAttachments,
  listComments,
  updateProject,
  updateIssue,
  uploadAttachment,
  uploadTimelineEventAttachment,
} from '../api'
import type { Attachment, Comment, Issue, IssueStatus, Project, ProjectStatus, SubTask, TimelineEvent } from '../types'

const STATUSES: IssueStatus[] = ['待处理', '处理中', '待验证', '已完成', '已归档']
const PROJECT_STATUSES: ProjectStatus[] = ['规划中', '进行中', '已完成', '已暂停']
const PROJECT_TYPES = ['研发项目', '品质项目', '品质问题跟踪'] as const
const PROJECT_PRIORITY_OPTIONS = [
  { label: '紧急', value: 4 },
  { label: '重要', value: 3 },
  { label: '中等', value: 2 },
  { label: '较低', value: 1 },
] as const

function projectPriorityLabel(v: number): string {
  return PROJECT_PRIORITY_OPTIONS.find((x) => x.value === v)?.label ?? `P${v}`
}

export function ProjectPage() {
  const { projectId } = useParams()
  const { project, subtasks, issues, timelineEvents } = useLoaderData() as {
    project: Project
    subtasks: SubTask[]
    issues: Issue[]
    timelineEvents: TimelineEvent[]
  }
  const revalidator = useRevalidator()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm<{
    title: string
    description?: string
    assignee?: string
    planned_end?: unknown
    subtask_id?: string | null
  }>()
  const [subtaskCreateOpen, setSubtaskCreateOpen] = useState(false)
  const [subtaskForm] = Form.useForm<{ name: string; priority: number; description?: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState(() => ({
    name: project.name,
    type: project.type ?? PROJECT_TYPES[0],
    status: project.status,
    priority: project.priority,
    start_date: project.start_date ?? '',
    target_date: project.target_date ?? '',
    overview: project.overview ?? '',
  }))

  const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(() => subtasks[0]?.id ?? null)

  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null)
  const [activeComments, setActiveComments] = useState<Comment[]>([])
  const [activeAttachments, setActiveAttachments] = useState<Attachment[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)

  const [commentContent, setCommentContent] = useState('')
  const [file, setFile] = useState<RcFile | null>(null)
  const uploadFileList: UploadFile[] = file
    ? [
        {
          uid: file.uid,
          name: file.name,
          size: file.size,
          type: file.type,
          originFileObj: file,
        },
      ]
    : []

  const [eventOpen, setEventOpen] = useState(false)
  const [eventForm] = Form.useForm<{
    issue_id?: string
    occurred_at?: unknown
    description?: string
    related_person?: string[]
  }>()
  const [eventFiles, setEventFiles] = useState<RcFile[]>([])
  const eventUploadFileList: UploadFile[] = eventFiles.map((f) => ({
    uid: f.uid,
    name: f.name,
    size: f.size,
    type: f.type,
    originFileObj: f,
  }))

  const assignees = useMemo(() => {
    const set = new Set<string>()
    for (const i of issues) if (i.assignee) set.add(i.assignee)
    return Array.from(set).sort()
  }, [issues])

  const counts = useMemo(() => {
    const total = issues.length
    const done = issues.filter((i) => i.status === '已完成' || i.status === '已归档').length
    const delayed = issues.filter((i) => i.is_delayed).length
    return { total, done, delayed, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [issues])

  function openIssue(issueId: string) {
    setActiveIssueId(issueId)
    void refreshActiveIssue(issueId)
  }

  async function refreshActiveIssue(issueId: string) {
    setDrawerLoading(true)
    setDrawerError(null)
    try {
      const [issue, comments, attachments] = await Promise.all([getIssue(issueId), listComments(issueId), listAttachments(issueId)])
      setActiveIssue(issue)
      setActiveComments(comments)
      setActiveAttachments(attachments)
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    }
    setDrawerLoading(false)
  }

  const issueTimelineEvents = useMemo(() => {
    if (!activeIssueId) return []
    return timelineEvents
      .filter((e) => e.issue_id === activeIssueId)
      .slice()
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  }, [timelineEvents, activeIssueId])

  async function onCreateIssue(values: {
    title: string
    description?: string
    assignee?: string
    planned_end?: unknown
    subtask_id?: string | null
  }) {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const pe = values.planned_end as { toDate?: () => Date } | null | undefined
      await createIssue({
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        project_id: projectId,
        subtask_id: values.subtask_id || undefined,
        assignee: values.assignee?.trim() || undefined,
        planned_end: pe?.toDate ? pe.toDate().toISOString() : undefined,
      })
      createForm.resetFields()
      message.success('事项已创建')
      setCreateOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    revalidator.revalidate()
    setLoading(false)
  }

  async function onCreateSubTask(values: { name: string; priority: number; description?: string }) {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      await createSubTask(projectId, {
        name: values.name.trim(),
        priority: values.priority,
        description: values.description?.trim() || undefined,
      })
      message.success('子任务已创建')
      setSubtaskCreateOpen(false)
      subtaskForm.resetFields()
      revalidator.revalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  async function onChangeStatus(next: IssueStatus) {
    if (!activeIssueId) return
    setDrawerLoading(true)
    setDrawerError(null)
    try {
      await updateIssue(activeIssueId, { status: next })
      message.success('状态已更新')
      await refreshActiveIssue(activeIssueId)
      revalidator.revalidate()
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    }
    setDrawerLoading(false)
  }

  async function onSendComment() {
    if (!activeIssueId) return
    const text = commentContent.trim()
    if (!text) return
    setDrawerLoading(true)
    setDrawerError(null)
    try {
      await addComment(activeIssueId, { content: text })
      setCommentContent('')
      message.success('评论已发送')
      await refreshActiveIssue(activeIssueId)
      revalidator.revalidate()
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    }
    setDrawerLoading(false)
  }

  async function onUpload() {
    if (!activeIssueId || !file) return
    setDrawerLoading(true)
    setDrawerError(null)
    try {
      await uploadAttachment(activeIssueId, file)
      setFile(null)
      message.success('附件已上传')
      await refreshActiveIssue(activeIssueId)
      revalidator.revalidate()
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    }
    setDrawerLoading(false)
  }

  async function onCreateEvent() {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const values = await eventForm.validateFields()
      const occurred = values.occurred_at as { toDate?: () => Date } | undefined
      const occurredAt = occurred?.toDate ? occurred.toDate().toISOString() : null
      if (!occurredAt) throw new Error('请选择发生时间')
      const description = String(values.description ?? '').trim()
      if (!description) throw new Error('请输入事件描述')

      const created = await createProjectTimelineEvent(projectId, {
        issue_id: values.issue_id || undefined,
        occurred_at: occurredAt,
        description,
        related_person: values.related_person ?? [],
      })
      for (const f of eventFiles) {
        await uploadTimelineEventAttachment(created.id, f)
      }
      message.success('进展已记录')
      eventForm.resetFields()
      setEventFiles([])
      setEventOpen(false)
      revalidator.revalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  async function onUpdateProject() {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const patch: Partial<Project> = {}
      if (draft.name.trim() !== project.name) patch.name = draft.name.trim()
      if ((draft.type || null) !== (project.type ?? null)) patch.type = draft.type || null
      if (draft.status !== project.status) patch.status = draft.status
      if (draft.priority !== project.priority) patch.priority = draft.priority
      if ((draft.start_date || null) !== (project.start_date ?? null)) patch.start_date = draft.start_date || null
      if ((draft.target_date || null) !== (project.target_date ?? null)) patch.target_date = draft.target_date || null
      if ((draft.overview || null) !== (project.overview ?? null)) patch.overview = draft.overview || null
      if (Object.keys(patch).length === 0) {
        message.info('没有变更')
        setLoading(false)
        return
      }

      await updateProject(projectId, patch)
      message.success('项目已更新')
      revalidator.revalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  if (!projectId) return <div>缺少 projectId</div>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space direction="vertical" size={6} style={{ minWidth: 0 }}>
              <Space size={10} wrap>
                <Link to="/">← 返回</Link>
                <Typography.Title
                  level={3}
                  style={{ margin: 0 }}
                  editable={{
                    onChange: (v) => setDraft((p) => ({ ...p, name: v })),
                  }}
                >
                  {draft.name}
                </Typography.Title>
                <Tag color="blue">{draft.status}</Tag>
                <Tag color={draft.priority >= 4 ? 'red' : draft.priority >= 3 ? 'orange' : 'green'}>
                  {projectPriorityLabel(draft.priority)}
                </Tag>
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {project.code ?? '-'} · {draft.type}
              </Typography.Text>
            </Space>

            <Space size={8} wrap>
              <Button type="primary" loading={loading} onClick={() => void onUpdateProject()}>
                保存
              </Button>
            </Space>
          </Space>

          <Card size="small" styles={{ body: { padding: 12 } }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} lg={8}>
                <Space size={10} wrap>
                  <Typography.Text type="secondary">类型</Typography.Text>
                  <Select
                    value={draft.type}
                    style={{ width: 180 }}
                    options={PROJECT_TYPES.map((t) => ({ label: t, value: t }))}
                    onChange={(v) => setDraft((p) => ({ ...p, type: v }))}
                  />
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space size={10} wrap>
                  <Typography.Text type="secondary">状态</Typography.Text>
                  <Select
                    value={draft.status}
                    style={{ width: 180 }}
                    options={PROJECT_STATUSES.map((s) => ({ label: s, value: s }))}
                    onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
                  />
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space size={10} wrap>
                  <Typography.Text type="secondary">优先级</Typography.Text>
                  <Select
                    value={draft.priority}
                    style={{ width: 180 }}
                    options={[...PROJECT_PRIORITY_OPTIONS]}
                    onChange={(v) => setDraft((p) => ({ ...p, priority: v }))}
                  />
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space size={10} wrap>
                  <Typography.Text type="secondary">开始日期</Typography.Text>
                  <DatePicker
                    allowClear
                    value={draft.start_date ? dayjs(draft.start_date) : null}
                    style={{ width: 180 }}
                    locale={zhCNDatePicker}
                    format="YYYY-MM-DD"
                    onChange={(_, s) => setDraft((p) => ({ ...p, start_date: typeof s === 'string' ? s : '' }))}
                  />
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space size={10} wrap>
                  <Typography.Text type="secondary">目标日期</Typography.Text>
                  <DatePicker
                    allowClear
                    value={draft.target_date ? dayjs(draft.target_date) : null}
                    style={{ width: 180 }}
                    locale={zhCNDatePicker}
                    format="YYYY-MM-DD"
                    onChange={(_, s) => setDraft((p) => ({ ...p, target_date: typeof s === 'string' ? s : '' }))}
                  />
                </Space>
              </Col>
              <Col xs={24} lg={8}>
                <Space size={10} wrap>
                  <Typography.Text type="secondary">进度</Typography.Text>
                  <Progress percent={counts.percent} style={{ width: 220 }} />
                </Space>
              </Col>
            </Row>
          </Card>
        </Space>

        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
          <Col xs={24} lg={14}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="开始日期">{draft.start_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="目标日期">{draft.target_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(project.created_at).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{new Date(project.updated_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Space size={10} wrap>
                  <Tag color="blue">事项 {counts.total}</Tag>
                  <Tag color="green">完成 {counts.done}</Tag>
                  {counts.delayed > 0 ? <Tag color="red">延期 {counts.delayed}</Tag> : <Tag>无延期</Tag>}
                </Space>
                <Progress percent={counts.percent} />
              </Space>
            </Card>
          </Col>
          <Col span={24}>
            <Card size="small" title="概述" styles={{ body: { padding: 12 } }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Input.TextArea
                  rows={4}
                  value={draft.overview}
                  onChange={(e) => setDraft((p) => ({ ...p, overview: e.target.value }))}
                  placeholder="输入项目概述"
                />
                {project.overview_images.length > 0 ? (
                  <Image.PreviewGroup>
                    <Space wrap>
                      {project.overview_images.map((img) => (
                        <Image key={img.id} width={140} src={img.url} />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                ) : null}
              </Space>
            </Card>
          </Col>
        </Row>

      </Card>

      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <SubTaskBoard
        subtasks={subtasks}
        issues={issues}
        activeSubTaskId={activeSubTaskId}
        onActiveSubTaskIdChange={(id) => {
          setActiveSubTaskId(id)
          setActiveIssueId(null)
        }}
        onIssueClick={(issueId) => openIssue(issueId)}
        subtaskListExtra={
          <Button
            onClick={() => {
              subtaskForm.setFieldsValue({ name: '', priority: 3, description: '' })
              setSubtaskCreateOpen(true)
            }}
          >
            新建子任务
          </Button>
        }
        boardExtra={
          <Space size={10} wrap>
            <Select
              value={activeSubTaskId ?? undefined}
              style={{ width: 240 }}
              options={subtasks.map((s) => ({ label: `子任务：${s.name}`, value: s.id }))}
              onChange={(v) => {
                setActiveSubTaskId(v)
                setActiveIssueId(null)
              }}
            />
            <Button
              type="primary"
              disabled={!activeSubTaskId}
              onClick={() => {
                createForm.setFieldsValue({ subtask_id: activeSubTaskId })
                setCreateOpen(true)
              }}
            >
              新建事项
            </Button>
          </Space>
        }
      />

      <Modal
        title="新建事项"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={(values) => void onCreateIssue(values)}>
          <Form.Item
            name="subtask_id"
            label={
              <Space size={8}>
                <span>子任务</span>
                <Button
                  type="link"
                  style={{ padding: 0, height: 'auto' }}
                  onClick={() => {
                    subtaskForm.setFieldsValue({ name: '', priority: 3, description: '' })
                    setSubtaskCreateOpen(true)
                  }}
                >
                  新建
                </Button>
              </Space>
            }
            rules={[{ required: true, message: '请选择子任务' }]}
          >
            <Select
              placeholder="请选择子任务"
              options={subtasks.map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入事项标题' }]}>
            <Input placeholder="例如：2D视觉抓取稳定性提升" />
          </Form.Item>
          <Form.Item name="assignee" label="处理人">
            <Input placeholder="例如：张三" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="补充背景/约束/验收标准等" />
          </Form.Item>
          <Form.Item name="planned_end" label="预期完成日期">
            <DatePicker locale={zhCNDatePicker} format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            创建
          </Button>
        </Form>
      </Modal>

      <Modal title="新建子任务" open={subtaskCreateOpen} onCancel={() => setSubtaskCreateOpen(false)} footer={null} destroyOnClose>
        <Form form={subtaskForm} layout="vertical" onFinish={(values) => void onCreateSubTask(values)} initialValues={{ priority: 3 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入子任务名称' }]}>
            <Input placeholder="例如：现场验收问题闭环" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请输入优先级' }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            创建
          </Button>
        </Form>
      </Modal>

      <Modal
        title="记录进展"
        open={eventOpen}
        onCancel={() => setEventOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={eventForm} layout="vertical" onFinish={() => void onCreateEvent()}>
          <Form.Item name="occurred_at" label="发生时间" rules={[{ required: true, message: '请选择发生时间' }]}>
            <DatePicker showTime locale={zhCNDatePicker} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="issue_id" label="关联事项（可选）">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={issues.map((i) => ({ value: i.id, label: `${i.issue_key} · ${i.title}` }))}
            />
          </Form.Item>
          <Form.Item name="related_person" label="相关人">
            <Select mode="tags" placeholder="输入姓名回车" options={assignees.map((a) => ({ value: a, label: a }))} />
          </Form.Item>
          <Form.Item name="description" label="事件描述" rules={[{ required: true, message: '请输入事件描述' }]}>
            <Input.TextArea rows={5} placeholder="描述事件进展（支持会议纪要式输入）" />
          </Form.Item>
          <Form.Item label="附件（图片/视频）">
            <Upload
              multiple
              beforeUpload={(f) => {
                setEventFiles((prev) => [...prev, f])
                return false
              }}
              onRemove={(f) => {
                setEventFiles((prev) => prev.filter((x) => x.uid !== f.uid))
              }}
              fileList={eventUploadFileList}
            >
              <Button disabled={loading}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            保存
          </Button>
        </Form>
      </Modal>

      {activeIssueId ? (
        <Card
          title={
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{activeIssue?.title ?? '事项详情'}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {activeIssue?.issue_key ?? ''}
              </Typography.Text>
            </Space>
          }
          extra={
            <Space size={8}>
              <Button
                onClick={() => {
                  setActiveIssueId(null)
                  setActiveIssue(null)
                  setActiveComments([])
                  setActiveAttachments([])
                  setDrawerError(null)
                  setCommentContent('')
                  setFile(null)
                }}
              >
                收起
              </Button>
            </Space>
          }
        >
          {drawerError ? <Alert type="error" showIcon message="请求失败" description={drawerError} style={{ marginBottom: 12 }} /> : null}

          <Card size="small" styles={{ body: { padding: 12 } }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="状态">
                <Select<IssueStatus>
                  value={activeIssue?.status}
                  style={{ width: 160 }}
                  disabled={!activeIssueId || drawerLoading}
                  options={STATUSES.map((s) => ({ label: s, value: s }))}
                  onChange={(v) => void onChangeStatus(v)}
                />
              </Descriptions.Item>
              <Descriptions.Item label="处理人">{activeIssue?.assignee ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="进度">
                <Progress percent={activeIssue?.progress ?? 0} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label="计划完成">
                {activeIssue?.planned_end ? new Date(activeIssue.planned_end).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 10 }}>
              <Typography.Text strong>描述</Typography.Text>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{activeIssue?.description ?? ''}</div>
            </div>
          </Card>

          <div style={{ marginTop: 12 }}>
            <Tabs
              items={[
                {
                  key: 'timeline',
                  label: `进展（${issueTimelineEvents.length}）`,
                  children: (
                    <Card
                      size="small"
                      extra={
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => {
                            eventForm.resetFields()
                            eventForm.setFieldValue('issue_id', activeIssueId)
                            setEventFiles([])
                            setEventOpen(true)
                          }}
                        >
                          新增进展
                        </Button>
                      }
                    >
                      <List
                        dataSource={issueTimelineEvents}
                        locale={{ emptyText: '暂无' }}
                        renderItem={(e) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space size={8} wrap>
                                  <Typography.Text strong>{e.actor}</Typography.Text>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    {new Date(e.occurred_at).toLocaleString()}
                                  </Typography.Text>
                                  {e.related_person.map((p) => (
                                    <Tag key={p}>{p}</Tag>
                                  ))}
                                </Space>
                              }
                              description={
                                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{e.description}</div>
                                  {e.attachments.length > 0 ? (
                                    <Image.PreviewGroup>
                                      <Space wrap>
                                        {e.attachments.map((a) =>
                                          (a.content_type ?? '').startsWith('image/') ? (
                                            <Image key={a.id} width={160} src={a.url} />
                                          ) : (a.content_type ?? '').startsWith('video/') ? (
                                            <video key={a.id} controls style={{ width: 260 }}>
                                              <source src={a.url} type={a.content_type ?? undefined} />
                                            </video>
                                          ) : (
                                            <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                                              {a.filename}
                                            </a>
                                          ),
                                        )}
                                      </Space>
                                    </Image.PreviewGroup>
                                  ) : null}
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'comments',
                  label: `评论（${activeComments.length}）`,
                  children: (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Card size="small">
                        <List
                          dataSource={activeComments}
                          locale={{ emptyText: '暂无' }}
                          renderItem={(c) => (
                            <List.Item>
                              <List.Item.Meta
                                title={
                                  <Space size={8} wrap>
                                    <Typography.Text strong>{c.actor}</Typography.Text>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                      {new Date(c.created_at).toLocaleString()}
                                    </Typography.Text>
                                  </Space>
                                }
                                description={<div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>}
                              />
                            </List.Item>
                          )}
                        />
                      </Card>
                      <Card size="small" title="快速评论">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <Input.TextArea
                            rows={4}
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            disabled={!activeIssueId || drawerLoading}
                          />
                          <Button
                            type="primary"
                            disabled={!activeIssueId || drawerLoading || commentContent.trim().length === 0}
                            loading={drawerLoading}
                            onClick={() => void onSendComment()}
                          >
                            发送
                          </Button>
                        </Space>
                      </Card>
                    </Space>
                  ),
                },
                {
                  key: 'attachments',
                  label: `附件（${activeAttachments.length}）`,
                  children: (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Card size="small">
                        <List
                          dataSource={activeAttachments}
                          locale={{ emptyText: '暂无' }}
                          renderItem={(a) => (
                            <List.Item>
                              <a href={a.url} target="_blank" rel="noreferrer">
                                {a.filename}
                              </a>
                              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                                {Math.round(a.size / 1024)} KB
                              </Typography.Text>
                            </List.Item>
                          )}
                        />
                      </Card>
                      <Card size="small" title="上传附件">
                        <Space size={10} wrap>
                          <Upload
                            maxCount={1}
                            beforeUpload={(f) => {
                              setFile(f)
                              return false
                            }}
                            onRemove={() => {
                              setFile(null)
                            }}
                            fileList={uploadFileList}
                          >
                            <Button disabled={drawerLoading || !activeIssueId}>选择文件</Button>
                          </Upload>
                          <Button type="primary" disabled={!activeIssueId || !file} loading={drawerLoading} onClick={() => void onUpload()}>
                            上传
                          </Button>
                        </Space>
                      </Card>
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      ) : null}
    </Space>
  )
}
