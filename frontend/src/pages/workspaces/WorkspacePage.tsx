import { useEffect, useState } from 'react'
import { Card, Spin, Typography } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { loadRoles, getWorkspaceKey } from '../../utils/roles'
import { ExecutionWorkspace } from './ExecutionWorkspace'
import { SupervisorWorkspace } from './SupervisorWorkspace'
import { AfterSalesWorkspace } from './AfterSalesWorkspace'
import { PMWorkspace } from './PMWorkspace'
import { SoftwareWorkspace } from './SoftwareWorkspace'
import { SalesWorkspace } from './SalesWorkspace'
import { AdminWorkspace } from './AdminWorkspace'

const WORKSPACE_COMPONENTS: Record<string, React.ComponentType> = {
  admin: AdminWorkspace,
  supervisor: SupervisorWorkspace,
  after_sales: AfterSalesWorkspace,
  pm: PMWorkspace,
  software: SoftwareWorkspace,
  sales: SalesWorkspace,
  execution: ExecutionWorkspace,
}

export function WorkspacePage() {
  const auth = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadRoles().then(() => setReady(true)).catch(() => setReady(true))
  }, [])

  if (!auth.role) {
    return (
      <Card>
        <Typography.Title level={4}>请选择角色</Typography.Title>
        <Typography.Text type="secondary">
          在页面右上角选择您的角色和人员姓名，工作台将根据您的角色显示相关内容。
        </Typography.Text>
      </Card>
    )
  }

  if (!ready) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
    )
  }

  const wsKey = getWorkspaceKey(auth.role)

  const Comp = WORKSPACE_COMPONENTS[wsKey]
  if (Comp) {
    return <Comp />
  }

  return (
    <Card>
      <Typography.Title level={4}>工作台 - {auth.roleName}</Typography.Title>
      <Typography.Text type="secondary">
        未知工作台类型: {wsKey}
      </Typography.Text>
    </Card>
  )
}
