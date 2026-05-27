import { useMemo, useState, type ReactNode } from 'react'
import { Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd'
import type { Project } from '../types'

export type FilterState = {
  totalCount: number
  overdueCount: number
  categories: string[]
  filterCategory: string | null
  filterStatus: string | null
  setFilterCategory: (c: string | null) => void
  setFilterStatus: (s: string | null) => void
}

type Props = {
  projects: Project[]
  children: (filtered: Project[], state: FilterState) => ReactNode
}

export function ProjectFilterBar({ projects, children }: Props) {
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const totalCount = projects.length
  const overdueCount = projects.filter((p) => (p.project_status || '正常') === '逾期').length

  const categories = useMemo(() => {
    const set = new Set(projects.flatMap((p) => p.equipment_list.map(e => e.category)).filter(Boolean) as string[])
    return ['全部', ...Array.from(set).sort()]
  }, [projects])

  const filtered = useMemo(() => {
    let list = projects
    if (filterCategory && filterCategory !== '全部') {
      list = list.filter((p) => p.equipment_list.some(e => e.category === filterCategory))
    }
    if (filterStatus === '逾期') {
      list = list.filter((p) => (p.project_status || '正常') === '逾期')
    }
    return list
  }, [projects, filterCategory, filterStatus])

  const state: FilterState = {
    totalCount, overdueCount, categories,
    filterCategory, filterStatus, setFilterCategory, setFilterStatus,
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => { setFilterStatus(null); setFilterCategory(null) }}>
            <Statistic title="总项目" value={totalCount} valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" hoverable
            style={filterStatus === '逾期' ? { borderColor: '#ff4d4f' } : {}}
            onClick={() => setFilterStatus(filterStatus === '逾期' ? null : '逾期')}
          >
            <Statistic title="逾期项目" value={overdueCount}
              valueStyle={{ color: overdueCount > 0 ? '#ff4d4f' : undefined, fontSize: 24 }} />
          </Card>
        </Col>
      </Row>

      {categories.length > 1 && (
        <Space wrap>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>设备筛选:</Typography.Text>
          {categories.map((cat) => (
            <Tag key={cat}
              color={filterCategory === cat || (cat === '全部' && !filterCategory) ? 'blue' : 'default'}
              style={{ cursor: 'pointer' }}
              onClick={() => setFilterCategory(cat === '全部' ? null : cat)}
            >{cat}</Tag>
          ))}
        </Space>
      )}

      {children(filtered, state)}
    </Space>
  )
}
