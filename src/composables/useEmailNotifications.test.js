import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('@emailjs/browser', () => ({
  default: { send: (...args) => sendMock(...args) },
}))

// La notification en échec journalise l'erreur via useErrorLogs (Firestore) :
// mocké ici pour ne pas dépendre d'un vrai backend dans ce test unitaire.
const logErrorMock = vi.fn()
vi.mock('./useErrorLogs.js', () => ({
  useErrorLogs: () => ({ logError: (...args) => logErrorMock(...args) }),
}))

describe('useEmailNotifications', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue(undefined)
    logErrorMock.mockReset()
    vi.resetModules()
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service-id')
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template-id')
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends one email per contact with the hide-info link', async () => {
    const { useEmailNotifications } = await import('./useEmailNotifications.js')
    const { notifyContacts } = useEmailNotifications()

    const contacts = [
      { id: 'c1', firstName: 'Ada', lastName: 'Lovelace', role: 'CTO', email: 'ada@example.com', hideToken: 'tok1' },
      { id: 'c2', firstName: 'Alan', lastName: 'Turing', role: 'CEO', email: 'alan@example.com', hideToken: 'tok2' },
    ]

    await notifyContacts(contacts, 'Acme', 'company-1')

    expect(sendMock).toHaveBeenCalledTimes(2)
    const [serviceId, templateId, payload, options] = sendMock.mock.calls[0]
    expect(serviceId).toBe('service-id')
    expect(templateId).toBe('template-id')
    expect(payload.to_email).toBe('ada@example.com')
    expect(payload.to_name).toBe('Ada Lovelace')
    expect(payload.company_name).toBe('Acme')
    expect(payload.hide_url).toContain('hideContact=company-1:c1:tok1')
    expect(options).toEqual({ publicKey: 'public-key' })
  })

  it('does not throw when a single contact fails to send', async () => {
    sendMock.mockRejectedValueOnce(new Error('network error'))
    const { useEmailNotifications } = await import('./useEmailNotifications.js')
    const { notifyContacts } = useEmailNotifications()

    await expect(notifyContacts(
      [{ id: 'c1', firstName: 'Ada', lastName: 'Lovelace', role: 'CTO', email: 'ada@example.com', hideToken: 'tok1' }],
      'Acme',
      'company-1'
    )).resolves.toBeUndefined()
    expect(logErrorMock).toHaveBeenCalledTimes(1)
  })

  it('skips sending when EmailJS is not configured', async () => {
    vi.resetModules()
    // Stubbed to empty rather than unstubbed: a local .env with real
    // EmailJS credentials would otherwise leak through and defeat this case.
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '')
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '')
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '')
    const { useEmailNotifications } = await import('./useEmailNotifications.js')
    const { notifyContacts } = useEmailNotifications()

    await notifyContacts(
      [{ id: 'c1', firstName: 'Ada', lastName: 'Lovelace', role: 'CTO', email: 'ada@example.com', hideToken: 'tok1' }],
      'Acme',
      'company-1'
    )

    expect(sendMock).not.toHaveBeenCalled()
  })
})
