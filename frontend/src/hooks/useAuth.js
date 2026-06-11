import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config'

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_URL}/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          setIsAuthenticated(true)
        } else {
          // Token invalid, clear it
          localStorage.removeItem('auth_token')
          setToken(null)
        }
      } catch {
        // Server not reachable, but keep token for retry
        setIsAuthenticated(true) // Optimistic
      }

      setLoading(false)
    }

    verifyToken()
  }, [token])

  const login = useCallback((newToken) => {
    localStorage.setItem('auth_token', newToken)
    setToken(newToken)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    setToken(null)
    setIsAuthenticated(false)
  }, [])

  // Helper to get auth headers for fetch calls
  const getAuthHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [token])

  // Authenticated fetch wrapper
  const authFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...getAuthHeaders(),
      },
    })

    // If 401, logout
    if (res.status === 401) {
      logout()
      throw new Error('Session expired')
    }

    return res
  }, [getAuthHeaders, logout])

  return {
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    getAuthHeaders,
    authFetch,
  }
}

export default useAuth
