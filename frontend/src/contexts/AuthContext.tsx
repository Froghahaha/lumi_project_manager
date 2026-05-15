import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoginResponse, Person } from '../types'

export type AuthState = {
  person: Person | null
  token: string
  role: string
  roleName: string
  isLoggedIn: boolean
  login: (res: LoginResponse) => void
  logout: () => void
  setRole: (code: string, name: string) => void
}

const EMPTY: AuthState = {
  person: null,
  token: '',
  role: '',
  roleName: '',
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
  setRole: () => {},
}

const AuthContext = createContext<AuthState>(EMPTY)

function loadAuth(): { person: Person | null; token: string; role: string; roleName: string } {
  try {
    const raw = localStorage.getItem('lumi_auth')
    if (raw) {
      const data = JSON.parse(raw)
      return {
        person: data.person ?? null,
        token: data.token ?? '',
        role: data.role ?? '',
        roleName: data.roleName ?? '',
      }
    }
  } catch { /* ignore */ }
  return { person: null, token: '', role: '', roleName: '' }
}

function saveAuth(person: Person | null, token: string, role: string, roleName: string) {
  try {
    localStorage.setItem('lumi_auth', JSON.stringify({ person, token, role, roleName }))
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<Person | null>(() => loadAuth().person)
  const [token, setToken] = useState(() => loadAuth().token)
  const [role, setRoleRaw] = useState(() => loadAuth().role)
  const [roleName, setRoleName] = useState(() => loadAuth().roleName)

  const isLoggedIn = !!person && !!token

  const login = useCallback((res: LoginResponse) => {
    setPerson(res.person)
    setToken(res.token)
    // Auto-select first role if available
    const firstRole = res.person.roles[0] || ''
    setRoleRaw(firstRole)
    const roleMap: Record<string, string> = {
      admin: '超级管理员',
      tech_supervisor: '技术主管',
      after_sales_super: '售后主管',
      project_manager: '项目经理',
      sales_assistant: '销售助理',
      mechanical_designer: '机械设计执行人',
      software_designer: '软件设计执行人',
      production_executor: '生产执行人',
      tuning_executor: '安调执行人',
    }
    setRoleName(roleMap[firstRole] || firstRole)
    saveAuth(res.person, res.token, firstRole, roleMap[firstRole] || firstRole)
  }, [])

  const logout = useCallback(() => {
    setPerson(null)
    setToken('')
    setRoleRaw('')
    setRoleName('')
    try { localStorage.removeItem('lumi_auth') } catch { /* ignore */ }
  }, [])

  const setRole = useCallback((code: string, name: string) => {
    setRoleRaw(code)
    setRoleName(name)
    saveAuth(person, token, code, name)
  }, [person, token])

  const value = useMemo(() => ({
    person, token, role, roleName, isLoggedIn,
    login, logout, setRole,
  }), [person, token, role, roleName, isLoggedIn, login, logout, setRole])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function getStoredAuth() {
  const { person, token, role } = loadAuth()
  return {
    person: person?.name || '',
    role: role || '',
    token,
  }
}
