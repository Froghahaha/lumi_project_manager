import { useMemo } from 'react'
import { Button, Layout as AntLayout, Menu, Space, Tag, Typography } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function RoleSelector() {
  const auth = useAuth()

  return (
    <Space size={8}>
      <Tag color="blue">{auth.person?.name}</Tag>
      <Tag>{auth.roleName || '--'}</Tag>
      <Button type="text" size="small" style={{ color: 'rgba(255,255,255,0.65)' }} onClick={auth.logout}>
        退出
      </Button>
    </Space>
  )
}

export function Layout() {
  const location = useLocation()
  const auth = useAuth()
  const menuItems = useMemo(() => {
    const items = [
      { key: '/workspace', label: <Link to="/workspace">工作台</Link> },
    ]
    if (auth.hasPermission('view_project_list_page')) {
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
          <RoleSelector />
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
