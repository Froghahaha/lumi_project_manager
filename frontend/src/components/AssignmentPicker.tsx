import { useState } from 'react'
import { Button, message, Select, Tag, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { addAssignment, listPersons, removeAssignment } from '../api'
import type { Person } from '../types'

type AssignmentItem = { id: string; person_name: string }

type Props = {
  projectId: string
  roleCode: string
  roleName: string
  phaseId: string | null
  assignments: AssignmentItem[]
  onChange: () => void
  size?: 'small' | 'middle'
}

export function AssignmentPicker({ projectId, roleCode, roleName, phaseId, assignments, onChange, size = 'small' }: Props) {
  const [adding, setAdding] = useState(false)
  const [candidates, setCandidates] = useState<Person[]>([])

  async function startAdd() {
    setAdding(true)
    try { setCandidates(await listPersons(roleCode)) } catch { setCandidates([]) }
  }

  async function handleSelect(personName: string) {
    if (!personName) return
    try {
      await addAssignment(projectId, { person_name: personName, role_code: roleCode, phase_id: phaseId })
      onChange()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
    setAdding(false)
  }

  async function handleRemove(assignmentId: string) {
    try {
      await removeAssignment(projectId, assignmentId)
      onChange()
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <Typography.Text style={{ minWidth: 70, color: '#666', fontSize: 12 }}>{roleName}:</Typography.Text>
      {assignments.map((a) => (
        <Tag key={a.id} closable onClose={() => handleRemove(a.id)} color="blue" style={{ fontSize: 11, margin: 0 }}>
          {a.person_name}
        </Tag>
      ))}
      {adding ? (
        <Select
          size={size}
          autoFocus
          style={{ width: 110 }}
          placeholder="选人"
          showSearch
          filterOption={(input, option) => (option?.label as string || '').includes(input)}
          options={candidates.map((p) => ({ label: p.name, value: p.name }))}
          onChange={handleSelect}
          onBlur={() => setAdding(false)}
        />
      ) : (
        <Button size={size} type="dashed" icon={<PlusOutlined />} style={{ fontSize: 11, height: 22 }}
          onClick={startAdd} />
      )}
    </div>
  )
}
