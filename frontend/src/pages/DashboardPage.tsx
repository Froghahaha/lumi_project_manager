import { Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import { useLoaderData, useNavigate } from 'react-router-dom'
import type { Project } from '../types'

function phaseOverdue(ph: Project['phases'][0]): boolean {
  if (!ph.planned_end_date) return false
  const end = ph.actual_end_date ? new Date(ph.actual_end_date) : new Date()
  return end > new Date(ph.planned_end_date)
}

function projectHasOverdue(p: Project): boolean {
  return p.phases.some(phaseOverdue)
}

export function DashboardPage() {
  const { projects } = useLoaderData() as { projects: Project[] }
  const navigate = useNavigate()

  const abnormal = projects.filter((p) => p.is_abnormal).length
  const overdue = projects.filter(projectHasOverdue).length
  const totalPhases = projects.reduce((sum, p) => sum + p.phases.length, 0)
  const overduePhases = projects.reduce(
    (sum, p) => sum + p.phases.filter(phaseOverdue).length,
    0,
  )

  const categories = new Map<string, number>()
  projects.forEach((p) => {
    const cat = p.equipment_category || '其他'
    categories.set(cat, (categories.get(cat) ?? 0) + 1)
  })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        仪表盘
      </Typography.Title>

      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="项目总数" value={projects.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="异常项目" value={abnormal} valueStyle={{ color: abnormal > 0 ? 'red' : undefined }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="含逾期工序" value={overdue} valueStyle={{ color: overdue > 0 ? 'orange' : undefined }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="逾期工序" value={overduePhases} suffix={`/ ${totalPhases}`} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="设备类型分布">
            <Space direction="vertical" size={4}>
              {[...categories.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, cnt]) => (
                  <Space key={cat} style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Tag>{cat}</Tag>
                    <span>{cnt} 个</span>
                  </Space>
                ))}
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="最近项目">
            <Table<Project>
              rowKey="id"
              dataSource={[...projects].slice(0, 8)}
              size="small"
              pagination={false}
              onRow={(record) => ({
                onClick: () => navigate(`/projects/${record.id}`),
                style: { cursor: 'pointer' },
              })}
              columns={[
                {
                  title: '项目',
                  dataIndex: 'order_no',
                  render: (v: string, p) => (
                    <Space direction="vertical" size={0}>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                      {p.end_customer && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          终端: {p.end_customer}
                        </Typography.Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: '设备',
                  render: (_, p) => (
                    <Tag>{p.equipment_category || '-'}</Tag>
                  ),
                },
                {
                  title: '状态',
                  render: (_, p) =>
                    p.is_abnormal ? <Tag color="red">异常</Tag> : <Tag color="green">正常</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
