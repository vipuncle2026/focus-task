/**
 * API client for Focus Task backend.
 * Handles snake_case ↔ camelCase conversion transparently.
 */
import type { Task } from '@/stores/taskStore'
import { loadAuthState } from '@/utils/secureStorage'

export interface UserAccount {
  id: number
  username: string
  isAdmin: boolean
  disabled: boolean
  createdAt: string
  taskCount: number
}

// ─── API base URL ───
// Tauri desktop: always localhost (local process)
// Browser (LAN access): use window.location.hostname so LAN clients reach the backend
// Override via VITE_API_BASE env if needed
const isTauri = '__TAURI_INTERNALS__' in window
const dynamicHost = isTauri ? '127.0.0.1' : window.location.hostname
const API_BASE = import.meta.env.VITE_API_BASE || `http://${dynamicHost}:8765`
const LOCAL_BACKEND = /^http:\/\/(127\.0\.0\.1|localhost):8765$/.test(API_BASE)
const STARTUP_RETRY_DELAYS = [150, 250, 400, 650, 1000, 1500]

export function buildApiUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  // Docker's web image uses /api as its proxy base while endpoint paths also
  // start with /api. Avoid producing routes such as /api/api/auth/login.
  if (normalizedBase.endsWith('/api') && (normalizedPath === '/api' || normalizedPath.startsWith('/api/'))) {
    return `${normalizedBase}${normalizedPath.slice(4)}`
  }

  return `${normalizedBase}${normalizedPath}`
}

// ─── Case conversion ───
function toSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnake)
  if (obj && typeof obj === 'object') {
    const out: any = {}
    for (const key of Object.keys(obj)) {
      const snake = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
      out[snake] = toSnake(obj[key])
    }
    return out
  }
  return obj
}

function toCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamel)
  if (obj && typeof obj === 'object') {
    const out: any = {}
    for (const key of Object.keys(obj)) {
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      out[camel] = toCamel(obj[key])
    }
    return out
  }
  return obj
}

function formatApiError(err: any): string {
  const detail = err?.detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : ''
    const message = typeof first?.msg === 'string' ? first.msg : ''

    if (field === 'password' && message.includes('at least')) {
      const minLengthMatch = message.match(/at least (\d+)/)
      const minLength = minLengthMatch?.[1]
      return minLength ? `密码至少需要 ${minLength} 个字符` : '密码长度不符合要求'
    }

    if (field === 'username' && message.includes('at least')) {
      return '用户名至少需要 2 个字符'
    }

    return message || '请求参数不正确'
  }

  if (typeof detail === 'string' && detail.trim()) {
    return translateApiMessage(detail)
  }

  return translateApiMessage(err?.message || '请求失败')
}

function translateApiMessage(message: string): string {
  const normalized = message.trim()
  const lower = normalized.toLowerCase()

  if (lower === 'not authenticated' || lower.includes('could not validate credentials')) {
    return '登录状态已失效，请重新登录'
  }
  if (lower.includes('invalid credentials')) {
    return '用户名或密码不正确'
  }
  if (lower.includes('user account is disabled')) {
    return '该账号已被禁用，请联系管理员'
  }
  if (lower.includes('admin privileges required')) {
    return '当前账号没有管理员权限'
  }
  if (lower.includes('username already registered')) {
    return '用户名已被注册'
  }
  if (lower.includes('user not found')) {
    return '用户不存在'
  }
  if (lower.includes('cannot disable your own account')) {
    return '不能禁用当前登录账号'
  }
  if (lower.includes('cannot remove your own admin privileges')) {
    return '不能取消当前账号的管理员权限'
  }
  if (lower.includes('cannot delete your own account')) {
    return '不能删除当前登录账号'
  }
  if (lower.includes('at least one active admin is required')) {
    return '至少需要保留一个可用的管理员账号'
  }
  if (lower.includes('task not found')) {
    return '任务不存在'
  }
  if (lower.includes('task with this client_id already exists')) {
    return '任务已存在'
  }

  return normalized || '请求失败'
}

// ─── HTTP helpers ───
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithStartupRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: unknown
  const delays = LOCAL_BACKEND ? STARTUP_RETRY_DELAYS : []

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fetch(url, options)
    } catch (err) {
      lastError = err
      if (attempt === delays.length) break
      await sleep(delays[attempt])
    }
  }

  throw lastError
}

async function request(method: string, path: string, body?: any): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = (await loadAuthState()).token
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetchWithStartupRetry(buildApiUrl(API_BASE, path), {
      method,
      headers,
      body: body ? JSON.stringify(toSnake(body)) : undefined,
    })
  } catch {
    throw new Error(`无法连接 Focus Task 后端服务（${API_BASE}）。如果刚打开 App，请稍等几秒后重试；也请检查本机端口是否被其它应用占用。`)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(formatApiError(err) || res.statusText)
  }
  const data = await res.json()
  return toCamel(data)
}

// ─── Auth API ───
export async function register(username: string, password: string) {
  return request('POST', '/api/auth/register', { username, password })
}

export async function login(username: string, password: string): Promise<{ accessToken: string }> {
  return request('POST', '/api/auth/login', { username, password })
}

export async function getMe() {
  return request('GET', '/api/auth/me')
}

// ─── User Admin API ───
export async function listUsers(): Promise<UserAccount[]> {
  return request('GET', '/api/users')
}

export async function updateUser(userId: number, updates: { isAdmin?: boolean; disabled?: boolean }): Promise<UserAccount> {
  return request('PATCH', `/api/users/${userId}`, updates)
}

export async function resetUserPassword(userId: number, password: string): Promise<void> {
  return request('POST', `/api/users/${userId}/reset-password`, { password })
}

export async function deleteUser(userId: number): Promise<{ ok: boolean; deletedTasks: number }> {
  return request('DELETE', `/api/users/${userId}`)
}

// ─── Task API ───
export async function listTasks(includeDeleted = false): Promise<Task[]> {
  return request('GET', `/api/tasks?include_deleted=${includeDeleted}`)
}

export async function createTask(task: Partial<Task> & { clientId: string }): Promise<Task> {
  return request('POST', '/api/tasks', task)
}

export async function getTask(taskId: number): Promise<Task> {
  return request('GET', `/api/tasks/${taskId}`)
}

export async function updateTask(taskId: number, updates: Partial<Task>): Promise<Task> {
  return request('PATCH', `/api/tasks/${taskId}`, updates)
}

export async function deleteTask(taskId: number): Promise<void> {
  return request('DELETE', `/api/tasks/${taskId}`)
}

export async function reorderTasks(items: { clientId: string; sortOrder: number }[]): Promise<void> {
  return request('POST', '/api/tasks/reorder', { items })
}

// ─── Sync API ───
export async function syncPush(tasks: Partial<Task>[]): Promise<Task[]> {
  return request('POST', '/api/tasks/sync/push', { tasks })
}

export async function syncPull(since?: string): Promise<Task[]> {
  return request('POST', '/api/tasks/sync/pull', { since })
}
