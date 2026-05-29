import { Col, Row, Space, Tabs, Typography } from 'antd'
import { useLoaderData } from 'react-router-dom'
import { ProjectFilterBar } from '../components/ProjectFilterBar'
import { ProjectCard } from '../components/ProjectCard'
import { groupByUrgency, GROUP_LABELS, GROUP_ORDER } from '../utils/urgency'
import type { Project } from '../types'

export function ProjectsPage() {
  const { projects } = useLoaderData() as { projects: Project[] }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>项目列表</Typography.Title>

      <ProjectFilterBar projects={projects}>
        {(filtered) => {
          const fGrouped = groupByUrgency(filtered)
          const fShow = GROUP_ORDER.filter((g) => fGrouped[g].length > 0)
          const fTab = fShow[0] || 'normal'
          return (
            <Tabs
              activeKey={fTab}
              size="small"
              items={fShow.map((g) => ({
                key: g,
                label: `${GROUP_LABELS[g]} (${fGrouped[g].length})`,
                children: (
                  <Row gutter={[8, 8]}>
                    {fGrouped[g].map((p) => (
                      <Col key={p.id} xs={24} sm={24} md={12} lg={8}>
                        <ProjectCard project={p} />
                      </Col>
                    ))}
                  </Row>
                ),
              }))}
            />
          )
        }}
      </ProjectFilterBar>
    </Space>
  )
}
