import { useEffect, useState } from 'react'
import { Alert, Card, Col, Empty, Progress, Row, Space, Spin, Tag, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import type { Project, ProjectPhase } from '../../types'

function fmtDate(d: string | null) {
  if (!d) return '-'
  return d.slice(0, 10)
}

function phasePercent(ph: ProjectPhase): number {
  if (!ph.status) return 0
  const map: Record<string, number> = {
    '未开始': 0, '设计中': 50, '图纸已下发': 100,
    '生产中': 50, '生产完成': 80, '已发货': 100,
    '安调中': 50, '安调完成': 100,
    '已验收': 100,
  }
  return map[ph.status] ?? 50
}

export function PMWorkspace() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const p = await listProjects({ assigned_person: auth.person?.name || '' || undefined, role_code: auth.role })
        setProjects(p)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setLoading(false)
    }
    load()
  }, [auth.person?.name || '', auth.role])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          工作台 - {auth.roleName}
        </Typography.Title>
        <Tag color="blue">{auth.person?.name || ''}</Tag>
      </Space>

      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : projects.length === 0 ? (
        <Empty description="暂无指派给您的项目" />
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map((p) => {
            const sortedPhases = [...p.phases].sort((a, b) => a.seq - b.seq)
            const hasOverdue = sortedPhases.some((ph) => ph.planned_end_date && !ph.actual_end_date && new Date() > new Date(ph.planned_end_date))
            return (
              <Col key={p.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/projects/${p.id}`)}
                  title={
                    <Space>
                      <Typography.Text strong>{p.order_no}</Typography.Text>
                      {p.end_customer && <Tag>{p.end_customer}</Tag>}
                    </Space>
                  }
                  extra={
                    <Space size={4}>
                      {p.is_abnormal ? <Tag color="red">异常</Tag> : null}
                      {hasOverdue ? <Tag color="orange">逾期</Tag> : <Tag color="green">正常</Tag>}
                    </Space>
                  }
                >
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space size={4} wrap>
                      {sortedPhases.map((ph) => (
                        <Tag key={ph.seq} color={ph.status && ph.status !== '未开始' ? 'blue' : 'default'}>
                          {ph.phase_name}{ph.sub_name ? `-${ph.sub_name}` : ''}: {ph.status || '-'}
                        </Tag>
                      ))}
                    </Space>
                    {p.contract_expected_delivery_date && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        交期: {fmtDate(p.contract_expected_delivery_date)}
                      </Typography.Text>
                    )}
                    <Progress
                      percent={Math.round(
                        sortedPhases.reduce((sum, ph) => sum + phasePercent(ph), 0) / Math.max(sortedPhases.length, 1)
                      )}
                      size="small"
                    />
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </Space>
  )
}
