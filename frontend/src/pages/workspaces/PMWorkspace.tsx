import { useEffect, useState } from 'react'
import { Card, Col, Empty, Progress, Row, Space, Tag, Typography } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import { fmtDate, phaseStatusTagProps } from '../../utils/format'
import type { Project, ProjectPhase } from '../../types'

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
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无指派给您的项目" />
      ) : (
        <ProjectFilterBar projects={projects}>
          {(filtered) => (
        <Row gutter={[16, 16]}>
          {filtered.map((p) => {
            const sortedPhases = [...p.phases].sort((a, b) => a.seq - b.seq)
            const projectStatus = p.project_status || '正常'
            const hasActiveRectify = sortedPhases.some((ph) => ph.is_rectify && !ph.actual_end_date)
            return (
              <Col key={p.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/projects/${p.id}`)}
                  style={hasActiveRectify ? { borderColor: '#faad14', borderWidth: 2 } : {}}
                  title={
                    <Space>
                      <Typography.Text strong>{p.order_no}</Typography.Text>
                      {p.end_customer && <Tag>{p.end_customer}</Tag>}
                    </Space>
                  }
                  extra={
                    <Space size={4}>
                      {hasActiveRectify && <Tag color="warning" icon={<ExclamationCircleOutlined />}>整改中</Tag>}
                      {projectStatus === '逾期' ? <Tag color="red">逾期</Tag> : projectStatus === '已完成' ? <Tag color="green">完成</Tag> : <Tag color="green">正常</Tag>}
                    </Space>
                  }
                >
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space size={4} wrap>
                      {sortedPhases.map((ph) => (
                        <Tag key={ph.id} color={phaseStatusTagProps(ph).color}>
                          {ph.phase_name}: {phaseStatusTagProps(ph).text}
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
        </ProjectFilterBar>
      )}
    </WorkspaceShell>
  )
}
