import { Card, Typography } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { ExecutionWorkspace } from './ExecutionWorkspace'
import { SupervisorWorkspace } from './SupervisorWorkspace'
import { AfterSalesWorkspace } from './AfterSalesWorkspace'
import { PMWorkspace } from './PMWorkspace'
import { SoftwareWorkspace } from './SoftwareWorkspace'
import { SalesWorkspace } from './SalesWorkspace'
import { AdminWorkspace } from './AdminWorkspace'

const WORKSPACE_MAP: Record<string, React.ComponentType> = {
  mechanical_designer: ExecutionWorkspace,
  production_executor: ExecutionWorkspace,
  tuning_executor: ExecutionWorkspace,
  tech_supervisor: SupervisorWorkspace,
  after_sales_super: AfterSalesWorkspace,
  project_manager: PMWorkspace,
  software_designer: SoftwareWorkspace,
  sales_assistant: SalesWorkspace,
  admin: AdminWorkspace,
}

export function WorkspacePage() {
  const auth = useAuth()

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

  const Comp = WORKSPACE_MAP[auth.role]
  if (Comp) {
    return <Comp />
  }

  return (
    <Card>
      <Typography.Title level={4}>工作台 - {auth.roleName}</Typography.Title>
      <Typography.Text type="secondary">
        未知角色类型: {auth.role}
      </Typography.Text>
    </Card>
  )
}
