import { useEffect, useState } from 'react'
import {
  Card,
  Empty,
  Space,
  Tag,
} from 'antd'
import { AssignmentPicker } from '../../components/AssignmentPicker'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import {
  listAssignments,
  listPhasesGlobal,
  listProjects,
} from '../../api'
import type { Project, ProjectAssignment, ProjectPhase } from '../../types'

export function AfterSalesWorkspace() {
  const auth = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{ project: Project; productionPhase: ProjectPhase; tuningPhase: ProjectPhase; acceptancePhase: ProjectPhase; assignments: ProjectAssignment[] }[]>([])
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const allProjects = await listProjects()
        const rows: typeof data = []
        for (const p of allProjects) {
          const phases = await listPhasesGlobal({ project_id: p.id })
          const prod = phases.find((ph) => ph.seq === 2)
          const tuning = phases.find((ph) => ph.seq === 3)
          const acceptance = phases.find((ph) => ph.seq === 4)
          // 只显示已进入生产阶段的项目
          if (prod && prod.status !== '' && prod.status !== '未开始') {
            const as = await listAssignments(p.id)
            rows.push({ project: p, productionPhase: prod, tuningPhase: tuning!, acceptancePhase: acceptance!, assignments: as })
          }
        }
        setData(rows)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function refreshRow(projectId: string) {
    const rows = [...data]
    for (const r of rows) {
      if (r.project.id === projectId) {
        r.assignments = await listAssignments(projectId)
      }
    }
    setData(rows)
  }

  return (
    <WorkspaceShell loading={loading} error={error}>
      {data.length === 0 ? (
        <Empty description="暂无进入生产阶段的项目" />
      ) : (
        data.map(({ project, productionPhase, tuningPhase, acceptancePhase, assignments }) => {
          const tuningAssignments = assignments.filter((a) => a.role_code === 'tuning_executor')
          const acceptanceAssignments = assignments.filter((a) => a.role_code === 'acceptance_executor')
          return (
            <Card key={project.id} size="small" title={project.order_no}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space>
                  <Tag color={phaseStatusTagProps(productionPhase).color}>生产: {phaseStatusTagProps(productionPhase).text}</Tag>
                  <Tag color={tuningPhase ? phaseStatusTagProps(tuningPhase).color : 'default'}>
                    调机: {tuningPhase ? phaseStatusTagProps(tuningPhase).text : '未开始'}
                  </Tag>
                  <Tag color={acceptancePhase ? phaseStatusTagProps(acceptancePhase).color : 'default'}>
                    验收: {acceptancePhase ? phaseStatusTagProps(acceptancePhase).text : '未开始'}
                  </Tag>
                </Space>
                {auth.hasPermission('manage_tuning_assignment') && (
                <AssignmentPicker
                  projectId={project.id}
                  roleCode="tuning_executor"
                  roleName="安调执行人"
                  phaseId={tuningPhase?.id ?? null}
                  assignments={tuningAssignments}
                  onChange={() => refreshRow(project.id)}
                />
                )}
                {auth.hasPermission('manage_tuning_assignment') && (
                <AssignmentPicker
                  projectId={project.id}
                  roleCode="acceptance_executor"
                  roleName="验收执行人"
                  phaseId={acceptancePhase?.id ?? null}
                  assignments={acceptanceAssignments}
                  onChange={() => refreshRow(project.id)}
                />
                )}
              </Space>
            </Card>
          )
        })
      )}
    </WorkspaceShell>
  )
}
