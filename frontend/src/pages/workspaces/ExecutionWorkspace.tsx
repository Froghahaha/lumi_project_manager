import { useEffect, useState } from 'react'
import {
  Alert,
  Card,
  Space,
  Typography,
  Tag,
  Spin,
  Empty,
  Button,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listProjects } from '../../api'
import { PhaseStatusSelect } from '../../components/PhaseStatusSelect'
import type { Project } from '../../types'

const ROLE_PHASE_SEQ: Record<string, number> = {
  mechanical_designer: 1,
  production_executor: 2,
  tuning_executor: 3,
}

function fmtDate(d: string | null) {
  if (!d) return '-'
  return d.slice(0, 10)
}

export function ExecutionWorkspace() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const p = await listProjects({
          assigned_person: auth.person?.name || undefined,
          role_code: auth.role,
        })
        setProjects(p)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setLoading(false)
    }
    if (auth.person?.name) load()
  }, [auth.person?.name, auth.role])

  const targetSeq = ROLE_PHASE_SEQ[auth.role] || 0

  // 每个项目过滤出当前角色负责的工序，和前一工序
  const projectData = projects.map((proj) => {
    const allPhases = [...proj.phases].sort((a, b) => a.seq - b.seq)
    const myPhase = allPhases.find((ph) => ph.seq === targetSeq)
    const prevPhase = auth.role === 'production_executor'
      ? allPhases.find((ph) => ph.seq === 1)
      : null
    return { project: proj, myPhase, prevPhase }
  }).filter((d) => d.myPhase) // 只显示有当前角色负责工序的项目

  if (!auth.person?.name) {
    return (
      <Card>
        <Typography.Title level={4}>工作台 - {auth.roleName}</Typography.Title>
        <Empty description="请在右上角选择您的姓名以查看任务" />
      </Card>
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          工作台 - {auth.roleName}
        </Typography.Title>
        <Tag color="blue">{auth.person?.name || ''}</Tag>
      </Space>

      {error ? <Alert type="error" showIcon message="请求失败" description={error} /> : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : projectData.length === 0 ? (
        <Empty description="暂无分配给您的任务" />
      ) : (
        projectData.map(({ project: proj, myPhase, prevPhase }) => (
          <Card
            key={myPhase!.id}
            size="small"
            title={
              <Space>
                <Typography.Text strong style={{ fontSize: 15 }}>
                  {proj.order_no}
                </Typography.Text>
                <Tag color={proj.is_abnormal ? 'red' : 'default'}>
                  {myPhase!.phase_name}{myPhase!.sub_name ? ` - ${myPhase!.sub_name}` : ''}
                </Tag>
                <PhaseStatusSelect phase={myPhase!} />
              </Space>
            }
            extra={
              <Button
                size="small"
                type="link"
                onClick={() => navigate(`/projects/${proj.id}`)}
              >
                项目详情
              </Button>
            }
          >
            <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 13 }}>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>交期</Typography.Text>
                <div style={{ fontWeight: 600, color: proj.contract_expected_delivery_date && new Date() > new Date(proj.contract_expected_delivery_date) ? 'red' : undefined }}>
                  {fmtDate(proj.contract_expected_delivery_date)}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>工序时间</Typography.Text>
                <div>{fmtDate(myPhase!.start_date)} → {fmtDate(myPhase!.planned_end_date)}</div>
              </div>
              {myPhase!.actual_end_date && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>实际完成</Typography.Text>
                  <div>{fmtDate(myPhase!.actual_end_date)}</div>
                </div>
              )}
            </div>

            {prevPhase && (
              <Tag color="blue" style={{ marginBottom: 8 }}>
                前一工序: {prevPhase.phase_name} - {prevPhase.status || '未开始'}
              </Tag>
            )}

            {myPhase!.incidents && myPhase!.incidents.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  事件 ({myPhase!.incidents.length}):
                </Typography.Text>
                <div style={{ marginTop: 4 }}>
                  {myPhase!.incidents.slice(0, 3).map((inc) => (
                    <div key={inc.id} style={{ fontSize: 12, color: '#666', paddingLeft: 8 }}>
                      {inc.occurred_at ? inc.occurred_at.slice(0, 10) : '-'} [{inc.category}] {inc.description.slice(0, 50)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))
      )}
    </Space>
  )
}
