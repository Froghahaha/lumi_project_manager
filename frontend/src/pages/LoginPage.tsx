import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, Select, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { login, listPersons } from '../api'
import { useAuth } from '../contexts/AuthContext'
import type { Person } from '../types'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [persons, setPersons] = useState<Person[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initLoading, setInitLoading] = useState(true)

  useEffect(() => {
    listPersons()
      .then(setPersons)
      .catch(() => {})
      .finally(() => setInitLoading(false))
  }, [])

  async function handleLogin() {
    if (!selectedName) { setError('请选择人员'); return }
    if (!password) { setError('请输入密码'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await login(selectedName, password)
      auth.login(res)
      message.success(`欢迎, ${res.person.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
    }
    setLoading(false)
  }

  // Navigate when auth state changes to logged in
  useEffect(() => {
    if (auth.isLoggedIn) {
      navigate('/workspace', { replace: true })
    }
  }, [auth.isLoggedIn, navigate])

  // Person groups by department
  const grouped = persons.reduce<Record<string, Person[]>>((acc, p) => {
    const dept = p.department || '其他'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(p)
    return acc
  }, {})

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{ width: 400, borderRadius: 12 }}
        styles={{ body: { padding: 32 } }}
      >
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          项目管理登录
        </Typography.Title>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}

        <div style={{ marginBottom: 16 }}>
          <Typography.Text style={{ display: 'block', marginBottom: 6 }}>选择人员</Typography.Text>
          <Select
            size="large"
            style={{ width: '100%' }}
            placeholder="请选择您的姓名"
            showSearch
            loading={initLoading}
            value={selectedName}
            onChange={setSelectedName}
            filterOption={(input, option) => (option?.label as string || '').includes(input)}
            options={Object.entries(grouped).map(([dept, ps]) => ({
              label: dept,
              options: ps.map((p) => ({ label: p.name, value: p.name })),
            }))}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Typography.Text style={{ display: 'block', marginBottom: 6 }}>密码</Typography.Text>
          <Input.Password
            size="large"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin}
          />
        </div>

        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          onClick={handleLogin}
        >
          登录
        </Button>
      </Card>
    </div>
  )
}
