<script setup>
import { inject } from 'vue'
import { useTickets } from '../../composables/useTickets.js'

const t = inject('t')
const { tickets, updateTicketStatus, deleteTicket } = useTickets()

const statuses = ['open', 'in_progress', 'closed']

// Identifiant court affiché à l'écran (l'id Firestore complet reste
// consultable via l'attribut title au survol).
const shortId = (id) => id.slice(0, 6)

const formatDate = (createdAt) => {
  if (!createdAt?.toDate) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(createdAt.toDate())
}

const confirmDelete = async (ticket) => {
  if (!confirm(t('tickets.confirmDelete'))) return
  await deleteTicket(ticket.id)
}
</script>

<template>
  <div class="tickets">
    <h2>{{ t('tickets.title') }}</h2>
    <p v-if="tickets.length === 0" class="empty">{{ t('tickets.empty') }}</p>
    <ul v-else>
      <li v-for="ticket in tickets" :key="ticket.id" :class="'status-' + ticket.status">
        <div class="ticket-header">
          <span class="ticket-id" :title="ticket.id">#{{ shortId(ticket.id) }}</span>
          <span class="ticket-date">{{ formatDate(ticket.createdAt) }}</span>
        </div>
        <p v-if="ticket.title" class="ticket-title">{{ ticket.title }}</p>
        <p class="ticket-description">{{ ticket.description }}</p>
        <p v-if="ticket.pageUrl" class="ticket-meta" :title="ticket.userAgent">{{ ticket.pageUrl }}</p>
        <div class="ticket-actions">
          <select :value="ticket.status" @change="updateTicketStatus(ticket.id, $event.target.value)">
            <option v-for="s in statuses" :key="s" :value="s">{{ t('tickets.status.' + s) }}</option>
          </select>
          <button type="button" class="delete-button" @click="confirmDelete(ticket)">{{ t('tickets.delete') }}</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tickets {
  min-width: 400px;
  max-width: 100%;
}

h2 {
  color: var(--red-esigelec);
  text-align: center;
  margin-bottom: 20px;
}

.empty {
  color: var(--gray-dark);
  text-align: center;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

li {
  border: 2px solid var(--gray-white-light);
  border-left-width: 5px;
  border-radius: 8px;
  padding: 10px 12px;
}

li.status-open {
  border-left-color: var(--red-esigelec);
}

li.status-in_progress {
  border-left-color: var(--blue-ia);
}

li.status-closed {
  border-left-color: #2e7d32;
  opacity: 0.75;
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  color: var(--gray-dark);
  margin-bottom: 6px;
}

.ticket-id {
  font-weight: 700;
}

.ticket-title {
  margin: 0 0 4px 0;
  font-weight: 700;
  color: var(--gray-dark);
}

.ticket-description {
  margin: 0;
  color: var(--gray-dark);
  white-space: pre-wrap;
}

.ticket-meta {
  margin: 6px 0 0 0;
  font-size: 0.75em;
  color: var(--gray-white-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.ticket-actions select {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 2px solid var(--gray-white-light);
  font-size: 0.85em;
}

.delete-button {
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.85em;
  font-weight: bold;
  cursor: pointer;
  background-color: transparent;
  color: var(--red-esigelec);
  border: 2px solid var(--red-esigelec);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.delete-button:hover {
  background-color: var(--red-esigelec);
  color: var(--white);
}
</style>
