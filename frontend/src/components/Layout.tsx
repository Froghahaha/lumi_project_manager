import { Layout as AntLayout, Menu, Typography } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'

export function Layout() {
  const location = useLocation()

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Sider collapsible width={220} style={{ background: '#001529' }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Typography.Text style={{ color: '#fff', fontWeight: 700 }}>项目管理</Typography.Text>
          </Link>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[
            { key: '/', label: <Link to="/">仪表盘</Link> },
            { key: '/projects', label: <Link to="/projects">项目列表</Link> },
          ]}
        />
      </AntLayout.Sider>

      <AntLayout>
        <AntLayout.Header style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <Typography.Text style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
            
          </Typography.Text>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginLeft: 'auto' }}>
            X-User: demo
          </Typography.Text>
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
