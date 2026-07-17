import { describe, expect, it } from 'vitest'

import { buildApiUrl } from './index'

describe('buildApiUrl', () => {
  it('does not duplicate the API prefix for the Docker web proxy', () => {
    expect(buildApiUrl('/api', '/api/auth/login')).toBe('/api/auth/login')
  })

  it('keeps the API prefix when connecting directly to the backend', () => {
    expect(buildApiUrl('http://localhost:8765', '/api/auth/login')).toBe(
      'http://localhost:8765/api/auth/login',
    )
  })

  it('normalizes boundary slashes', () => {
    expect(buildApiUrl('https://example.com/api/', 'api/health')).toBe(
      'https://example.com/api/health',
    )
  })
})
