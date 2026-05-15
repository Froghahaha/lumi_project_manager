import { useEffect, useState } from 'react'
import { Alert, Card, Col, Empty, Row, Space, Spin, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import type { Project } from '../../types'

function fmtDate(d: string | null) {
  if (!d) return '-'
  return d.slice(0, 10)
}

export function SoftwareWorkspace() {
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
            // 软件设计横跨机械设计→调机，只看 seq 1-3
            const crossPhases = p.phases.filter((ph) => [1, 2, 3].includes(ph.seq)).sort((a, b) => a.seq - b.seq)
            return (
              <Col key={p.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/projects/${p.id}`)}
                  title={<Typography.Text strong>{p.order_no}</Typography.Text>}
                  extra={p.is_abnormal ? <Tag color="red">异常</Tag> : null}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space size={4} wrap>
                      {crossPhases.map((ph) => (
                        <Tag key={ph.seq} color={ph.status && ph.status !== '未开始' ? 'blue' : 'default'}>
                          {ph.phase_name}{ph.sub_name ? `-${ph.sub_name}` : ''}: {ph.status || '-'}
                        </Tag>
                      ))}
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      合同: {fmtDate(p.contract_start_date)} → {fmtDate(p.contract_expected_delivery_date)} ({p.contract_duration_days ?? '-'}天)
                    </Typography.Text>
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
