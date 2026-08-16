import { Col, Empty, Row, Space, Typography } from 'antd'
import { useLoaderData } from 'react-router-dom'
import { ProjectFilterBar } from '../components/ProjectFilterBar'
import { ProjectCard } from '../components/ProjectCard'
import { useProjectFilter } from '../utils/useProjectFilter'
import type { Project } from '../types'

export function ProjectsPage() {
  const { projects } = useLoaderData() as { projects: Project[] }

  const filter = useProjectFilter(projects, {})

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>项目列表</Typography.Title>

      <ProjectFilterBar state={filter} actions={filter} />
      <Row gutter={[8, 8]}>
        {filter.filteredProjects.map(p => (
          <Col key={p.id} xs={24} sm={24} md={12} lg={8}>
            <ProjectCard project={p} />
          </Col>
        ))}
      </Row>
      {filter.filteredProjects.length === 0 && (
        <Empty description="无匹配项目" style={{ padding: 40 }} />
      )}
    </Space>
  )
}
