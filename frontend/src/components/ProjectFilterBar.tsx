/** Project filter bar — status + phase + sort + search. Pairs with useProjectFilter hook. */
import { Input, Segmented, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { PhaseTypeFilter, ProjectFilterData, ProjectFilterActions, ProjectFilterState, StatusFilter } from '../utils/useProjectFilter'

export const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '正常运行中', value: 'normal' },
  { label: '预警', value: 'warn' },
  { label: '逾期', value: 'overdue' },
  { label: '已完成', value: 'completed' },
  { label: '整改', value: 'rectify' },
]

export const PHASE_TYPE_OPTIONS: { label: string; value: PhaseTypeFilter }[] = [
  { label: '全部工序', value: 'all' },
  { label: '机械设计', value: '机械设计' },
  { label: '生产', value: '生产' },
  { label: '调机', value: '调机' },
  { label: '尾款', value: '尾款' },
]

type Props = {
  state: ProjectFilterState & ProjectFilterData
  actions: ProjectFilterActions
  extra?: React.ReactNode
}

export function ProjectFilterBar({ state, actions, extra }: Props) {
  const { statusFilter, phaseTypeFilter, searchText, sortAsc, statusCounts } = state
  const { setStatusFilter, setPhaseTypeFilter, setSearchText, setSortAsc } = actions

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>总筛选：</Typography.Text>
        <Segmented
          size="small"
          options={STATUS_FILTER_OPTIONS.map(o => ({
            ...o,
            label: `${o.label} ${statusCounts[o.value]}`,
          }))}
          value={statusFilter}
          onChange={v => setStatusFilter(v as StatusFilter)}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 4 }}>工序：</Typography.Text>
        <Segmented
          size="small"
          options={PHASE_TYPE_OPTIONS}
          value={phaseTypeFilter}
          onChange={v => setPhaseTypeFilter(v as PhaseTypeFilter)}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 4 }}>排序：</Typography.Text>
        <Segmented
          size="small"
          options={[
            { label: '↓ 新→旧', value: 'desc' },
            { label: '↑ 旧→新', value: 'asc' },
          ]}
          value={sortAsc ? 'asc' : 'desc'}
          onChange={v => setSortAsc(v === 'asc')}
        />
        {extra}
      </div>
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索项目号、合同号、客户名、人员、设备…"
        size="small"
        allowClear
        style={{ maxWidth: 420 }}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
      />
    </div>
  )
}
