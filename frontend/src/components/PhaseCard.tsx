import { useState } from 'react'
import { Button, Card, DatePicker, Image, Popconfirm, Space, Tag, Typography } from 'antd'
import { CaretRightOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import zhCNDatePicker from 'antd/es/date-picker/locale/zh_CN'
import dayjs from 'dayjs'
import { getIncidentImageUrl } from '../api'
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
  const [incidentsOpen, setIncidentsOpen] = useState(false)
  const tagProps = phaseStatusTagProps(ph)
  const days = phaseDaysDisplay(ph)
  const isActiveRectify = ph.is_rectify && !ph.actual_end_date

  const executor = ph.responsible
    || project.assignments.find((a) => a.phase_id === ph.id)?.person_name
    || '未指定'

  return (
    <Card
      size="small" type="inner"
      style={{
        marginBottom: 8,
        borderColor: isActiveRectify ? COLOR.warning : undefined,
        borderWidth: isActiveRectify ? 2 : 1,
      }}
      styles={{ body: { padding: '6px 12px' } }}
    >
      {/* ── Row 1: metadata bar ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Phase identity */}
        <span style={{ whiteSpace: 'nowrap' }}>
          {ph.is_rectify && <ExclamationCircleOutlined style={{ color: COLOR.warning, marginRight: 4 }} />}
          <Tag color={tagProps.color} style={{ margin: 0 }}>
            {ph.is_rectify
              ? `整改${ph.sub_name ? ` - ${ph.sub_name}` : ''}`
              : `${ph.phase_name}${ph.sub_name ? ` - ${ph.sub_name}` : ''}`}
            : {tagProps.text}
          </Tag>
        </span>

        {/* Executor */}
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
          <Typography.Text style={{ color: '#1677ff', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap' }}>
            {executor}
          </Typography.Text>
        )}

        {/* Status selector */}
        {canUpdateStatus && <PhaseStatusSelect phase={ph} size="small" />}

        {/* Spacer */}
        <span style={{ flex: 1, minWidth: 0 }} />

        {/* Dates + countdown */}
        {canEditDates && editingDates ? (
          <Space size={4}>
            <DatePicker size="small" locale={zhCNDatePicker} style={{ width: 110 }} placeholder="开始"
              value={ph.start_date ? dayjs(ph.start_date) : null}
              onChange={(d) => { onEditPhase?.(ph.id, 'start_date', d?.format('YYYY-MM-DD') ?? null); setEditingDates(false) }} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>→</Typography.Text>
            <DatePicker size="small" locale={zhCNDatePicker} style={{ width: 110 }} placeholder="计划完成"
              value={ph.planned_end_date ? dayjs(ph.planned_end_date) : null}
              onChange={(d) => { onEditPhase?.(ph.id, 'planned_end_date', d?.format('YYYY-MM-DD') ?? null); setEditingDates(false) }} />
            <Button size="small" type="text" onClick={() => setEditingDates(false)} style={{ padding: 0, fontSize: 11 }}>取消</Button>
          </Space>
        ) : (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, cursor: canEditDates ? 'pointer' : undefined, whiteSpace: 'nowrap' }}
            onClick={canEditDates ? () => setEditingDates(true) : undefined}
          >
            {ph.start_date ? dayjs(ph.start_date).format('MM-DD') : canEditDates ? '设日期' : ''}
            {ph.start_date && ph.planned_end_date ? ` → ${dayjs(ph.planned_end_date).format('MM-DD')}` : ph.planned_end_date ? dayjs(ph.planned_end_date).format('MM-DD') : ''}
            {days ? <span style={{ color: days.color, fontWeight: 600, marginLeft: 6 }}>{days.text}</span> : null}
          </Typography.Text>
        )}

        {/* Completion date */}
        {ph.actual_end_date && (
          <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
            完成 {dayjs(ph.actual_end_date).format('MM-DD')}
          </Tag>
        )}

        {/* Delete */}
        {canDelete && (
          <Popconfirm title="确认删除?" onConfirm={() => onDeletePhase(ph.id)}>
            <Button danger size="small" type="text" style={{ padding: 0, fontSize: 11, flexShrink: 0 }}>删除</Button>
          </Popconfirm>
        )}
      </div>

      {/* ── Row 2: incidents (collapsible) ────────────────── */}
      {ph.incidents.length > 0 || canAddIncident ? (
        <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 6, paddingTop: 4 }}>
          {ph.incidents.length > 0 ? (
            <div>
              <Button
                type="text"
                size="small"
                icon={<CaretRightOutlined rotate={incidentsOpen ? 90 : 0} />}
                style={{ padding: '0 4px', fontSize: 12, height: 22 }}
                onClick={() => setIncidentsOpen(!incidentsOpen)}
              >
                事件 ({ph.incidents.length})
              </Button>
              {canAddIncident && (
                <Button type="link" size="small" style={{ padding: '0 4px', fontSize: 12 }}
                  onClick={() => onAddIncident(ph.id)}>+ 添加</Button>
              )}

              {incidentsOpen && (
                <div style={{ marginTop: 4, paddingLeft: 4 }}>
                  {ph.incidents.map((inc) => (
                    <div key={inc.id} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: '20px' }}>
                        <span style={{ color: '#999', width: 48, flexShrink: 0 }}>
                          {inc.occurred_at ? inc.occurred_at.slice(5, 10) : '-'}
                        </span>
                        <Tag color="blue" style={{ fontSize: 10, margin: 0, width: 48, flexShrink: 0, textAlign: 'center' }}>
                          {inc.category || '-'}
                        </Tag>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inc.description}
                        </span>
                      </div>
                      {inc.image_urls && inc.image_urls.length > 0 && (
                        <div style={{ marginTop: 4, marginLeft: 56, display: 'flex', gap: 4 }}>
                          {inc.image_urls.map((url, i) => (
                            <Image
                              key={i}
                              src={getIncidentImageUrl(url)}
                              width={48}
                              height={48}
                              style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                              preview={{ mask: '查看' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            canAddIncident && (
              <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
                onClick={() => onAddIncident(ph.id)}>+ 事件</Button>
            )
          )}
        </div>
      ) : null}
    </Card>
  )
}
