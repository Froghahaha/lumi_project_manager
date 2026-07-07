import { useEffect, useMemo, useState } from 'react'
import { Col, Empty, Row } from 'antd'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ProjectCard } from '../../components/ProjectCard'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { useProjectFilter } from '../../utils/useProjectFilter'
import { listProjects, listCustomers } from '../../api'
import type { Customer, Project } from '../../types'

export function PMWorkspace() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [p, c] = await Promise.all([listProjects(), listCustomers()])
        setProjects(p); setCustomers(c)
      }
      catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    }
    load()
  }, [])

  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])
  const filter = useProjectFilter(projects, customerMap)

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无项目" />
      ) : (
        <>
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
        </>
      )}
    </WorkspaceShell>
  )
}
