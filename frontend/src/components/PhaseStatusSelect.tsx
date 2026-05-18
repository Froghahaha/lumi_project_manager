import { useEffect, useState } from 'react'
import { Select, Typography, message } from 'antd'
import { updatePhaseStatus } from '../api'
import { defaultStatuses } from '../utils/format'
import type { ProjectPhase } from '../types'

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
