import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoginResponse, Person } from '../types'
import { getMyPermissions } from '../api'
import { loadRoles, getRoleName } from '../utils/roles'

export type AuthState = {
  person: Person | null
  token: string
  role: string
  roleName: string
  isLoggedIn: boolean
  can: Record<string, boolean>
  login: (res: LoginResponse) => void
  logout: () => void
  setRole: (code: string, name: string) => void
  hasPermission: (key: string) => boolean
  refreshPermissions: () => Promise<void>
}

const EMPTY: AuthState = {
  person: null,
  token: '',
  role: '',
  roleName: '',
  isLoggedIn: false,
  can: {},
  login: () => {},
  logout: () => {},
  setRole: () => {},
  hasPermission: () => false,
  refreshPermissions: async () => {},
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
  const [can, setCan] = useState<Record<string, boolean>>({})

  const isLoggedIn = !!person && !!token

  useEffect(() => { loadRoles() }, [])

  const refreshPermissions = useCallback(async () => {
    if (!token) { setCan({}); return }
    try {
      const perms = await getMyPermissions()
      setCan(perms)
    } catch { setCan({}) }
  }, [token])

  // On mount, if already logged in, fetch permissions
  useEffect(() => {
    if (isLoggedIn) refreshPermissions()
  }, [isLoggedIn, refreshPermissions])

  const hasPermission = useCallback((key: string) => {
    return !!can[key]
  }, [can])

  const login = useCallback((res: LoginResponse) => {
    setPerson(res.person)
    setToken(res.token)
    const rc = res.person.role_code || ''
    setRoleRaw(rc)
    const name = getRoleName(rc)
    setRoleName(name)
    saveAuth(res.person, res.token, rc, name)
    // Permissions will be fetched by the useEffect triggered by isLoggedIn
  }, [])

  const logout = useCallback(() => {
    setPerson(null)
    setToken('')
    setRoleRaw('')
    setRoleName('')
    setCan({})
    try { localStorage.removeItem('lumi_auth') } catch { /* ignore */ }
  }, [])

  const setRole = useCallback((code: string, name: string) => {
    setRoleRaw(code)
    setRoleName(name)
    saveAuth(person, token, code, name)
  }, [person, token])

  // Refresh permissions when role changes
  useEffect(() => {
    if (isLoggedIn && role) {
      refreshPermissions()
    }
  }, [role, isLoggedIn, refreshPermissions])

  const value = useMemo(() => ({
    person, token, role, roleName, isLoggedIn, can,
    login, logout, setRole, hasPermission, refreshPermissions,
  }), [person, token, role, roleName, isLoggedIn, can, login, logout, setRole, hasPermission, refreshPermissions])

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
