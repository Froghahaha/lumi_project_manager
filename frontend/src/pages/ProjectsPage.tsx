import { Card, Space, Typography } from 'antd'
import { useLoaderData } from 'react-router-dom'
import { ProjectFilterBar } from '../components/ProjectFilterBar'
import { ProjectTable } from '../components/ProjectTable'
import { useAuth } from '../contexts/AuthContext'
import type { Project } from '../types'

export function ProjectsPage() {
  const { projects } = useLoaderData() as { projects: Project[] }
  const auth = useAuth()
  const showPayment = auth.hasPermission('view_payment_column')

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>项目列表</Typography.Title>

      <ProjectFilterBar projects={projects}>
        {(filtered) => (
          <Card>
            <ProjectTable
              projects={filtered}
              columns={['order_no', 'equipment', 'status', 'payment', 'delivery', 'phases']}
              showPayment={showPayment}
              pagination={{ pageSize: 15, hideOnSinglePage: true }}
            />
          </Card>
        )}
      </ProjectFilterBar>
    </Space>
  )
}
