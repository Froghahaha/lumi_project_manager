import { useEffect, useMemo, useState } from 'react'
import { Col, Empty, Row, Tabs } from 'antd'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ProjectCard } from '../../components/ProjectCard'
import { listProjects } from '../../api'
import { groupByUrgency, GROUP_LABELS, GROUP_ORDER, type UrgencyGroup } from '../../utils/urgency'
import type { Project } from '../../types'

export function SoftwareWorkspace() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try { setProjects(await listProjects()) }
      catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    }
    load()
  }, [])

  const grouped = useMemo(() => groupByUrgency(projects), [projects])
  const showGroups = GROUP_ORDER.filter((g) => grouped[g].length > 0)
  const [urgencyTab, setUrgencyTab] = useState<UrgencyGroup>(showGroups[0] || 'normal')

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无项目" />
      ) : (
        <Tabs
          activeKey={urgencyTab}
          onChange={(k) => setUrgencyTab(k as UrgencyGroup)}
          size="small"
          items={showGroups.map((g) => ({
            key: g,
            label: `${GROUP_LABELS[g]} (${grouped[g].length})`,
            children: (
              <Row gutter={[8, 8]}>
                {grouped[g].map((p) => (
                  <Col key={p.id} xs={24} sm={24} md={12} lg={8}>
                    <ProjectCard project={p} />
                  </Col>
                ))}
              </Row>
            ),
          }))}
        />
      )}
    </WorkspaceShell>
  )
}
