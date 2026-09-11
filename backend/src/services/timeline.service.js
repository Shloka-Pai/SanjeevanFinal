const TIMELINE_LABELS = {
  ambulance_called: 'Ambulance called',
  ambulance_dispatched: 'Ambulance dispatched',
  en_route_hospital: 'En route to hospital',
  hospital_selected: 'Hospital selected',
  rerouted: 'Rerouted to another hospital',
  arrived_er: 'Arrived at ER',
  er_handover: 'ER handover completed',
}

function pushTimelineEvent(incident, type, meta = {}) {
  if (!incident.timelineEvents) {
    incident.timelineEvents = []
  }

  const alreadyLogged = incident.timelineEvents.some(
    (event) => event.type === type && type !== 'rerouted' && type !== 'hospital_selected',
  )

  // Allow multiple hospital_selected / rerouted events; skip duplicates for one-shot milestones
  if (alreadyLogged && type !== 'hospital_selected' && type !== 'rerouted') {
    return incident
  }

  incident.timelineEvents.push({
    type,
    label: TIMELINE_LABELS[type] || type,
    at: new Date(),
    meta: meta && typeof meta === 'object' ? meta : {},
  })

  return incident
}

function formatTime(date) {
  if (!date) return 'unknown time'
  try {
    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return String(date)
  }
}

/**
 * Build a citizen-facing timeline. Prefers stored timelineEvents;
 * falls back to inferred milestones from status fields for older incidents.
 */
function buildCitizenTimeline(incident) {
  const events = Array.isArray(incident.timelineEvents) ? [...incident.timelineEvents] : []

  if (events.length === 0) {
    events.push({
      type: 'ambulance_called',
      label: TIMELINE_LABELS.ambulance_called,
      at: incident.createdAt,
      meta: { aidType: incident.aidType },
    })

    if (incident.status === 'assigned' || incident.status === 'completed' || incident.assignedAmbulance) {
      events.push({
        type: 'ambulance_dispatched',
        label: TIMELINE_LABELS.ambulance_dispatched,
        at: incident.updatedAt || incident.createdAt,
        meta: {},
      })
    }

    if (['en-route', 'rerouted', 'arriving', 'completed'].includes(incident.transportStatus)) {
      events.push({
        type: 'en_route_hospital',
        label: TIMELINE_LABELS.en_route_hospital,
        at: incident.updatedAt || incident.createdAt,
        meta: {
          hospital: incident.assignedHospital?.name || incident.selectedHospital?.name,
        },
      })
    }

    if (Array.isArray(incident.rerouteHistory)) {
      incident.rerouteHistory.forEach((entry) => {
        events.push({
          type: 'rerouted',
          label: TIMELINE_LABELS.rerouted,
          at: entry.triggeredAt || incident.updatedAt,
          meta: { reason: entry.reason },
        })
      })
    }

    if (incident.arrivalStatus === 'arrived' || incident.transportStatus === 'arriving' || incident.transportStatus === 'completed') {
      events.push({
        type: 'arrived_er',
        label: TIMELINE_LABELS.arrived_er,
        at: incident.updatedAt || incident.createdAt,
        meta: {},
      })
    }

    if (incident.status === 'completed' || incident.transportStatus === 'completed') {
      events.push({
        type: 'er_handover',
        label: TIMELINE_LABELS.er_handover,
        at: incident.updatedAt || incident.createdAt,
        meta: {},
      })
    }
  }

  return events
    .map((event) => ({
      type: event.type,
      label: event.label || TIMELINE_LABELS[event.type] || event.type,
      at: event.at,
      atFormatted: formatTime(event.at),
      meta: event.meta || {},
    }))
    .sort((a, b) => new Date(a.at) - new Date(b.at))
}

function describeTripPhase(incident) {
  if (incident.status === 'completed' || incident.transportStatus === 'completed') {
    return 'ER handover completed — trip finished'
  }
  if (incident.arrivalStatus === 'arrived' || incident.transportStatus === 'arriving') {
    return 'Arrived at ER — awaiting / completing handover'
  }
  if (incident.transportStatus === 'rerouted') {
    return 'Rerouted — heading to a different hospital'
  }
  if (incident.transportStatus === 'en-route' || incident.arrivalStatus === 'incoming') {
    return 'En route to hospital'
  }
  if (incident.status === 'assigned' || incident.transportStatus === 'dispatching') {
    return 'Ambulance dispatched — preparing transport'
  }
  if (incident.status === 'pending' || incident.transportStatus === 'awaiting-acceptance') {
    return 'Ambulance called — waiting for an ambulance to accept'
  }
  return 'Status updating'
}

function buildTripContextSummary(incident) {
  const timeline = buildCitizenTimeline(incident)
  const ambulance = incident.assignedAmbulance
  const hospital = incident.assignedHospital || incident.selectedHospital

  const lines = [
    `Current phase: ${describeTripPhase(incident)}`,
    `Incident status: ${incident.status}`,
    `Transport status: ${incident.transportStatus || 'n/a'}`,
    `Arrival status: ${incident.arrivalStatus || 'n/a'}`,
    `Aid type: ${incident.aidType}`,
    `Ambulance called at: ${formatTime(incident.createdAt)}`,
    `Ambulance: ${ambulance?.vehicleNumber || 'Not assigned yet'}${ambulance?.type ? ` (${ambulance.type})` : ''}`,
    `Hospital: ${hospital?.name || 'Not assigned yet'}`,
    `Severity: ${incident.severityLevel || 'unknown'}`,
    '',
    'Timeline milestones:',
    ...timeline.map((event, index) => {
      const extra = event.meta?.hospital
        ? ` → ${event.meta.hospital}`
        : event.meta?.reason
          ? ` (${event.meta.reason})`
          : event.meta?.vehicleNumber
            ? ` → ${event.meta.vehicleNumber}`
            : ''
      return `${index + 1}. ${event.label} — ${event.atFormatted}${extra}`
    }),
  ]

  if (incident.description) {
    lines.push('', `Report notes: ${incident.description}`)
  }

  return {
    timeline,
    phase: describeTripPhase(incident),
    summaryText: lines.join('\n'),
  }
}

module.exports = {
  TIMELINE_LABELS,
  pushTimelineEvent,
  buildCitizenTimeline,
  buildTripContextSummary,
  describeTripPhase,
  formatTime,
}
