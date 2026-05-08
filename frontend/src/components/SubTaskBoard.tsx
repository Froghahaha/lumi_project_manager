import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Card, Progress, Space, Tag, Typography } from 'antd'
import type { Issue, IssueStatus, SubTask } from '../types'

const STATUSES: IssueStatus[] = ['待处理', '处理中', '待验证', '已完成', '已归档']

export function SubTaskBoard(props: {
  subtasks: SubTask[]
  issues: Issue[]
  activeSubTaskId: string | null
  onActiveSubTaskIdChange: (id: string) => void
  onIssueClick: (issueId: string) => void
  subtaskListExtra?: ReactNode
  boardExtra?: ReactNode
  issueExtra?: (issue: Issue) => ReactNode
}) {
  const { subtasks, issues, activeSubTaskId } = props

  const subtaskStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number; delayed: number }>()
    for (const s of subtasks) map.set(s.id, { total: 0, done: 0, delayed: 0 })
    for (const i of issues) {
      if (!i.subtask_id) continue
      const stat = map.get(i.subtask_id)
      if (!stat) continue
      stat.total += 1
      if (i.status === '已完成' || i.status === '已归档') stat.done += 1
      if (i.is_delayed) stat.delayed += 1
    }
    return map
  }, [subtasks, issues])

  const activeSubTask = useMemo(() => subtasks.find((s) => s.id === activeSubTaskId) ?? null, [subtasks, activeSubTaskId])

  const grouped = useMemo(() => {
    const map = new Map<IssueStatus, Issue[]>()
    for (const s of STATUSES) map.set(s, [])
    const source = activeSubTaskId ? issues.filter((i) => i.subtask_id === activeSubTaskId) : []
    for (const i of source) {
      const arr = map.get(i.status) ?? []
      arr.push(i)
      map.set(i.status, arr)
    }
    return map
  }, [issues, activeSubTaskId])

  const boardTotal = useMemo(() => {
    let n = 0
    for (const s of STATUSES) n += grouped.get(s)?.length ?? 0
    return n
  }, [grouped])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="子任务" extra={props.subtaskListExtra}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {subtasks.map((s) => {
            const stat = subtaskStats.get(s.id) ?? { total: 0, done: 0, delayed: 0 }
            const pct = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0
            const active = s.id === activeSubTaskId
            return (
              <Card
                key={s.id}
                size="small"
                hoverable
                onClick={() => props.onActiveSubTaskIdChange(s.id)}
                style={{ borderColor: active ? '#1677ff' : undefined }}
              >
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text strong>{s.name}</Typography.Text>
                    <Space size={8} wrap>
                      <Tag>事项 {stat.total}</Tag>
                      <Tag color="green">完成 {stat.done}</Tag>
                      {stat.delayed > 0 ? <Tag color="red">延期 {stat.delayed}</Tag> : <Tag>无延期</Tag>}
                    </Space>
                  </Space>
                  <Progress percent={pct} size="small" />
                </Space>
              </Card>
            )
          })}
          {subtasks.length === 0 ? <Typography.Text type="secondary">暂无子任务</Typography.Text> : null}
        </Space>
      </Card>

      <Card title={activeSubTask ? `子任务：${activeSubTask.name} · 看板（${boardTotal}）` : '请选择子任务'} extra={props.boardExtra}>
        {activeSubTaskId ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {STATUSES.map((s) => (
              <Card key={s} size="small" title={s} extra={<Tag>{grouped.get(s)?.length ?? 0}</Tag>} styles={{ body: { padding: 8 } }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {(grouped.get(s) ?? []).map((i) => (
                    <Card key={i.id} size="small" hoverable onClick={() => props.onIssueClick(i.id)} styles={{ body: { padding: 10 } }}>
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text strong style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {i.title}
                          </Typography.Text>
                          <Space size={8}>
                            {props.issueExtra ? props.issueExtra(i) : null}
                            {i.is_delayed ? <Tag color="red">{i.delay_days}天</Tag> : null}
                          </Space>
                        </Space>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {i.issue_key} · {i.assignee ?? '-'} · {i.progress}%
                        </Typography.Text>
                      </Space>
                    </Card>
                  ))}
                  {(grouped.get(s) ?? []).length === 0 ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      空
                    </Typography.Text>
                  ) : null}
                </Space>
              </Card>
            ))}
          </div>
        ) : (
          <Typography.Text type="secondary">先选择一个子任务</Typography.Text>
        )}
      </Card>
    </Space>
  )
}

