import { describe, it, expect, vi, beforeEach } from 'vitest'

const addDocMock = vi.fn().mockResolvedValue({ id: 'log-1' })

vi.mock('../services/firebase.js', () => ({ db: {}, auth: {} }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  addDoc: (...args) => addDocMock(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}))

describe('useErrorLogs', () => {
  beforeEach(() => {
    addDocMock.mockReset()
    addDocMock.mockResolvedValue({ id: 'log-1' })
  })

  it('logs an Error with its message, stack, code and truncated diagnostic fields', async () => {
    const { useErrorLogs } = await import('./useErrorLogs.js')
    const { logError } = useErrorLogs()

    const error = new Error('Missing or insufficient permissions.')
    error.code = 'permission-denied'

    await logError(error, 'addCompanyForm:submit')

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload.message).toBe('Missing or insufficient permissions.')
    expect(payload.code).toBe('permission-denied')
    expect(payload.context).toBe('addCompanyForm:submit')
    expect(payload.stack).toContain('Error: Missing or insufficient permissions.')
    expect(payload.createdAt).toBe('SERVER_TIMESTAMP')
    expect(payload.pageUrl.length).toBeLessThanOrEqual(500)
    expect(payload.userAgent.length).toBeLessThanOrEqual(300)
  })

  it('falls back to a generic message and omits code for a non-Error value', async () => {
    const { useErrorLogs } = await import('./useErrorLogs.js')
    const { logError } = useErrorLogs()

    await logError('just a string reason', 'window:unhandledrejection')

    const [, payload] = addDocMock.mock.calls[0]
    expect(payload.message).toBe('just a string reason')
    expect(payload).not.toHaveProperty('code')
    expect(payload.stack).toBe('')
  })

  it('does not throw when the Firestore write itself fails', async () => {
    addDocMock.mockRejectedValueOnce(new Error('network error'))
    const { useErrorLogs } = await import('./useErrorLogs.js')
    const { logError } = useErrorLogs()

    await expect(logError(new Error('original error'), 'context')).resolves.toBeUndefined()
  })
})
