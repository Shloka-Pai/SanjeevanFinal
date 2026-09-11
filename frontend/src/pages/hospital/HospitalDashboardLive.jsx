import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import {
  Activity,
  BellRing,
  Building2,
  HeartPulse,
  Loader2,
  Map as MapIcon,
  MapPin,
  Save,
  Settings2,
  Siren,
  BedDouble,
} from 'lucide-react'
import LeafletMap from '../../components/LeafletMap'

function mergeIncident(list, incident) {
  const next = [incident, ...list.filter((item) => item._id !== incident._id)]
  return next.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
}

function getIncidentOrigin(incident) {
  return incident?.ambulanceLocation || incident?.location || null
}

function getStatusGroup(incident) {
  if (incident.status === 'completed' || incident.arrivalStatus === 'arrived') return 'completed'
  if (incident.arrivalStatus === 'incoming' || incident.transportStatus === 'arriving') return 'arriving'
  return 'pending'
}

export default function HospitalDashboardLive() {
  const { user, loading: authLoading, API_URL, logout } = useAuth()
  const [inventory, setInventory] = useState({
    icuBeds: user?.inventory?.icuBeds ?? 0,
    ventilators: user?.inventory?.ventilators ?? 0,
    generalBeds: user?.inventory?.generalBeds ?? 0,
    specialists: Array.isArray(user?.inventory?.specialists) ? user.inventory.specialists.join(', ') : '',
  })
  const [savingInv, setSavingInv] = useState(false)
  const [incomingPatients, setIncomingPatients] = useState([])
  const [selectedIncidentId, setSelectedIncidentId] = useState(null)
  const hospitalId = user?.id || user?._id
  const hospitalLoc = user?.location || { lat: 18.5204, lng: 73.8567 }
  const selectedIncident = useMemo(
    () => incomingPatients.find((incident) => incident._id === selectedIncidentId) || incomingPatients[0] || null,
    [incomingPatients, selectedIncidentId],
  )

  const arrivingCount = incomingPatients.filter((i) => getStatusGroup(i) === 'arriving').length
  const criticalCount = incomingPatients.filter((i) => i.severityLevel === 'critical').length

  useEffect(() => {
    const hydrateCases = async () => {
      try {
        const response = await axios.get(`${API_URL}/hospital/dashboard-cases`)
        setIncomingPatients(response.data.incidents || [])
      } catch (error) {
        console.error('Failed to load hospital dashboard cases', error)
      }
    }

    hydrateCases()
  }, [API_URL])

  useEffect(() => {
    if (user?.inventory) {
      setInventory({
        icuBeds: user.inventory.icuBeds ?? 0,
        ventilators: user.inventory.ventilators ?? 0,
        generalBeds: user.inventory.generalBeds ?? 0,
        specialists: Array.isArray(user.inventory.specialists) ? user.inventory.specialists.join(', ') : '',
      })
    }
  }, [user])

  useEffect(() => {
    if (!hospitalId) return undefined

    const socket = io('http://localhost:3000', { withCredentials: true })
    socket.emit('join', `hospital_${hospitalId}`)

    socket.on('incoming_patient', ({ incident }) => {
      setIncomingPatients((prev) => mergeIncident(prev, incident))
      setSelectedIncidentId(incident._id)
    })

    socket.on('patient_vitals_update', ({ incident }) => {
      setIncomingPatients((prev) => mergeIncident(prev, incident))
    })

    socket.on('patient_rerouted', ({ incident, reason }) => {
      setIncomingPatients((prev) => mergeIncident(prev, incident))
      setSelectedIncidentId(incident._id)
      if (reason) window.console.log(reason)
    })

    socket.on('patient_arrived', ({ incident }) => {
      setIncomingPatients((prev) => mergeIncident(prev, incident))
      setSelectedIncidentId(incident._id)
    })

    socket.on('patient_rerouted_away', ({ incident }) => {
      setIncomingPatients((prev) => prev.filter((item) => item._id !== incident._id))
    })

    return () => socket.disconnect()
  }, [hospitalId])

  const handleInventoryUpdate = async (event) => {
    event.preventDefault()
    setSavingInv(true)

    try {
      await axios.put(`${API_URL}/hospital/inventory`, {
        inventory: {
          icuBeds: Number(inventory.icuBeds),
          ventilators: Number(inventory.ventilators),
          generalBeds: Number(inventory.generalBeds),
          specialists: inventory.specialists.split(',').map((item) => item.trim()).filter(Boolean),
        },
      })
    } catch (error) {
      alert('Failed updating inventory.')
    } finally {
      setSavingInv(false)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-[#f4f7f9]" />
  }

  if (!user || user.role !== 'hospital') return <Navigate to="/hospital/login" />

  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f5c5a] text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">{user.name}</h1>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                  Hospital portal
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Sanjeevan · Inbound triage, bed capacity & ER handoff
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live operations
            </div>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Inbound cases', value: incomingPatients.length, icon: BellRing, tone: 'text-rose-600 bg-rose-50' },
            { label: 'Arriving / at ER', value: arrivingCount, icon: Siren, tone: 'text-amber-600 bg-amber-50' },
            { label: 'Critical acuity', value: criticalCount, icon: Activity, tone: 'text-rose-700 bg-rose-50' },
            { label: 'ICU beds free', value: inventory.icuBeds, icon: BedDouble, tone: 'text-teal-700 bg-teal-50' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                <div className={`rounded-xl p-2 ${metric.tone}`}>
                  <metric.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{metric.value}</p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5">
                  <Settings2 className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Capacity & inventory</h2>
                  <p className="text-xs text-slate-500">Keep ER resources accurate for ambulance routing</p>
                </div>
              </div>

              <form onSubmit={handleInventoryUpdate} className="space-y-4">
                {[
                  { label: 'ICU beds', key: 'icuBeds' },
                  { label: 'Ventilators', key: 'ventilators' },
                  { label: 'General beds', key: 'generalBeds' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">{field.label}</label>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg font-bold text-slate-900 outline-none ring-[#0f5c5a] focus:bg-white focus:ring-2"
                      value={inventory[field.key]}
                      onChange={(event) => setInventory({ ...inventory, [field.key]: event.target.value })}
                    />
                  </div>
                ))}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Specialists on duty</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-900 outline-none ring-[#0f5c5a] focus:bg-white focus:ring-2"
                    value={inventory.specialists}
                    onChange={(event) => setInventory({ ...inventory, specialists: event.target.value })}
                    placeholder="trauma, cardiology, neurology"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingInv}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f5c5a] py-3.5 text-sm font-bold text-white transition hover:bg-[#0c4c4a]"
                >
                  {savingInv ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Save inventory
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-rose-50 p-2.5">
                    <BellRing className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Inbound queue</h2>
                    <p className="text-xs text-slate-500">Select a case to open handoff details</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {incomingPatients.length} live
                </span>
              </div>

              <div className="space-y-3">
                {incomingPatients.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No incoming ambulances right now.
                  </div>
                )}
                {incomingPatients.map((incident) => (
                  <button
                    key={incident._id}
                    onClick={() => setSelectedIncidentId(incident._id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedIncident?._id === incident._id
                        ? 'border-[#0f5c5a] bg-teal-50/60 ring-2 ring-[#0f5c5a]/15'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Siren className="h-4 w-4 text-rose-600" />
                        <span className="text-sm font-bold text-slate-900">Ambulance inbound</span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                          incident.severityLevel === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : incident.severityLevel === 'watch'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {incident.severityLevel || 'stable'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {incident.symptoms || 'Symptoms pending from ambulance'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {incident.assignedAmbulance?.vehicleNumber || 'Ambulance'} · {getStatusGroup(incident)} · {incident.transportStatus || 'En route'}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-sky-50 p-2.5">
                  <MapIcon className="h-5 w-5 text-sky-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Live routing</h2>
                  <p className="text-xs text-slate-500">Ambulance position to your facility</p>
                </div>
              </div>
              <div className="h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <LeafletMap
                  origin={selectedIncident ? getIncidentOrigin(selectedIncident) : null}
                  destination={hospitalLoc}
                  strokeColor="#0f5c5a"
                  originLabel="A"
                  destLabel="H"
                  height="420px"
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-[#0f5c5a]" />
                Route updates from the selected inbound case and latest streamed ambulance coordinates.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-rose-50 p-2.5">
                  <Activity className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">ER handoff panel</h2>
                  <p className="text-xs text-slate-500">Vitals, requirements and specialist prep</p>
                </div>
              </div>

              {!selectedIncident ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Select an inbound case to view live vitals and preparation needs.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-500">SpO2</p>
                      <p className={`text-xl font-bold ${Number(selectedIncident.vitals?.spo2) < 92 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {selectedIncident.vitals?.spo2 ?? '--'}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Heart rate</p>
                      <p className="text-xl font-bold text-slate-900">{selectedIncident.vitals?.heartRate ?? '--'} bpm</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Blood pressure</p>
                      <p className="text-xl font-bold text-slate-900">
                        {selectedIncident.vitals?.systolicBP ?? '--'}/{selectedIncident.vitals?.diastolicBP ?? '--'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Arrival</p>
                      <p className="text-lg font-bold text-teal-700">{selectedIncident.arrivalStatus || 'En route'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <HeartPulse className="h-5 w-5 text-rose-500" />
                      <h3 className="text-base font-bold text-slate-900">Patient overview</h3>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      Symptoms: {selectedIncident.symptoms || 'Pending symptom update'}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Requirements: ICU {selectedIncident.requirements?.icuBeds || 0}, Ventilators {selectedIncident.requirements?.ventilators || 0}, General beds {selectedIncident.requirements?.generalBeds || 0}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Specialist needs: {selectedIncident.requirements?.specialists?.join(', ') || 'general'}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Ambulance: {selectedIncident.assignedAmbulance?.vehicleNumber || 'Unknown'} {selectedIncident.assignedAmbulance?.type ? `(${selectedIncident.assignedAmbulance.type})` : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Last vitals update: {selectedIncident.vitalsUpdatedAt ? new Date(selectedIncident.vitalsUpdatedAt).toLocaleTimeString() : 'Pending'}
                    </p>
                  </div>

                  {selectedIncident.rerouteHistory?.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-bold text-amber-900">Reroute history</p>
                      {selectedIncident.rerouteHistory.map((entry, index) => (
                        <p key={`${entry.triggeredAt}-${index}`} className="mt-2 text-sm text-amber-800">
                          {entry.reason} at {new Date(entry.triggeredAt).toLocaleTimeString()}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
