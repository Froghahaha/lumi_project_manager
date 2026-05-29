import { Card, Progress, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { phaseDaysDisplay, phaseStatusTagProps } from '../utils/format'
import { phaseWarnings } from '../utils/phaseConfig'
import type { Project, ProjectPhase } from '../types'

export function PhaseCardRow({ ph, project }: { ph: ProjectPhase; project: Project }) {
  const days = phaseDaysDisplay(ph)
  const statusProps = phaseStatusTagProps(ph)
  const executor = ph.responsible || project.assignments.find((a) => a.phase_id === ph.id)?.person_name || '-'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 56px 48px', gap: 6, alignItems: 'center', fontSize: 12 }}>
      <Tag color={statusProps.color} style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ph.phase_name}: {statusProps.text}
      </Tag>
      <Typography.Text style={{ color: '#1677ff', whiteSpace: 'nowrap' }}>{executor}</Typography.Text>
      {days
        ? <Typography.Text style={{ color: days.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{days.text}</Typography.Text>
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
  const sortedPhases = [...p.phases].sort((a, b) => a.seq - b.seq)
  const payPct = Math.round((p.contract_payment_progress || 0) * 100)
  const warnMsg = phaseWarnings(p).find((w) => w.type === 'payment_due')?.message || null
  return (
    <Card
      size="small"
      hoverable
      onClick={onClick || (() => navigate(`/projects/${p.id}`))}
      title={<Typography.Text strong style={{ fontSize: 14 }}>{p.order_no}</Typography.Text>}
      extra={
        <Space size={4}>
          {warnMsg && <Tag color="red">{warnMsg}</Tag>}
          {extra}
        </Space>
      }
      style={{ cursor: 'pointer' }}
    >
      <Space direction="vertical" size={3} style={{ width: '100%' }}>
        {sortedPhases.map((ph) => (
          <PhaseCardRow key={ph.id} ph={ph} project={p} />
        ))}
        {payPct > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2, borderTop: '1px solid #f0f0f0' }}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>收款进度</Typography.Text>
            <Progress percent={payPct} size="small" style={{ flex: 1, margin: 0 }} strokeColor="#1677ff" />
          </div>
        )}
      </Space>
    </Card>
  )
}
