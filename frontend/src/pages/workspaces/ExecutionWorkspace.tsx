import { useEffect, useMemo, useState } from 'react'
import { Col, Row, Empty, Card, Typography } from 'antd'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ProjectCard } from '../../components/ProjectCard'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { useProjectFilter } from '../../utils/useProjectFilter'
import { PhaseStatusSelect } from '../../components/PhaseStatusSelect'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects, listCustomers } from '../../api'
import type { Customer, Project, ProjectPhase } from '../../types'

export function ExecutionWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const [p, c] = await Promise.all([
          listProjects({ assigned_person: auth.person?.name || undefined }),
          listCustomers(),
        ])
        setProjects(p); setCustomers(c)
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    }
    if (auth.person?.name) load()
  }, [auth.person?.name])

  const responsibleSeqs = [1, 2, 3, 4].filter((s) =>
    auth.hasPermission(`phase_responsibility:${s}`),
  )

  function findMyPhases(proj: Project) {
    const allPhases = [...proj.phases].sort((a, b) => a.seq - b.seq)
    const assignedPhaseIds = new Set(
      proj.assignments
        .filter((a) => a.person_name === auth.person?.name && a.phase_id != null)
        .map((a) => a.phase_id),
    )
    return allPhases
      .filter((ph) => assignedPhaseIds.has(ph.id) || responsibleSeqs.includes(ph.seq))
      .map((ph) => ({ phase: ph, editable: assignedPhaseIds.has(ph.id) }))
  }

  // Build the full card data map once, then use filter.filteredProjects for display
  const projectCards = useMemo(() => {
    return projects
      .map((proj) => {
        const myPhases = findMyPhases(proj)
        if (myPhases.length === 0) return null
        return { project: proj, myPhases }
      })
      .filter(Boolean) as {
      project: Project
      myPhases: { phase: ProjectPhase; editable: boolean }[]
    }[]
  }, [projects, auth.person?.name])

  const cardMap = useMemo(
    () => Object.fromEntries(projectCards.map(c => [c.project.id, c])),
    [projectCards],
  )

  const scopedProjects = useMemo(() => projectCards.map(c => c.project), [projectCards])
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])
  const filter = useProjectFilter(scopedProjects, customerMap)

  if (!auth.person?.name) {
    return (
      <Card>
        <Typography.Title level={4}>工作台 - {auth.roleName}</Typography.Title>
        <Empty description="请在右上角选择您的姓名以查看任务" />
      </Card>
    )
  }

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projectCards.length === 0 ? (
        <Empty description="暂无分配给您的任务" />
      ) : (
        <>
          <ProjectFilterBar state={filter} actions={filter} />
          <Row gutter={[8, 8]}>
            {filter.filteredProjects.map(p => {
              const card = cardMap[p.id]
              return (
                <Col key={p.id} xs={24} sm={24} md={12}>
                  <ProjectCard
                    project={p}
                    extra={
                      card?.myPhases.map(({ phase: ph, editable }) =>
                        editable ? <span key={ph.id} onClick={(e) => e.stopPropagation()}><PhaseStatusSelect phase={ph} size="small" /></span> : null
                      )
                    }
                  />
                </Col>
              )
            })}
          </Row>
          {filter.filteredProjects.length === 0 && (
            <Empty description="无匹配项目" style={{ padding: 40 }} />
          )}
        </>
      )}
    </WorkspaceShell>
  )
}
