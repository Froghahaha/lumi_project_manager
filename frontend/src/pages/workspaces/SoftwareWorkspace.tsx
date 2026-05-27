import { useEffect, useState } from 'react'
import { Card, Col, Empty, Row, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import { fmtDate, phaseStatusTagProps } from '../../utils/format'
import type { Project } from '../../types'

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
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无指派给您的项目" />
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map((p) => {
            const relevantSeqs = auth.hasPermission('cross_phase_view') ? [1, 2, 3] : []
            const crossPhases = p.phases.filter((ph) => relevantSeqs.includes(ph.seq)).sort((a, b) => a.seq - b.seq)
            return (
              <Col key={p.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/projects/${p.id}`)}
                  title={<Typography.Text strong>{p.order_no}</Typography.Text>}
                  extra={(p.project_status || '正常') === '逾期' ? <Tag color="red">逾期</Tag> : null}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space size={4} wrap>
                      {crossPhases.map((ph) => (
                        <Tag key={ph.id} color={phaseStatusTagProps(ph).color}>
                          {ph.phase_name}: {phaseStatusTagProps(ph).text}
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
    </WorkspaceShell>
  )
}
