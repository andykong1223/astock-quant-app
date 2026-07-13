const TOKEN_KEY = 'astock_token'
const USER_KEY = 'astock_user'
const REFRESH_KEY = 'astock_refresh'
const CREDS_KEY = 'astock_saved_creds'

function read(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function write(key: string, value: string) {
  localStorage.setItem(key, value)
  sessionStorage.removeItem(key)
}

function remove(key: string) {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

export function getToken() {
  return read(TOKEN_KEY)
}

export function getRefreshToken() {
  return read(REFRESH_KEY)
}

export function getStoredUserRaw() {
  return read(USER_KEY)
}

export function setAuthSession(token: string, userJson: string, refreshToken?: string | null) {
  write(TOKEN_KEY, token)
  write(USER_KEY, userJson)
  if (refreshToken) write(REFRESH_KEY, refreshToken)
  else if (refreshToken === null) remove(REFRESH_KEY)
}

export function setUserRaw(userJson: string) {
  write(USER_KEY, userJson)
}

export function clearAuthSession() {
  remove(TOKEN_KEY)
  remove(USER_KEY)
  remove(REFRESH_KEY)
}

export interface SavedCredentials {
  email: string
  password: string
}

export function loadSavedCredentials(): SavedCredentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedCredentials
    if (!parsed.email || !parsed.password) return null
    return parsed
  } catch {
    return null
  }
}

export function saveCredentials(email: string, password: string) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ email, password }))
}

export function clearSavedCredentials() {
  localStorage.removeItem(CREDS_KEY)
}
