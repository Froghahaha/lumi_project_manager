import { useEffect, useState } from 'react'
import { Select, Typography, message } from 'antd'
import { updatePhaseStatus } from '../api'
import type { ProjectPhase } from '../types'

function defaultStatuses(phaseName: string): string[] {
  switch (phaseName) {
    case '机械设计': return ['未开始', '设计中', '图纸已下发']
    case '生产': return ['未开始', '生产中', '生产完成', '已发货']
    case '调机': return ['未开始', '安调中', '安调完成']
    case '验收': return ['未开始', '已验收']
    case '尾款': return []
    default: return ['未开始', '进行中', '已完成']
  }
}

export function PhaseStatusSelect({ phase, size = 'small' }: {
  phase: ProjectPhase
  size?: 'small' | 'middle' | 'large'
}) {
  const [loading, setLoading] = useState(false)
  const [current, setCurrent] = useState(phase.status || '')

  useEffect(() => {
    setCurrent(phase.status || '')
  }, [phase.status])

  const statuses = defaultStatuses(phase.phase_name)

  if (statuses.length === 0) {
    if (!current) return <Typography.Text type="secondary">-</Typography.Text>
    return <Typography.Text>{current}</Typography.Text>
  }

  async function onChange(v: string) {
    setLoading(true)
    try {
      await updatePhaseStatus(phase.id, v)
      setCurrent(v)
      message.success(`状态已更新: ${v}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  return (
    <Select
      size={size}
      value={current || undefined}
      disabled={loading}
      style={{ width: 120 }}
      placeholder="选择状态"
      options={statuses.map((s) => ({ label: s, value: s }))}
      onChange={(v) => onChange(v)}
    />
  )
}
