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
      if (reason) {
        window.console.log(reason)
      }
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
    return <div className="min-h-screen p-6" style={{ background: '#E8F4FD' }} />
  }

  if (!user || user.role !== 'hospital') return <Navigate to="/hospital/login" />

  return (
    <div className="min-h-screen pb-20" style={{ background: '#E8F4FD' }}>
      <header className="sticky top-0 z-50 border-b p-4 backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 12px rgba(23,43,58,0.07)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl shadow-soft">
               <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">{user.name}</h1>
              <p className="text-xs font-semibold text-slate-500">Inbound ambulance triage & routing control center</p>
            </div>
          </div>
          <button onClick={logout} className="rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-80" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.75)', color: '#607080' }}>
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 p-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl p-6 md:p-8" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.90)', boxShadow: '0 6px 28px rgba(23,43,58,0.10)' }}>
            <div className="mb-6 flex items-center gap-3">
               <div className="p-2 bg-emerald-50 rounded-xl">
                  <Settings2 className="h-6 w-6 text-emerald-500" />
               </div>
               <h2 className="text-xl font-extrabold text-slate-800">Inventory Status</h2>
            </div>

            <form onSubmit={handleInventoryUpdate} className="space-y-4">
              <label className="block text-sm font-bold text-gray-500">
                ICU Beds
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 font-semibold text-lg" value={inventory.icuBeds} onChange={(event) => setInventory({ ...inventory, icuBeds: event.target.value })} />
              </label>
              <label className="block text-sm font-bold text-gray-500">
                Ventilators
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 font-semibold text-lg" value={inventory.ventilators} onChange={(event) => setInventory({ ...inventory, ventilators: event.target.value })} />
              </label>
              <label className="block text-sm font-bold text-gray-500">
                General Beds
                <input type="number" className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 font-semibold text-lg" value={inventory.generalBeds} onChange={(event) => setInventory({ ...inventory, generalBeds: event.target.value })} />
              </label>
              <label className="block text-sm font-bold text-gray-500">
                Specialists
                <input type="text" className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 font-medium" value={inventory.specialists} onChange={(event) => setInventory({ ...inventory, specialists: event.target.value })} />
              </label>
              <button type="submit" disabled={savingInv} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-100 py-3 font-bold text-emerald-800 transition hover:bg-emerald-200">
                {savingInv ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Save Inventory
              </button>
            </form>
          </section>

          <section className="rounded-3xl p-6 md:p-8" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.90)', boxShadow: '0 6px 28px rgba(23,43,58,0.10)' }}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-xl">
                   <BellRing className="h-6 w-6 text-rose-500 pulse-ring" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">Inbound Cases</h2>
              </div>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700 shadow-sm border border-rose-200">{incomingPatients.length} Live</span>
            </div>

            <div className="space-y-3">
              {incomingPatients.length === 0 && <p className="text-sm italic text-gray-500">No incoming emergencies currently.</p>}
              {incomingPatients.map((incident) => (
                <button
                  key={incident._id}
                  onClick={() => setSelectedIncidentId(incident._id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${selectedIncident?._id === incident._id ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Siren className="h-4 w-4 text-rose-600" />
                      <span className="text-sm font-bold text-gray-900">Ambulance inbound</span>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${incident.severityLevel === 'critical' ? 'bg-red-100 text-red-700' : incident.severityLevel === 'watch' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {incident.severityLevel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{incident.symptoms || 'Symptoms pending from ambulance'}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    {incident.assignedAmbulance?.vehicleNumber || 'Ambulance'} | {getStatusGroup(incident)} | {incident.transportStatus}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl p-6 md:p-8" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.90)', boxShadow: '0 6px 28px rgba(23,43,58,0.10)' }}>
            <div className="mb-6 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                   <MapIcon className="h-6 w-6 text-blue-500" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">Live Routing Feed</h2>
            </div>
            <div className="h-[420px] overflow-hidden rounded-xl bg-gray-100">
              <LeafletMap
                origin={selectedIncident ? getIncidentOrigin(selectedIncident) : null}
                destination={hospitalLoc}
                strokeColor="#059669"
                originLabel="A"
                destLabel="H"
                height="420px"
              />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <MapPin className="h-3.5 w-3.5" />
              Route is recalculated from the clicked ambulance card and refreshed from the latest streamed ambulance position.
            </p>
          </section>

          <section className="rounded-3xl p-6 md:p-8" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.90)', boxShadow: '0 6px 28px rgba(23,43,58,0.10)' }}>
            <div className="mb-6 flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-xl">
                   <Activity className="h-6 w-6 text-rose-500" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">Advanced Handoff Panel</h2>
            </div>

            {!selectedIncident ? (
              <p className="text-sm italic text-gray-500">Select an inbound case to view live vitals, symptoms, requirements and specialist needs.</p>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-gray-500">SpO2</p>
                    <p className={`text-xl font-black ${Number(selectedIncident.vitals?.spo2) < 92 ? 'text-red-600' : 'text-gray-900'}`}>{selectedIncident.vitals?.spo2 ?? '--'}%</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-gray-500">Heart Rate</p>
                    <p className="text-xl font-black text-gray-900">{selectedIncident.vitals?.heartRate ?? '--'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-gray-500">Blood Pressure</p>
                    <p className="text-xl font-black text-gray-900">{selectedIncident.vitals?.systolicBP ?? '--'}/{selectedIncident.vitals?.diastolicBP ?? '--'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-gray-500">Status</p>
                    <p className="text-lg font-black text-emerald-700">{selectedIncident.arrivalStatus}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-rose-500" />
                    <h3 className="text-lg font-bold text-gray-900">Patient overview</h3>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Symptoms: {selectedIncident.symptoms || 'Pending symptom update'}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-700">
                    Requirements: ICU {selectedIncident.requirements?.icuBeds || 0}, Ventilators {selectedIncident.requirements?.ventilators || 0}, General beds {selectedIncident.requirements?.generalBeds || 0}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-700">
                    Specialist needs: {selectedIncident.requirements?.specialists?.join(', ') || 'general'}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Ambulance: {selectedIncident.assignedAmbulance?.vehicleNumber || 'Unknown'} {selectedIncident.assignedAmbulance?.type ? `(${selectedIncident.assignedAmbulance.type})` : ''}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Last vitals update: {selectedIncident.vitalsUpdatedAt ? new Date(selectedIncident.vitalsUpdatedAt).toLocaleTimeString() : 'Pending'}
                  </p>
                </div>

                {selectedIncident.rerouteHistory?.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-800">Reroute history</p>
                    {selectedIncident.rerouteHistory.map((entry, index) => (
                      <p key={`${entry.triggeredAt}-${index}`} className="mt-2 text-sm text-amber-700">
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
    </div>
  )
}
