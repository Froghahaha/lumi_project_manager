import { Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import { useLoaderData, useNavigate } from 'react-router-dom'
import { equipSummary } from '../utils/format'
import type { Project } from '../types'

export function DashboardPage() {
  const { projects } = useLoaderData() as { projects: Project[] }
  const navigate = useNavigate()

  const overdue = projects.filter((p) => (p.project_status || '正常') === '逾期').length
  const totalPhases = projects.reduce((sum, p) => sum + p.phases.length, 0)
  const overduePhases = projects.reduce(
    (sum, p) => sum + p.phases.filter((ph) => ph.phase_progress === '逾期').length,
    0,
  )

  const categories = new Map<string, number>()
  projects.forEach((p) => {
    const cat = equipSummary(p.equipment_list).category || '其他'
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
            <Statistic title="逾期项目" value={overdue} valueStyle={{ color: overdue > 0 ? 'red' : undefined }} />
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
                    <Tag>{equipSummary(p.equipment_list).category}</Tag>
                  ),
                },
                {
                  title: '状态',
                  render: (_, p) =>
                    (p.project_status || '正常') === '逾期' ? <Tag color="red">逾期</Tag> : (p.project_status || '正常') === '已完成' ? <Tag color="green">完成</Tag> : <Tag color="blue">正常</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
