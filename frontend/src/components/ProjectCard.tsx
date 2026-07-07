import { Card, Progress, Space, Tag, Typography } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { phaseDaysDisplay, phaseStatusTagProps } from '../utils/format'
import { phaseWarnings } from '../utils/phaseConfig'
import type { Project, ProjectPhase } from '../types'

/** Format ISO date string as YY-MM-DD (e.g. "2026-01-15" → "26-01-15") */
function shortYy(d: string): string {
  return d.slice(2)  // "2026-01-15" → "26-01-15"
}

/** Days between two ISO date strings (inclusive). Returns null if either is missing. */
function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const a = new Date(from); a.setHours(0, 0, 0, 0)
  const b = new Date(to);   b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function PhaseCardRow({ ph, project }: { ph: ProjectPhase; project: Project }) {
  const days = phaseDaysDisplay(ph)
  const statusProps = phaseStatusTagProps(ph)
  const executor = ph.responsible || project.assignments.find((a) => a.phase_id === ph.id)?.person_name || '-'
  const completedDate = ph.phase_progress === '已完成' && ph.actual_end_date
    ? shortYy(ph.actual_end_date)
    : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 56px 48px 52px', gap: 4, alignItems: 'center', fontSize: 12 }}>
      <Tag color={statusProps.color} style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ph.phase_name}: {statusProps.text}
      </Tag>
      <Typography.Text style={{ color: '#1677ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {executor}
      </Typography.Text>
      {days
        ? <Typography.Text style={{ color: days.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{days.text}</Typography.Text>
        : <span />
      }
      {completedDate
        ? <Typography.Text style={{ color: 'rgba(0,0,0,0.45)', fontSize: 10, whiteSpace: 'nowrap' }}>
            <ClockCircleOutlined style={{ marginRight: 1 }} />{completedDate}
          </Typography.Text>
        : <span />
      }
    </div>
  )
}

export function ProjectCard({ project: p, extra, onClick }: {
  project: Project
  extra?: React.ReactNode
  onClick?: () => void
}) {
  const navigate = useNavigate()
  // 尾款阶段：找到并排除，不展示为 PhaseCardRow，底部进度条行统一展示
  const tailPhase = p.phases.find(ph => ph.phase_name === '尾款')
  const visiblePhases = [...p.phases]
    .filter(ph => ph.id !== tailPhase?.id)
    .sort((a, b) => a.seq - b.seq)

  const payPct = Math.round((p.contract_payment_progress || 0) * 100)
  const warnMsg = phaseWarnings(p).find((w) => w.type === 'payment_due')?.message || null
  const tailDays = tailPhase ? phaseDaysDisplay(tailPhase) : null
  const tailStatusProps = tailPhase ? phaseStatusTagProps(tailPhase) : null

  // Elapsed days: start → today (or last actual_end if all done)
  const allDone = visiblePhases.length > 0 && visiblePhases.every(ph => ph.phase_progress === '已完成')
  const startDate = p.contract_effective_date || p.contract_start_date
  const endDate = allDone
    ? visiblePhases.reduce((latest, ph) => (ph.actual_end_date && (!latest || ph.actual_end_date > latest) ? ph.actual_end_date : latest), null as string | null)
    : new Date().toISOString().slice(0, 10)
  const elapsed = daysBetween(startDate, endDate)

  let progressColor = '#1677ff'
  if (payPct >= 100) progressColor = '#52c41a'
  else if (payPct > 0) progressColor = '#1677ff'

  return (
    <Card
      size="small"
      hoverable
      onClick={onClick || (() => navigate(`/projects/${p.id}`))}
      title={
        <Space size={4} wrap>
          <Typography.Text strong style={{ fontSize: 14 }}>{p.order_no}</Typography.Text>
          {p.project_manager_name && (
            <Typography.Text style={{ fontSize: 12, color: '#1677ff' }}>PM:{p.project_manager_name}</Typography.Text>
          )}
          {p.salesman_name && (
            <Typography.Text style={{ fontSize: 12, color: '#52c41a' }}>销售:{p.salesman_name}</Typography.Text>
          )}
        </Space>
      }
      extra={
        <Space size={6}>
          {startDate && (
            <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              立项 {shortYy(startDate)}
            </Typography.Text>
          )}
          {p.contract_expected_delivery_date && (
            <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              交期 {shortYy(p.contract_expected_delivery_date)}
            </Typography.Text>
          )}
          {elapsed != null && (
            <Typography.Text
              style={{ fontSize: 11, whiteSpace: 'nowrap', color: allDone ? '#52c41a' : '#1677ff' }}
            >
              {elapsed}天
            </Typography.Text>
          )}
          {warnMsg && <Tag color="red">{warnMsg}</Tag>}
          {extra}
        </Space>
      }
      style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
      styles={{
        body: { padding: '8px 12px' },
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#fafafa'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = ''
      }}
    >
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        {visiblePhases.map((ph) => (
          <PhaseCardRow key={ph.id} ph={ph} project={p} />
        ))}
        {tailPhase && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, paddingTop: 3,
            borderTop: '1px solid #f0f0f0', marginTop: 2,
          }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>收款</Typography.Text>
            <Progress
              percent={payPct}
              size="small"
              style={{ flex: 1, margin: 0 }}
              strokeColor={progressColor}
              format={() => `${payPct}%`}
            />
            {tailStatusProps && (
              <Tag color={tailStatusProps.color} style={{ fontSize: 12, margin: 0 }}>
                {tailStatusProps.text}
              </Tag>
            )}
            {tailDays && (
              <Typography.Text style={{ color: tailDays.color, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                {tailDays.text}
              </Typography.Text>
            )}
          </div>
        )}
        {!tailPhase && payPct > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2, borderTop: '1px solid #f0f0f0' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>收款进度</Typography.Text>
            <Progress percent={payPct} size="small" style={{ flex: 1, margin: 0 }} strokeColor={progressColor} />
          </div>
        )}
      </Space>
    </Card>
  )
}
