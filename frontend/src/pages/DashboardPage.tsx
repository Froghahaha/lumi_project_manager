import { useMemo, useState } from 'react'
import { Card, Col, Row, Space, Statistic, Table, Tag, Typography, theme } from 'antd'
import { useLoaderData, useNavigate } from 'react-router-dom'
import type { Project } from '../types'

type ProjectTypeGroup = '研发项目' | '品质项目' | '品质问题跟踪' | '其他'

const PROJECT_PRIORITY_OPTIONS = [
  { label: '紧急', value: 4 },
  { label: '重要', value: 3 },
  { label: '中等', value: 2 },
  { label: '较低', value: 1 },
] as const

function projectPriorityLabel(v: number): string {
  return PROJECT_PRIORITY_OPTIONS.find((x) => x.value === v)?.label ?? String(v)
}

function projectTypeGroup(p: Project): ProjectTypeGroup {
  const t = (p.type ?? '').trim()
  if (t === '研发项目') return '研发项目'
  if (t === '品质项目') return '品质项目'
  if (t === '品质问题跟踪') return '品质问题跟踪'
  return '其他'
}

function isOverdue(p: Project): boolean {
  if (!p.target_date) return false
  if (p.status === '已完成') return false
  const end = new Date(p.target_date)
  const today = new Date()
  end.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return end.getTime() < today.getTime()
}

function statusCounts(projects: Project[]) {
  const map = new Map<Project['status'], number>()
  for (const p of projects) map.set(p.status, (map.get(p.status) ?? 0) + 1)
  return map
}

function Section(props: { title: string; data: Project[] }) {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const counts = statusCounts(props.data)
  const overdueCount = props.data.filter(isOverdue).length
  const [selected, setSelected] = useState<Project['status'] | 'ALL'>('ALL')
  const filtered = useMemo(() => {
    if (selected === 'ALL') return props.data
    return props.data.filter((p) => p.status === selected)
  }, [props.data, selected])
  const top = useMemo(
    () => [...filtered].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8),
    [filtered],
  )

  return (
    <Card
      title={
        <Space size={10} wrap>
          <Typography.Text style={{ fontSize: token.fontSizeHeading4, fontWeight: token.fontWeightStrong }}>
            {props.title}
          </Typography.Text>
          <Tag color="blue">{props.data.length} 项</Tag>
          {overdueCount > 0 ? <Tag color="red">逾期 {overdueCount}</Tag> : <Tag>无逾期</Tag>}
        </Space>
      }
    >
      <Row gutter={[12, 12]}>
        <Col span={6}>
          <Card
            size="small"
            hoverable
            onClick={() => setSelected((p) => (p === '进行中' ? 'ALL' : '进行中'))}
            style={{ borderColor: selected === '进行中' ? '#1677ff' : undefined }}
          >
            <Statistic title="进行中" value={counts.get('进行中') ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            hoverable
            onClick={() => setSelected((p) => (p === '规划中' ? 'ALL' : '规划中'))}
            style={{ borderColor: selected === '规划中' ? '#1677ff' : undefined }}
          >
            <Statistic title="规划中" value={counts.get('规划中') ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            hoverable
            onClick={() => setSelected((p) => (p === '已完成' ? 'ALL' : '已完成'))}
            style={{ borderColor: selected === '已完成' ? '#1677ff' : undefined }}
          >
            <Statistic title="已完成" value={counts.get('已完成') ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            hoverable
            onClick={() => setSelected((p) => (p === '已暂停' ? 'ALL' : '已暂停'))}
            style={{ borderColor: selected === '已暂停' ? '#1677ff' : undefined }}
          >
            <Statistic title="已暂停" value={counts.get('已暂停') ?? 0} />
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 12 }}>
        <Table<Project>
          rowKey="id"
          size="small"
          dataSource={top}
          pagination={false}
          onRow={(p) => ({ onClick: () => navigate(`/projects/${p.id}`) })}
          columns={[
            {
              title: '项目',
              dataIndex: 'name',
              render: (_, p) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text style={{ fontWeight: token.fontWeightStrong }}>{p.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {p.code ?? '-'} · {p.type ?? '-'}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (v: Project['status']) => <Tag color="blue">{v}</Tag>,
            },
            {
              title: '优先级',
              dataIndex: 'priority',
              width: 90,
              render: (v: number) => (
                <Tag color={v >= 4 ? 'red' : v >= 3 ? 'orange' : 'green'}>{projectPriorityLabel(v)}</Tag>
              ),
            },
            {
              title: '目标',
              dataIndex: 'target_date',
              width: 120,
              render: (v: Project['target_date'], p) => (
                <Space size={6}>
                  <Typography.Text style={{ fontSize: token.fontSizeSM }}>{v ?? '-'}</Typography.Text>
                  {isOverdue(p) ? <Tag color="red">逾期</Tag> : null}
                </Space>
              ),
            },
          ]}
        />
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const { projects } = useLoaderData() as { projects: Project[] }
  const { token } = theme.useToken()

  const { rd, quality, qualityTrack, other } = useMemo(() => {
    const rd: Project[] = []
    const quality: Project[] = []
    const qualityTrack: Project[] = []
    const other: Project[] = []
    for (const p of projects) {
      const g = projectTypeGroup(p)
      if (g === '研发项目') rd.push(p)
      else if (g === '品质项目') quality.push(p)
      else if (g === '品质问题跟踪') qualityTrack.push(p)
      else other.push(p)
    }
    return { rd, quality, qualityTrack, other }
  }, [projects])

  return (
    <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
      <Space align="baseline" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          仪表盘
        </Typography.Title>
        <Tag color="blue">共 {projects.length} 项</Tag>
      </Space>

      <Row gutter={[token.marginLG, token.marginLG]}>
        <Col xs={24} xl={12}>
          <Section title="研发项目现状"  data={rd} />
        </Col>
        <Col xs={24} xl={12}>
          <Section title="品质项目现状" data={quality} />
        </Col>
        <Col xs={24} xl={12}>
          <Section title="品质问题跟踪现状" data={qualityTrack} />
        </Col>
        {other.length > 0 ? (
          <Col xs={24} xl={12}>
            <Section title="其他项目" data={other} />
          </Col>
        ) : null}
      </Row>
    </Space>
  )
}
