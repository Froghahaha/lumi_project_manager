import { useMemo, useState } from 'react'
import { Alert, Card, Col, Row, Select, Space, Tag, Typography, message } from 'antd'
import { Link, useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import { updateIssue } from '../api'
import type { Issue, IssueStatus } from '../types'

const STATUSES: IssueStatus[] = ['待处理', '处理中', '待验证', '已完成', '已归档']

export function BoardPage() {
  const { projectId } = useParams()
  const data = useLoaderData() as { projectId: string; issues: Issue[] }
  const issues = data.issues
  const revalidator = useRevalidator()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<IssueStatus, Issue[]>()
    for (const s of STATUSES) map.set(s, [])
    for (const i of issues) {
      const arr = map.get(i.status) ?? []
      arr.push(i)
      map.set(i.status, arr)
    }
    return map
  }, [issues])

  async function move(issueId: string, next: IssueStatus) {
    setLoading(true)
    setError(null)
    try {
      await updateIssue(issueId, { status: next })
      message.success('状态已更新')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    revalidator.revalidate()
    setLoading(false)
  }

  if (!projectId) return <div>缺少 projectId</div>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Link to={`/projects/${projectId}`}>← 返回项目</Link>
          <Typography.Title level={3} style={{ margin: 0 }}>
            事项看板
          </Typography.Title>
        </Space>
        <Tag color="blue">共 {issues.length} 条</Tag>
      </Space>

      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <Row gutter={12} wrap={false} style={{ overflowX: 'auto', paddingBottom: 8 }}>
        {STATUSES.map((s) => (
          <Col key={s} flex="0 0 260px">
            <Card size="small" title={s} extra={<Tag>{grouped.get(s)?.length ?? 0}</Tag>} styles={{ body: { padding: 8 } }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {(grouped.get(s) ?? []).map((i) => (
                  <Card key={i.id} size="small" styles={{ body: { padding: 10 } }}>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Link to={`/issues/${i.id}`} style={{ fontWeight: 700 }}>
                        {i.title}
                      </Link>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {i.issue_key} · {i.assignee ?? '-'} · {i.progress}%
                      </Typography.Text>
                      <Select<IssueStatus>
                        size="small"
                        value={i.status}
                        disabled={loading}
                        style={{ width: '100%' }}
                        options={STATUSES.map((x) => ({ label: x, value: x }))}
                        onChange={(next) => void move(i.id, next)}
                      />
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
          </Col>
        ))}
      </Row>
    </Space>
  )
}
