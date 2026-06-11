/**
 * API utility with automatic auth headers
 */

import { API_URL } from '../config'

// Get auth token from localStorage
const getToken = () => localStorage.getItem('auth_token')

// Get auth headers
export const getAuthHeaders = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Authenticated fetch wrapper
export const apiFetch = async (url, options = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  })

  // If 401, redirect to login
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.reload()
    throw new Error('Session expired')
  }

  return res
}

// GET request
export const apiGet = async (url) => {
  const res = await apiFetch(url)
  return res.json()
}

// POST request
export const apiPost = async (url, data) => {
  const res = await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.json()
}

// PUT request
export const apiPut = async (url, data) => {
  const res = await apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.json()
}

// DELETE request
export const apiDelete = async (url) => {
  const res = await apiFetch(url, { method: 'DELETE' })
  return res.json()
}

export default { apiFetch, apiGet, apiPost, apiPut, apiDelete, getAuthHeaders }
