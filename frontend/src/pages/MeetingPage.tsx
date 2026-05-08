import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, DatePicker, Descriptions, Image, Input, List, Modal, Progress, Select, Space, Tag, Typography, Upload, message } from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import { useLoaderData } from 'react-router-dom'
import { SubTaskBoard } from '../components/SubTaskBoard'
import { createProjectTimelineEvent, listIssues, listProjectTimelineEvents, listSubTasks, uploadTimelineEventAttachment } from '../api'
import type { Issue, Project, SubTask, TimelineEvent } from '../types'

const PROJECT_TYPES = ['研发项目', '品质项目', '品质问题跟踪'] as const

function projectDoneKey(projectId: string) {
  return `meeting_project_done:${projectId}`
}

function issueDiscussKey(projectId: string) {
  return `meeting_check:${projectId}`
}

function loadBool(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(key)
    return raw === '1'
  } catch {
    return false
  }
}

function saveBool(key: string, v: boolean) {
  try {
    sessionStorage.setItem(key, v ? '1' : '0')
  } catch {
    void 0
  }
}

function loadMap(key: string): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function saveMap(key: string, v: Record<string, boolean>) {
  try {
    sessionStorage.setItem(key, JSON.stringify(v))
  } catch {
    void 0
  }
}

function sortByUpdatedAtDesc(a: { updated_at: string }, b: { updated_at: string }) {
  return b.updated_at.localeCompare(a.updated_at)
}

function sortByOccurredAtDesc(a: TimelineEvent, b: TimelineEvent) {
  return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
}

export function MeetingPage() {
  const { projects } = useLoaderData() as { projects: Project[] }

  const [typeFilter, setTypeFilter] = useState<(typeof PROJECT_TYPES)[number] | '全部'>('全部')
  const [onlyNotDoneProject, setOnlyNotDoneProject] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [doneTick, setDoneTick] = useState(0)
  void doneTick

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [issues, setIssues] = useState<Issue[]>([])
  const [subtasks, setSubtasks] = useState<SubTask[]>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [discussedMap, setDiscussedMap] = useState<Record<string, boolean>>({})
  const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(null)

  const [eventOpen, setEventOpen] = useState(false)
  const [eventIssueId, setEventIssueId] = useState<string | null>(null)
  const [eventOccurredAt, setEventOccurredAt] = useState<string>(new Date().toISOString())
  const [eventDesc, setEventDesc] = useState('')
  const [eventRelated, setEventRelated] = useState<string[]>([])
  const [eventFiles, setEventFiles] = useState<RcFile[]>([])
  const eventUploadFileList: UploadFile[] = eventFiles.map((f) => ({
    uid: f.uid,
    name: f.name,
    size: f.size,
    type: f.type,
    originFileObj: f,
  }))

  const filteredProjects = (() => {
    const arr = projects.slice()
    arr.sort(sortByUpdatedAtDesc)
    return arr.filter((p) => {
      if (typeFilter !== '全部' && (p.type ?? '') !== typeFilter) return false
      if (!onlyNotDoneProject) return true
      return !loadBool(projectDoneKey(p.id))
    })
  })()

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId])

  const incompleteIssues = useMemo(() => {
    const base = issues.filter((i) => i.status !== '已完成' && i.status !== '已归档')
    const filtered = activeSubTaskId ? base.filter((i) => i.subtask_id === activeSubTaskId) : []
    return filtered.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [issues, activeSubTaskId])

  const meetingStats = useMemo(() => {
    const total = incompleteIssues.length
    const discussed = incompleteIssues.reduce((acc, i) => acc + (discussedMap[i.id] ? 1 : 0), 0)
    return { total, discussed, remaining: Math.max(0, total - discussed) }
  }, [incompleteIssues, discussedMap])

  const issueTimeline = useMemo(() => {
    if (!activeIssueId) return []
    return timelineEvents.filter((e) => e.issue_id === activeIssueId).slice().sort(sortByOccurredAtDesc)
  }, [timelineEvents, activeIssueId])

  const activeIssue = useMemo(() => issues.find((i) => i.id === activeIssueId) ?? null, [issues, activeIssueId])

  const issueAssignees = useMemo(() => {
    const set = new Set<string>()
    for (const i of issues) if (i.assignee) set.add(i.assignee)
    return Array.from(set).sort()
  }, [issues])

  async function loadProject(projectId: string) {
    setLoading(true)
    setError(null)
    try {
      const [subtasks, issues, events] = await Promise.all([
        listSubTasks(projectId),
        listIssues({ project_id: projectId }),
        listProjectTimelineEvents(projectId),
      ])
      setIssues(issues)
      setSubtasks(subtasks)
      setTimelineEvents(events)
      setSelectedProjectId(projectId)
      setActiveIssueId(null)
      setDiscussedMap(loadMap(issueDiscussKey(projectId)))
      setActiveSubTaskId(subtasks[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  function setProjectDone(v: boolean) {
    if (!selectedProjectId) return
    saveBool(projectDoneKey(selectedProjectId), v)
    setDoneTick((x) => x + 1)
  }

  async function createEvent() {
    if (!selectedProjectId) return
    if (!eventIssueId) return
    const desc = eventDesc.trim()
    if (!desc) return
    setLoading(true)
    setError(null)
    try {
      const created = await createProjectTimelineEvent(selectedProjectId, {
        issue_id: eventIssueId,
        occurred_at: eventOccurredAt,
        description: desc,
        related_person: eventRelated,
      })
      for (const f of eventFiles) await uploadTimelineEventAttachment(created.id, f)
      message.success('进展已记录')
      setEventOpen(false)
      setEventDesc('')
      setEventRelated([])
      setEventFiles([])
      const events = await listProjectTimelineEvents(selectedProjectId)
      setTimelineEvents(events)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          会议Check
        </Typography.Title>
        <Tag color="blue">项目 {projects.length}</Tag>
      </Space>

      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Card
          title="选择项目"
          extra={
            <Space size={10} wrap>
              <Select
                value={typeFilter}
                style={{ width: 160 }}
                options={[{ label: '全部类型', value: '全部' }, ...PROJECT_TYPES.map((t) => ({ label: t, value: t }))]}
                onChange={(v) => setTypeFilter(v)}
              />
              <Checkbox checked={onlyNotDoneProject} onChange={(e) => setOnlyNotDoneProject(e.target.checked)}>
                隐藏已对齐
              </Checkbox>
            </Space>
          }
        >
          <List
            dataSource={filteredProjects}
            locale={{ emptyText: '暂无' }}
            renderItem={(p) => (
              <List.Item
                onClick={() => void loadProject(p.id)}
                style={{
                  cursor: 'pointer',
                  background: p.id === selectedProjectId ? 'rgba(22,119,255,0.08)' : undefined,
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text strong>{p.name}</Typography.Text>
                    {loadBool(projectDoneKey(p.id)) ? <Tag color="green">已对齐</Tag> : <Tag>未对齐</Tag>}
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {p.code ?? '-'} · {p.type ?? '-'} · {p.status} · P{p.priority}
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>

        <Card
          title="项目透视"
          extra={
            selectedProjectId ? (
              <Space size={10} wrap>
                <Checkbox checked={loadBool(projectDoneKey(selectedProjectId))} onChange={(e) => setProjectDone(e.target.checked)}>
                  标记项目已对齐
                </Checkbox>
                <Tag color="blue">未讨论 {meetingStats.remaining}</Tag>
                <Tag color="green">已讨论 {meetingStats.discussed}</Tag>
              </Space>
            ) : (
              <Tag>未选择</Tag>
            )
          }
        >
          {selectedProject ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="项目">{selectedProject.name}</Descriptions.Item>
                <Descriptions.Item label="编号">{selectedProject.code ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="类型">{selectedProject.type ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selectedProject.status === '进行中' ? 'blue' : selectedProject.status === '已完成' ? 'green' : 'default'}>
                    {selectedProject.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="优先级">P{selectedProject.priority}</Descriptions.Item>
                <Descriptions.Item label="目标日期">{selectedProject.target_date ?? '-'}</Descriptions.Item>
              </Descriptions>

              <SubTaskBoard
                subtasks={subtasks}
                issues={issues}
                activeSubTaskId={activeSubTaskId}
                onActiveSubTaskIdChange={(id) => {
                  setActiveSubTaskId(id)
                  setActiveIssueId(null)
                }}
                onIssueClick={(issueId) => setActiveIssueId(issueId)}
                issueExtra={(i) => (
                  <Checkbox
                    checked={!!discussedMap[i.id]}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      if (!selectedProjectId) return
                      const key = issueDiscussKey(selectedProjectId)
                      const next = { ...discussedMap, [i.id]: e.target.checked }
                      saveMap(key, next)
                      setDiscussedMap(next)
                    }}
                  />
                )}
              />

              <Card
                size="small"
                title={activeIssueId ? `事项详情 · ${activeIssue?.issue_key ?? ''}` : '事项详情'}
                extra={
                  activeIssueId ? (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        setEventIssueId(activeIssueId)
                        setEventOccurredAt(new Date().toISOString())
                        setEventDesc('')
                        setEventRelated([])
                        setEventFiles([])
                        setEventOpen(true)
                      }}
                    >
                      记录进展
                    </Button>
                  ) : null
                }
              >
                {activeIssueId ? (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <div>
                      <Typography.Text strong>{activeIssue?.title ?? ''}</Typography.Text>
                    </div>
                    <Progress percent={activeIssue?.progress ?? 0} size="small" />

                    <Card size="small" title={`进展（${issueTimeline.length}）`}>
                      <List
                        dataSource={issueTimeline}
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
                                            <Image key={a.id} width={140} src={a.url} />
                                          ) : (a.content_type ?? '').startsWith('video/') ? (
                                            <video key={a.id} controls style={{ width: 220 }}>
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
                  </Space>
                ) : (
                  <Typography.Text type="secondary">点击事项开始对齐</Typography.Text>
                )}
              </Card>
            </Space>
          ) : (
            <Typography.Text type="secondary">从上方选择一个项目开始</Typography.Text>
          )}
        </Card>
      </Space>

      <Modal
        title="记录进展"
        open={eventOpen}
        onCancel={() => setEventOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <DatePicker
            showTime
            locale={zhCNDatePicker}
            style={{ width: '100%' }}
            onChange={(v) => setEventOccurredAt(v?.toDate ? v.toDate().toISOString() : new Date().toISOString())}
          />
          <Select
            placeholder="选择关联事项"
            value={eventIssueId ?? undefined}
            options={issues.map((i) => ({ label: `${i.issue_key} · ${i.title}`, value: i.id }))}
            onChange={(v) => setEventIssueId(v)}
          />
          <Select
            mode="tags"
            placeholder="相关人"
            value={eventRelated}
            options={issueAssignees.map((a) => ({ value: a, label: a }))}
            onChange={(v) => setEventRelated(v)}
          />
          <Input.TextArea rows={5} placeholder="事件描述" value={eventDesc} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEventDesc(e.target.value)} />
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
            <Button disabled={loading}>选择附件</Button>
          </Upload>
          <Button type="primary" disabled={!eventIssueId || !eventDesc.trim()} loading={loading} onClick={() => void createEvent()}>
            保存
          </Button>
        </Space>
      </Modal>
    </Space>
  )
}
