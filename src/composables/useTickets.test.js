import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const addDocMock = vi.fn().mockResolvedValue({ id: 'ticket-1' })
const updateDocMock = vi.fn().mockResolvedValue(undefined)
const deleteDocMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../services/firebase.js', () => ({ db: {}, auth: {} }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection-ref'),
  onSnapshot: vi.fn(() => () => {}),
  addDoc: (...args) => addDocMock(...args),
  doc: vi.fn(() => 'doc-ref'),
  updateDoc: (...args) => updateDocMock(...args),
  deleteDoc: (...args) => deleteDocMock(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn(() => 'query-ref'),
  orderBy: vi.fn(),
}))

vi.mock('./useAuth.js', () => ({
  useAuth: () => ({ isAdmin: ref(false) }),
}))

describe('useTickets', () => {
  beforeEach(() => {
    addDocMock.mockClear()
    updateDocMock.mockClear()
    deleteDocMock.mockClear()
  })

  it('counts only tickets that are not closed', async () => {
    const { useTickets, tickets } = await importTickets()
    const { openCount } = useTickets()
    tickets.value = [
      { id: '1', status: 'open' },
      { id: '2', status: 'closed' },
      { id: '3', status: 'open' },
    ]
    expect(openCount.value).toBe(2)
  })

  it('submits a ticket with a default title and truncated diagnostic fields', async () => {
    const { useTickets } = await importTickets()
    const { submitTicket } = useTickets()

    await submitTicket({ description: 'Le lien ne fonctionne pas' })

    expect(addDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload.title).toBe('')
    expect(payload.description).toBe('Le lien ne fonctionne pas')
    expect(payload.status).toBe('open')
    expect(payload.createdAt).toBe('SERVER_TIMESTAMP')
    expect(payload.pageUrl.length).toBeLessThanOrEqual(500)
    expect(payload.userAgent.length).toBeLessThanOrEqual(300)
  })

  it('updates only the status field', async () => {
    const { useTickets } = await importTickets()
    const { updateTicketStatus } = useTickets()

    await updateTicketStatus('ticket-1', 'closed')

    expect(updateDocMock).toHaveBeenCalledWith('doc-ref', { status: 'closed' })
  })

  it('deletes a ticket by id', async () => {
    const { useTickets } = await importTickets()
    const { deleteTicket } = useTickets()

    await deleteTicket('ticket-1')

    expect(deleteDocMock).toHaveBeenCalledWith('doc-ref')
  })
})

// useTickets.js holds module-level singleton state (the `tickets` ref itself
// isn't exported), so each test resets the module registry and re-imports to
// start from a clean slate instead of leaking ticket data between tests.
async function importTickets() {
  vi.resetModules()
  const mod = await import('./useTickets.js')
  const { tickets } = mod.useTickets()
  return { useTickets: mod.useTickets, tickets }
}
