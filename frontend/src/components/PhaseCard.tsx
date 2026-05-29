import { useState } from 'react'
import { Button, Card, DatePicker, Popconfirm, Space, Tag, Typography } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import { phaseDaysDisplay, phaseStatusTagProps } from '../utils/format'
import { COLOR } from '../design-tokens'
import { PhaseStatusSelect } from './PhaseStatusSelect'
import { AssignmentPicker } from './AssignmentPicker'
import type { Project, ProjectPhase } from '../types'

type Props = {
  ph: ProjectPhase
  project: Project
  canEditDates: boolean
  canAssign: boolean
  roleCodeForAssign?: string
  canUpdateStatus: boolean
  canAddIncident: boolean
  canDelete: boolean
  onAddIncident: (phaseId: string) => void
  onDeletePhase: (phaseId: string) => void
  onEditPhase?: (phaseId: string, field: string, value: string | null) => void
  onRefresh?: () => void
}

export function PhaseCard({
  ph, project, canEditDates, canAssign, roleCodeForAssign,
  canUpdateStatus, canAddIncident, canDelete,
  onAddIncident, onDeletePhase, onEditPhase, onRefresh,
}: Props) {
  const [editingDates, setEditingDates] = useState(false)
  const tagProps = phaseStatusTagProps(ph)
  const days = phaseDaysDisplay(ph)
  const isActiveRectify = ph.is_rectify && !ph.actual_end_date

  return (
    <Card
      size="small" type="inner"
      style={{
        marginBottom: 8,
        borderColor: isActiveRectify ? COLOR.warning : undefined,
        borderWidth: isActiveRectify ? 2 : 1,
      }}
      styles={{ body: { padding: '8px 12px' } }}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {/* ── Left: identity + controls ──────────────────────── */}
        <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid #f0f0f0', paddingRight: 12 }}>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <span>
              {ph.is_rectify && <ExclamationCircleOutlined style={{ color: COLOR.warning, marginRight: 4 }} />}
              <Tag color={tagProps.color} style={{ margin: 0 }}>
                {ph.is_rectify ? `整改${ph.sub_name ? ` - ${ph.sub_name}` : ''}` : `${ph.phase_name}${ph.sub_name ? ` - ${ph.sub_name}` : ''}`}
              </Tag>
            </span>

            {/* Executor: show AssignmentPicker if editable, else plain name */}
            {canAssign && roleCodeForAssign ? (
              <AssignmentPicker
                projectId={project.id} roleCode={roleCodeForAssign}
                roleName="" phaseId={ph.id}
                assignments={project.assignments.filter(
                  (a) => a.role_code === roleCodeForAssign && a.phase_id === ph.id
                )}
                onChange={() => onRefresh?.()}
                size="small"
              />
            ) : (
              <Typography.Text style={{ color: '#1677ff', fontWeight: 500, fontSize: 13 }}>
                {ph.responsible || project.assignments.find((a) => a.phase_id === ph.id)?.person_name || '未指定'}
              </Typography.Text>
            )}

            {canUpdateStatus && <PhaseStatusSelect phase={ph} size="small" />}

            {/* Dates */}
            {canEditDates && editingDates ? (
              <Space size={2} direction="vertical">
                <DatePicker size="small" locale={zhCNDatePicker} style={{ width: 130 }} placeholder="开始"
                  value={ph.start_date ? dayjs(ph.start_date) : null}
                  onChange={(d) => { onEditPhase?.(ph.id, 'start_date', d?.format('YYYY-MM-DD') ?? null); setEditingDates(false) }} />
                <DatePicker size="small" locale={zhCNDatePicker} style={{ width: 130 }} placeholder="计划完成"
                  value={ph.planned_end_date ? dayjs(ph.planned_end_date) : null}
                  onChange={(d) => { onEditPhase?.(ph.id, 'planned_end_date', d?.format('YYYY-MM-DD') ?? null); setEditingDates(false) }} />
                <Button size="small" type="text" onClick={() => setEditingDates(false)} style={{ padding: 0, fontSize: 11 }}>取消</Button>
              </Space>
            ) : (
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, cursor: canEditDates ? 'pointer' : undefined }}
                onClick={canEditDates ? () => setEditingDates(true) : undefined}
              >
                {ph.start_date ? dayjs(ph.start_date).format('MM-DD') : canEditDates ? '设日期' : ''}
                {ph.start_date && ph.planned_end_date ? `→${dayjs(ph.planned_end_date).format('MM-DD')}` : ph.planned_end_date ? dayjs(ph.planned_end_date).format('MM-DD') : ''}
                {days ? <span style={{ color: days.color, fontWeight: 600, marginLeft: 4 }}>{days.text}</span> : null}
              </Typography.Text>
            )}

            {ph.actual_end_date && (
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                完成 {dayjs(ph.actual_end_date).format('MM-DD')}
              </Typography.Text>
            )}

            {canDelete && (
              <Popconfirm title="确认删除?" onConfirm={() => onDeletePhase(ph.id)}>
                <Button danger size="small" type="text" style={{ padding: 0, fontSize: 11 }}>删除</Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        {/* ── Right: incidents only ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {ph.incidents.length === 0 ? (
            canAddIncident && (
              <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
                onClick={() => onAddIncident(ph.id)}>+ 事件</Button>
            )
          ) : (
            <div>
              {ph.incidents.map((inc) => (
                <div key={inc.id} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: '20px' }}>
                  <span style={{ color: '#999', width: 50, flexShrink: 0 }}>
                    {inc.occurred_at ? inc.occurred_at.slice(5, 10) : '-'}
                  </span>
                  <Tag color="blue" style={{ fontSize: 10, margin: 0, width: 50, flexShrink: 0, textAlign: 'center' }}>
                    {inc.category || '-'}
                  </Tag>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.description}
                  </span>
                </div>
              ))}
              {canAddIncident && (
                <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
                  onClick={() => onAddIncident(ph.id)}>+ 事件</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
