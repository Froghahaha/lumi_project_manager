import { useEffect, useMemo, useState } from 'react'
import { Col, Row, Tabs, Typography, Empty, Card } from 'antd'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import { ProjectCard } from '../../components/ProjectCard'
import { PhaseStatusSelect } from '../../components/PhaseStatusSelect'
import { groupByUrgency, GROUP_LABELS, type UrgencyGroup, visibleGroups } from '../../utils/urgency'
import type { Project, ProjectPhase } from '../../types'

export function ExecutionWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const p = await listProjects({ assigned_person: auth.person?.name || undefined })
        setProjects(p)
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    }
    if (auth.person?.name) load()
  }, [auth.person?.name])

  const responsibleSeqs = [1, 2, 3, 4, 5].filter((s) =>
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

  function upstreamPhases(proj: Project, myPhases: { phase: ProjectPhase; editable: boolean }[]) {
    const myMinSeq = Math.min(...myPhases.map((p) => p.phase.seq))
    return [...proj.phases].filter((ph) => ph.seq < myMinSeq).sort((a, b) => a.seq - b.seq)
  }

  const projectCards = useMemo(() => {
    return projects
      .map((proj) => {
        const myPhases = findMyPhases(proj)
        if (myPhases.length === 0) return null
        return { project: proj, myPhases, upstream: upstreamPhases(proj, myPhases) }
      })
      .filter(Boolean) as {
      project: Project
      myPhases: { phase: ProjectPhase; editable: boolean }[]
      upstream: ProjectPhase[]
    }[]
  }, [projects, auth.person?.name])

  const grouped = useMemo(() => {
    const projList = projectCards.map((c) => c.project)
    return groupByUrgency(projList)
  }, [projectCards])

  if (!auth.person?.name) {
    return (
      <Card>
        <Typography.Title level={4}>工作台 - {auth.roleName}</Typography.Title>
        <Empty description="请在右上角选择您的姓名以查看任务" />
      </Card>
    )
  }

  const showGroups = visibleGroups([auth.role]).filter((g) => grouped[g].length > 0)
  const [urgencyTab, setUrgencyTab] = useState<UrgencyGroup>(showGroups[0] || 'normal')

  const urgencyTabItems = showGroups.map((g) => ({
    key: g,
    label: `${GROUP_LABELS[g]} (${grouped[g].length})`,
    children: (
      <Row gutter={[8, 8]}>
        {grouped[g].map((p) => {
          const card = projectCards.find((c) => c.project.id === p.id)!
          return (
            <Col key={p.id} xs={24} sm={24} md={12}>
              <ProjectCard
                project={p}
                extra={
                  card.myPhases.map(({ phase: ph, editable }) =>
                    editable ? <span onClick={(e) => e.stopPropagation()}><PhaseStatusSelect key={ph.id} phase={ph} size="small" /></span> : null
                  )
                }
              />
            </Col>
          )
        })}
      </Row>
    ),
  }))

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projectCards.length === 0 ? (
        <Empty description="暂无分配给您的任务" />
      ) : (
        <Tabs
          activeKey={urgencyTab}
          onChange={(k) => setUrgencyTab(k as UrgencyGroup)}
          size="small"
          items={urgencyTabItems}
        />
      )}
    </WorkspaceShell>
  )
}
