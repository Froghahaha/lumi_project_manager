import { useEffect, useMemo, useState } from 'react'
import { Col, Empty, Row, Space } from 'antd'
import { AssignmentPicker } from '../../components/AssignmentPicker'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ProjectCard } from '../../components/ProjectCard'
import { ProjectFilterBar } from '../../components/ProjectFilterBar'
import { useProjectFilter } from '../../utils/useProjectFilter'
import { useAuth } from '../../contexts/AuthContext'
import { listAssignments, listProjects, listCustomers } from '../../api'
import { phasesOfSeq } from '../../utils/phases'
import type { Customer, Project, ProjectAssignment } from '../../types'

export function AfterSalesWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [assignments, setAssignments] = useState<Record<string, ProjectAssignment[]>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [all, c] = await Promise.all([listProjects(), listCustomers()])
        // 只显示已进入生产阶段的项目
        const filtered = all.filter((p) => {
          const prods = phasesOfSeq(p.phases, 2)
          const prod = prods[0]
          return prod && prod.status && prod.status !== '未开始'
        })
        setProjects(filtered)
        setCustomers(c)
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

  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c.name])), [customers])
  const filter = useProjectFilter(projects, customerMap)
  const canManage = auth.hasPermission('manage_tuning_assignment')

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无进入生产阶段的项目" />
      ) : (
        <>
          <ProjectFilterBar state={filter} actions={filter} />
          <Row gutter={[8, 8]}>
            {filter.filteredProjects.map(p => {
              const tuningPh = phasesOfSeq(p.phases, 3)[0]
              const as = assignments[p.id] || []
              return (
                <Col key={p.id} xs={24} sm={24} md={12}>
                  <ProjectCard
                    project={p}
                    extra={
                      canManage ? (
                        <Space size={4}>
                          <AssignmentPicker projectId={p.id} roleCode="tuning_executor" roleName="安调/验收" phaseId={tuningPh?.id ?? null} assignments={as.filter((a) => a.role_code === 'tuning_executor')} onChange={() => setAssignments(prev => ({ ...prev, [p.id]: prev[p.id] }))} />
                        </Space>
                      ) : undefined
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
