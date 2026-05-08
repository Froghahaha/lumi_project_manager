import { useMemo, useState } from 'react'
import { Alert, Button, Card, Descriptions, Input, List, Progress, Select, Space, Tabs, Tag, Typography, Upload, message } from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { Link, useLoaderData, useParams, useRevalidator } from 'react-router-dom'
import { addComment, updateIssue, uploadAttachment } from '../api'
import type { Attachment, AuditLog, Comment, Issue, IssueStatus } from '../types'

const STATUSES: IssueStatus[] = ['待处理', '处理中', '待验证', '已完成', '已归档']

export function IssuePage() {
  const { issueId } = useParams()
  const { issue, audit, comments, attachments } = useLoaderData() as {
    issue: Issue
    audit: AuditLog[]
    comments: Comment[]
    attachments: Attachment[]
  }
  const revalidator = useRevalidator()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [content, setContent] = useState('')
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

  const canComment = useMemo(() => content.trim().length > 0 && !!issueId, [content, issueId])

  async function onChangeStatus(next: IssueStatus) {
    if (!issueId) return
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

  async function onComment() {
    if (!issueId || !canComment) return
    setLoading(true)
    setError(null)
    try {
      await addComment(issueId, { content: content.trim() })
      setContent('')
      message.success('评论已发送')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    revalidator.revalidate()
    setLoading(false)
  }

  async function onUpload() {
    if (!issueId || !file) return
    setLoading(true)
    setError(null)
    try {
      await uploadAttachment(issueId, file)
      setFile(null)
      message.success('附件已上传')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    revalidator.revalidate()
    setLoading(false)
  }

  if (!issueId) return <div>缺少 issueId</div>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space align="baseline">
          <Link to={issue.project_id ? `/projects/${issue.project_id}` : '/'}>← 返回</Link>
          <Space direction="vertical" size={0}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {issue.title}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {issue.issue_key}
            </Typography.Text>
          </Space>
        </Space>
        {issue.is_delayed ? <Tag color="red">延期 {issue.delay_days} 天</Tag> : <Tag>未延期</Tag>}
      </Space>

      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      <Card>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="状态">
            <Select<IssueStatus>
              value={issue.status}
              style={{ width: 160 }}
              disabled={loading}
              options={STATUSES.map((s) => ({ label: s, value: s }))}
              onChange={(v) => void onChangeStatus(v)}
            />
          </Descriptions.Item>
          <Descriptions.Item label="处理人">{issue.assignee ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="进度">
            <Progress percent={issue.progress} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="计划完成">{issue.planned_end ? new Date(issue.planned_end).toLocaleString() : '-'}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>描述</Typography.Text>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{issue.description ?? ''}</div>
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: 'audit',
            label: `时间线（${audit.length}）`,
            children: (
              <Card>
                <List
                  dataSource={audit}
                  locale={{ emptyText: '暂无' }}
                  renderItem={(a) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space size={8} wrap>
                            <Typography.Text strong>{a.actor}</Typography.Text>
                            <Tag>{a.action}</Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(a.timestamp).toLocaleString()}
                            </Typography.Text>
                          </Space>
                        }
                        description={a.comment ? <div style={{ whiteSpace: 'pre-wrap' }}>{a.comment}</div> : null}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
          {
            key: 'comments',
            label: `评论（${comments.length}）`,
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card>
                  <List
                    dataSource={comments}
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

                <Card title="快速评论">
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    <Input.TextArea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
                    <Button type="primary" disabled={!canComment} loading={loading} onClick={() => void onComment()}>
                      发送
                    </Button>
                  </Space>
                </Card>
              </Space>
            ),
          },
          {
            key: 'attachments',
            label: `附件（${attachments.length}）`,
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card>
                  <List
                    dataSource={attachments}
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
                <Card title="上传附件">
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
                      <Button disabled={loading}>选择文件</Button>
                    </Upload>
                    <Button type="primary" disabled={!file} loading={loading} onClick={() => void onUpload()}>
                      上传
                    </Button>
                  </Space>
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </Space>
  )
}
