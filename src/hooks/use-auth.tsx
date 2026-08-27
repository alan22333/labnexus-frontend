import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { authApi, clearToken, getToken, setToken } from "@/lib/api"
import type { User } from "@/lib/types"

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (inviteCode: string, username: string, displayName: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((u: User) => setUserState(u), [])

  // 启动时若有 token,拉取当前用户
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const { user } = await authApi.me()
        if (!cancelled) setUserState(user)
      } catch {
        clearToken()
        if (!cancelled) setUserState(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { access_token, user } = await authApi.login({ username, password })
    setToken(access_token)
    setUserState(user)
  }, [])

  const register = useCallback(async (inviteCode: string, username: string, displayName: string, password: string) => {
    const { access_token, user } = await authApi.register({
      invite_code: inviteCode,
      username,
      display_name: displayName,
      password,
    })
    setToken(access_token)
    setUserState(user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // 忽略登出接口错误,本地照常清理
    }
    clearToken()
    setUserState(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout, setUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth 必须在 <AuthProvider> 内使用")
  return ctx
}
