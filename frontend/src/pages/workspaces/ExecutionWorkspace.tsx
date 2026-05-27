import { useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Space, Typography, Tag, Empty, Button } from 'antd'
import {
  ExclamationCircleOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import { fmtDate, phaseStatusTagProps } from '../../utils/format'
import { PhaseStatusSelect } from '../../components/PhaseStatusSelect'
import type { Project, ProjectPhase } from '../../types'

export function ExecutionWorkspace() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const p = await listProjects({ assigned_person: auth.person?.name || undefined })
        setProjects(p)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setLoading(false)
    }
    if (auth.person?.name) load()
  }, [auth.person?.name])

  // ── Role-scoped phase visibility ────────────────────────────
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
      .filter(
        (ph) => assignedPhaseIds.has(ph.id) || responsibleSeqs.includes(ph.seq),
      )
      .map((ph) => ({
        phase: ph,
        editable: assignedPhaseIds.has(ph.id),
      }))
  }

  // ── Per-project card data ───────────────────────────────────
  const projectCards = projects
    .map((proj) => {
      const myPhases = findMyPhases(proj)
      if (myPhases.length === 0) return null
      const myMinSeq = Math.min(...myPhases.map((p) => p.phase.seq))
      const upstreamPhases = [...proj.phases]
        .filter((ph) => ph.seq < myMinSeq)
        .sort((a, b) => a.seq - b.seq)
      return { project: proj, myPhases, upstreamPhases }
    })
    .filter(Boolean) as {
    project: Project
    myPhases: { phase: ProjectPhase; editable: boolean }[]
    upstreamPhases: ProjectPhase[]
  }[]

  // ── Section grouping ────────────────────────────────────────
  const sectioned = {
    active: [] as typeof projectCards,
    pending: [] as typeof projectCards,
    completed: [] as typeof projectCards,
  }
  for (const card of projectCards) {
    const hasActiveRectify = card.project.phases.some(
      (ph) => ph.is_rectify && !ph.actual_end_date,
    )
    const activeProgress = ['进行中', '预警', '逾期']
    const myActive = card.myPhases.some((p) =>
      activeProgress.includes(p.phase.phase_progress || '未开始'),
    )
    if (hasActiveRectify || myActive) {
      sectioned.active.push(card)
    } else if (card.myPhases.every((p) => p.phase.phase_progress === '已完成')) {
      sectioned.completed.push(card)
    } else {
      sectioned.pending.push(card)
    }
  }

  if (!auth.person?.name) {
    return (
      <Card>
        <Typography.Title level={4}>工作台 - {auth.roleName}</Typography.Title>
        <Empty description="请在右上角选择您的姓名以查看任务" />
      </Card>
    )
  }

  // ── Role-specific warnings ──────────────────────────────────

  function hasActiveWarnings(proj: Project) {
    const design = proj.phases.find((ph) => ph.seq === 1)
    const prod = proj.phases.find((ph) => ph.seq === 2)
    return (design?.status === '图纸已下发' || prod?.status === '已发货') && !proj.agreement_filename
  }

  function warningMessage(proj: Project) {
    const design = proj.phases.find((ph) => ph.seq === 1)
    if (design?.status === '图纸已下发' && !proj.agreement_filename)
      return '图纸已下发但未上传技术协议，请联系销售上传'
    const prod = proj.phases.find((ph) => ph.seq === 2)
    if (prod?.status === '已发货' && !proj.agreement_filename)
      return '已发货但未上传技术协议'
    return null
  }

  // ── Project Card ────────────────────────────────────────────

  function ProjectCard({
    project: proj,
    myPhases,
    upstreamPhases,
  }: typeof projectCards[number]) {
    const [expanded, setExpanded] = useState(false)
    const hasActiveRectify = proj.phases.some(
      (ph) => ph.is_rectify && !ph.actual_end_date,
    )
    const rectifyPh = proj.phases.find((ph) => ph.is_rectify && !ph.actual_end_date)
    const isOverdue =
      proj.contract_expected_delivery_date &&
      new Date() > new Date(proj.contract_expected_delivery_date)
    const warnMsg = warningMessage(proj)

    const allIncidents = myPhases.flatMap((p) => p.phase.incidents || [])
    const hasDetail = allIncidents.length > 0 || !!rectifyPh

    return (
      <Card
        size="small"
        style={hasActiveRectify ? { borderColor: '#faad14', borderWidth: 2 } : {}}
        title={
          <Space size={4}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              {proj.order_no}
            </Typography.Text>
            {hasActiveRectify && (
              <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                整改中
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space size={8}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, fontWeight: isOverdue ? 600 : undefined, color: isOverdue ? 'red' : undefined }}
            >
              {isOverdue ? '交期逾期 ' : '交期 '}
              {fmtDate(proj.contract_expected_delivery_date)}
            </Typography.Text>
            {hasDetail && (
              <Button
                type="text"
                size="small"
                icon={expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                onClick={() => setExpanded(!expanded)}
                style={{ padding: 0, minWidth: 20 }}
              />
            )}
          </Space>
        }
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {/* ── Prime info: upstream → my phases (always visible) ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {upstreamPhases.map((ph, i) => (
              <span key={ph.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Tag color={phaseStatusTagProps(ph).color} style={{ margin: 0 }}>
                  {ph.phase_name}: {phaseStatusTagProps(ph).text}
                </Tag>
                {i < upstreamPhases.length - 1 && (
                  <Typography.Text type="secondary" style={{ fontSize: 10 }}>→</Typography.Text>
                )}
              </span>
            ))}
            {upstreamPhases.length > 0 && (
              <Tag style={{ margin: 0, background: '#f5f5f5', border: 'none', fontSize: 11 }}>→</Tag>
            )}
            {myPhases.map(({ phase: ph, editable }) => (
              <span key={ph.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Tag color={phaseStatusTagProps(ph).color} style={{ margin: 0 }}>
                  {ph.phase_name}
                </Tag>
                {editable ? (
                  <PhaseStatusSelect phase={ph} size="small" />
                ) : (
                  <Typography.Text style={{ fontSize: 12, cursor: 'default' }}>
                    {phaseStatusTagProps(ph).text}
                  </Typography.Text>
                )}
                {ph.start_date && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {fmtDate(ph.start_date)}→{fmtDate(ph.planned_end_date)}
                  </Typography.Text>
                )}
              </span>
            ))}
          </div>

          {/* ── Warning (always visible, compact) ──────────────── */}
          {warnMsg && (
            <Alert
              type="warning"
              showIcon
              message={warnMsg}
              style={{ padding: '2px 8px', fontSize: 11, lineHeight: '18px' }}
            />
          )}

          {/* ── Expanded detail ────────────────────────────────── */}
          {expanded && (
            <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 4, paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
              {rectifyPh && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                  <span style={{ color: '#666' }}>整改</span>
                  <Tag color={phaseStatusTagProps(rectifyPh).color} style={{ margin: 0 }}>
                    {rectifyPh.phase_name}
                  </Tag>
                  <PhaseStatusSelect phase={rectifyPh} size="small" />
                </div>
              )}
              {allIncidents.map((inc) => (
                <div key={inc.id} style={{ fontSize: 12, color: '#666', paddingLeft: 4 }}>
                  {inc.occurred_at ? inc.occurred_at.slice(0, 10) : '-'} [{inc.category}] {inc.description.slice(0, 80)}
                </div>
              ))}
              <Button
                size="small"
                type="link"
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => navigate(`/projects/${proj.id}`)}
              >
                项目详情 →
              </Button>
            </Space>
          )}
        </Space>
      </Card>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  const totalCards =
    sectioned.active.length + sectioned.pending.length + sectioned.completed.length

  return (
    <WorkspaceShell loading={loading} error={error}>
      {projects.length === 0 ? (
        <Empty description="暂无分配给您的任务" />
      ) : totalCards === 0 ? (
        <Empty description="当前无匹配的任务" />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {sectioned.active.length > 0 && (
            <div>
              <Typography.Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
                进行中 ({sectioned.active.length})
              </Typography.Text>
              <Row gutter={[8, 8]}>
                {sectioned.active.map((c) => (
                  <Col key={c.project.id} xs={24} sm={24} md={12}>
                    <ProjectCard {...c} />
                  </Col>
                ))}
              </Row>
            </div>
          )}

          {sectioned.pending.length > 0 && (
            <div>
              <Typography.Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
                待开始 ({sectioned.pending.length})
              </Typography.Text>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {sectioned.pending.map((c) => <ProjectCard key={c.project.id} {...c} />)}
              </Space>
            </div>
          )}

          {sectioned.completed.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                已完成 ({sectioned.completed.length})
              </summary>
              <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                {sectioned.completed.map((c) => (
                  <Col key={c.project.id} xs={24} sm={24} md={12}>
                    <ProjectCard {...c} />
                  </Col>
                ))}
              </Row>
            </details>
          )}
        </Space>
      )}
    </WorkspaceShell>
  )
}
