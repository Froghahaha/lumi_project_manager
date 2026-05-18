import { listRoles } from '../api'
import type { RoleDefinition } from '../types'

let _cache: RoleDefinition[] | null = null
let _promise: Promise<RoleDefinition[]> | null = null

export function loadRoles(): Promise<RoleDefinition[]> {
  if (_cache) return Promise.resolve(_cache)
  if (!_promise) {
    _promise = listRoles().then((list) => {
      _cache = list
      _promise = null
      return list
    }).catch((e) => {
      _promise = null
      throw e
    })
  }
  return _promise
}

export function getRoleName(code: string): string {
  if (_cache) {
    const found = _cache.find((r) => r.code === code)
    if (found) return found.name
  }
  return code
}

export function getWorkspaceKey(code: string): string {
  if (_cache) {
    const found = _cache.find((r) => r.code === code)
    if (found) return found.workspace_key
  }
  return ''
}
