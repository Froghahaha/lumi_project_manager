import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoginResponse, Person } from '../types'
import { loadRoles, getRoleName } from '../utils/roles'

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

  useEffect(() => { loadRoles() }, [])

  const login = useCallback((res: LoginResponse) => {
    setPerson(res.person)
    setToken(res.token)
    const firstRole = res.person.roles[0] || ''
    setRoleRaw(firstRole)
    const name = getRoleName(firstRole)
    setRoleName(name)
    saveAuth(res.person, res.token, firstRole, name)
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
