import { useEffect, useMemo, useState } from 'react'
import { Button, Layout as AntLayout, Menu, Select, Space, Tag, Typography } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listRoles } from '../api'
import type { RoleDefinition } from '../types'

function RoleSelector({ roles }: { roles: RoleDefinition[] }) {
  const auth = useAuth()
  const myRoles = roles.filter((r) => auth.person?.roles.includes(r.code))

  return (
    <Space size={8}>
      <Tag color="blue">{auth.person?.name}</Tag>
      {myRoles.length > 1 ? (
        <Select
          size="small"
          value={auth.role || undefined}
          style={{ width: 140 }}
          onChange={(code) => {
            const r = roles.find((r) => r.code === code)
            if (r) auth.setRole(code, r.name)
          }}
          options={myRoles.map((r) => ({ label: r.name, value: r.code }))}
        />
      ) : (
        <Tag>{auth.roleName || '--'}</Tag>
      )}
      <Button type="text" size="small" style={{ color: 'rgba(255,255,255,0.65)' }} onClick={auth.logout}>
        退出
      </Button>
    </Space>
  )
}

export function Layout() {
  const location = useLocation()
  const auth = useAuth()
  const [roles, setRoles] = useState<RoleDefinition[]>([])

  useEffect(() => {
    listRoles().then(setRoles).catch(() => {})
  }, [])

  const menuItems = useMemo(() => {
    const items = [
      { key: '/workspace', label: <Link to="/workspace">工作台</Link> },
    ]
    if (['admin', 'project_manager', 'sales_assistant', 'tech_supervisor', 'after_sales_super'].includes(auth.role)) {
      items.push({ key: '/projects', label: <Link to="/projects">项目列表</Link> })
    }
    return items
  }, [auth.role])

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/projects')) return '/projects'
    if (location.pathname === '/workspace' || location.pathname === '/') return '/workspace'
    return location.pathname
  }, [location.pathname])

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Sider collapsible width={220} style={{ background: '#001529' }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <Link to="/workspace" style={{ textDecoration: 'none' }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 700 }}>项目管理</Typography.Text>
          </Link>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
        />
      </AntLayout.Sider>

      <AntLayout>
        <AntLayout.Header style={{ display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'flex-end' }}>
          <RoleSelector roles={roles} />
        </AntLayout.Header>
        <AntLayout.Content style={{ padding: 16 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Outlet />
          </div>
        </AntLayout.Content>
      </AntLayout>
    </AntLayout>
  )
}
