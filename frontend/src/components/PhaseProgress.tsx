import { Space, Tag, Tooltip, Typography } from 'antd'
import { phaseStatusTagProps, PROGRESS_HEX } from '../utils/format'
import type { ProjectPhase } from '../types'

type PhaseProgressProps = {
  phases: ProjectPhase[]
  mode: 'compact' | 'full'
  maxSteps?: number
}

function resolveStatus(ph: ProjectPhase): { status: string; color: string; hex: string } {
  const props = phaseStatusTagProps(ph)
  return {
    status: props.text,
    color: props.color,
    hex: PROGRESS_HEX[props.color === 'success' ? '已完成' : props.color === 'processing' ? '进行中' : '未开始'] || PROGRESS_HEX['未开始'],
  }
}

export function PhaseProgress({ phases, mode, maxSteps }: PhaseProgressProps) {
  const sorted = [...phases].sort((a, b) => a.seq - b.seq)

  if (sorted.length === 0) {
    return <Typography.Text type="secondary" style={{ fontSize: 12 }}>暂无工序</Typography.Text>
  }

  if (mode === 'compact') {
    const limit = maxSteps ?? Infinity
    const visible = sorted.slice(0, limit)
    const more = sorted.length - visible.length
    return (
      <Space size={2}>
        {visible.map((ph) => {
          const { status, color } = resolveStatus(ph)
          return (
            <Tooltip key={ph.id} title={`${ph.phase_name}${ph.sub_name ? '-' + ph.sub_name : ''}: ${status}`}>
              <Tag color={color} style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px', margin: 0 }}>
                {ph.phase_name}: {status}
              </Tag>
            </Tooltip>
          )
        })}
        {more > 0 && (
          <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px', margin: 0 }}>+{more}</Tag>
        )}
      </Space>
    )
  }

  // full mode: horizontal colored segment bar
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 36, width: '100%' }}>
      {sorted.map((ph) => {
        const { status, hex } = resolveStatus(ph)
        return (
          <Tooltip
            key={ph.id}
            title={`${ph.phase_name}${ph.sub_name ? ' - ' + ph.sub_name : ''}: ${status}`}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: hex,
                color: hex === PROGRESS_HEX['未开始'] ? '#666' : '#fff',
                fontSize: 12,
                fontWeight: 500,
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                padding: '0 4px',
                cursor: 'default',
              }}
            >
              {ph.phase_name}: {status}
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}
