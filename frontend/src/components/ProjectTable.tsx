import { Space, Table, Tag, Typography } from 'antd'
import type { ColumnType, TableProps } from 'antd/es/table'
import { Link } from 'react-router-dom'
import type { Project } from '../types'
import { equipSummary, fmtShortDate } from '../utils/format'
import { PhaseProgress } from './PhaseProgress'

// ─── Column keys ──────────────────────────────────────────────

export type ProjectColumnKey =
  | 'order_no'
  | 'equipment'
  | 'end_customer'
  | 'status'
  | 'payment'
  | 'delivery'
  | 'phases'

// ─── Built-in column renderers ────────────────────────────────

const COLUMN_RENDERERS: Record<ProjectColumnKey, (opts: {
  showPayment: boolean
  endCustomerInline: boolean
}) => ColumnType<Project>> = {
  order_no: () => ({
    title: '项目',
    dataIndex: 'order_no',
    sorter: (a, b) => a.order_no.localeCompare(b.order_no),
    render: (v: string, p) => (
      <Space direction="vertical" size={0}>
        <Link to={`/projects/${p.id}`} style={{ fontWeight: 700 }}>{v}</Link>
        {p.end_customer && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            终端: {p.end_customer}
          </Typography.Text>
        )}
      </Space>
    ),
  }),

  equipment: () => ({
    title: '设备',
    key: 'equipment',
    render: (_, p) => {
      const eq = equipSummary(p.equipment_list)
      return (
        <Space size={4}>
          <Tag>{eq.category}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ×{eq.quantity}
          </Typography.Text>
        </Space>
      )
    },
  }),

  end_customer: () => ({
    title: '终端',
    dataIndex: 'end_customer',
    render: (v: string | null) => v || '-',
  }),

  status: () => ({
    title: '状态',
    key: 'status',
    render: (_, p) => {
      const s = p.project_status || '正常'
      return <Tag color={s === '逾期' ? 'red' : s === '已完成' ? 'green' : 'blue'}>{s}</Tag>
    },
  }),

  payment: ({ showPayment }) => ({
    title: '收款',
    dataIndex: 'contract_payment_progress',
    render: (v: number | null) =>
      v != null
        ? <Tag color={v >= 1 ? 'green' : v >= 0.6 ? 'blue' : 'orange'}>{(v * 100).toFixed(0)}%</Tag>
        : <Typography.Text type="secondary">-</Typography.Text>,
    ...(showPayment ? {} : { className: 'hidden-col' }),
  }),

  delivery: () => ({
    title: '交期',
    key: 'delivery',
    render: (_, p) => fmtShortDate(p.contract_expected_delivery_date),
  }),

  phases: () => ({
    title: '工序',
    key: 'phases',
    render: (_, p) => <PhaseProgress phases={p.phases} mode="compact" maxSteps={5} />,
  }),
}

// ─── Props ────────────────────────────────────────────────────

export interface ProjectTableProps {
  projects: Project[]
  /** Which built-in columns to show, in display order. */
  columns: ProjectColumnKey[]
  /** Workspace-specific columns appended after the built-in ones. */
  extraColumns?: ColumnType<Project>[]
  /** Whether the current user can see the payment column. */
  showPayment?: boolean
  /** Render end_customer inline under project name (in order_no column). */
  endCustomerInline?: boolean
  /** Show end_customer as a standalone column. */
  showEndCustomerColumn?: boolean
  /** Passthrough to antd Table. */
  size?: TableProps<Project>['size']
  pagination?: TableProps<Project>['pagination']
  scroll?: TableProps<Project>['scroll']
  onRow?: TableProps<Project>['onRow']
  rowKey?: TableProps<Project>['rowKey']
}

// ─── Component ────────────────────────────────────────────────

export function ProjectTable({
  projects,
  columns: columnKeys,
  extraColumns = [],
  showPayment = false,
  endCustomerInline = true,
  showEndCustomerColumn = false,
  size = 'small',
  pagination = { pageSize: 15 },
  scroll,
  onRow,
  rowKey = 'id',
}: ProjectTableProps) {
  void showEndCustomerColumn
  const resolvedColumns: ColumnType<Project>[] = []

  for (const key of columnKeys) {
    // When end_customer is inline in order_no, skip the standalone column
    if (key === 'end_customer' && endCustomerInline) continue
    const col = COLUMN_RENDERERS[key]({ showPayment, endCustomerInline })
    // Hide payment column when not permitted
    if (key === 'payment' && !showPayment) continue
    resolvedColumns.push(col)
  }

  // Append extra columns
  for (const ec of extraColumns) {
    resolvedColumns.push(ec)
  }

  return (
    <Table<Project>
      rowKey={rowKey}
      dataSource={projects}
      size={size}
      pagination={pagination}
      scroll={scroll}
      onRow={onRow}
      columns={resolvedColumns}
    />
  )
}
