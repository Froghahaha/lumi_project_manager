import { useEffect, useMemo, useState } from 'react'
import { Col, Empty, Row, Space, Tabs } from 'antd'
import { AssignmentPicker } from '../../components/AssignmentPicker'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import { ProjectCard } from '../../components/ProjectCard'
import { listAssignments, listProjects } from '../../api'
import { groupByUrgency, GROUP_LABELS, GROUP_ORDER, type UrgencyGroup } from '../../utils/urgency'
import { phasesOfSeq } from '../../utils/phases'
import type { Project, ProjectAssignment } from '../../types'

export function AfterSalesWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<Record<string, ProjectAssignment[]>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const all = await listProjects()
        // 只显示已进入生产阶段的项目
        const filtered = all.filter((p) => {
          const prods = phasesOfSeq(p.phases, 2)
          const prod = prods[0]
          return prod && prod.status && prod.status !== '未开始'
        })
        setProjects(filtered)
        const amap: Record<string, ProjectAssignment[]> = {}
        for (const p of filtered) {
          amap[p.id] = await listAssignments(p.id)
        }
        setAssignments(amap)
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
      setLoading(false)
    }
    load()
  }, [])

  async function refreshRow(projectId: string) {
    setAssignments((prev) => ({ ...prev, [projectId]: prev[projectId] }))
  }

  const grouped = useMemo(() => groupByUrgency(projects), [projects])
  const showGroups = GROUP_ORDER.filter((g) => grouped[g].length > 0)
  const [urgencyTab, setUrgencyTab] = useState<UrgencyGroup>(showGroups[0] || 'normal')

  const canManage = auth.hasPermission('manage_tuning_assignment')

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无进入生产阶段的项目" />
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
                {grouped[g].map((p) => {
                  const tuningPh = phasesOfSeq(p.phases, 3)[0]
                  const accPh = phasesOfSeq(p.phases, 4)[0]
                  const as = assignments[p.id] || []
                  return (
                    <Col key={p.id} xs={24} sm={24} md={12}>
                      <ProjectCard
                        project={p}
                        extra={
                          canManage ? (
                            <Space size={4}>
                              <AssignmentPicker projectId={p.id} roleCode="tuning_executor" roleName="安调" phaseId={tuningPh?.id ?? null} assignments={as.filter((a) => a.role_code === 'tuning_executor')} onChange={() => refreshRow(p.id)} />
                              <AssignmentPicker projectId={p.id} roleCode="acceptance_executor" roleName="验收" phaseId={accPh?.id ?? null} assignments={as.filter((a) => a.role_code === 'acceptance_executor')} onChange={() => refreshRow(p.id)} />
                            </Space>
                          ) : undefined
                        }
                      />
                    </Col>
                  )
                })}
              </Row>
            ),
          }))}
        />
      )}
    </WorkspaceShell>
  )
}
