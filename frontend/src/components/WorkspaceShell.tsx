import type { ReactNode } from 'react'
import { Alert, Space, Spin, Tag, Typography } from 'antd'
import { useAuth } from '../contexts/AuthContext'

export function WorkspaceShell({
  extra,
  loading,
  error,
  children,
}: {
  extra?: ReactNode
  loading: boolean
  error: string | null
  children: ReactNode
}) {
  const auth = useAuth()
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          工作台 - {auth.roleName}
        </Typography.Title>
        <Space size={8}>
          <Tag color="blue">{auth.person?.name || ''}</Tag>
          {extra}
        </Space>
      </Space>
      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        children
      )}
    </Space>
  )
}
