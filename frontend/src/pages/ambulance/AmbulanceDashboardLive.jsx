import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import {
  Activity,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  ChevronRight,
  HeartPulse,
  MapPin,
  Navigation,
  Radio,
  Route,
  Stethoscope,
  Thermometer,
  Wind,
  Droplets,
} from 'lucide-react'
import LeafletMap from '../../components/LeafletMap'

const initialVitals = {
  heartRate: 86,
  systolicBP: 122,
  diastolicBP: 81,
  spo2: 98,
  temperature: 98.6,
  symptoms: '',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function buildRandomVitals(currentVitals, severityLevel) {
  const trend = severityLevel === 'critical' ? -1 : severityLevel === 'watch' ? 0 : 1
  return {
    ...currentVitals,
    heartRate: clamp(Number(currentVitals.heartRate) + Math.round((Math.random() - (trend > 0 ? 0.5 : trend < 0 ? 0.3 : 0.45)) * 6), 48, 145),
    systolicBP: clamp(Number(currentVitals.systolicBP) + Math.round((Math.random() - (trend > 0 ? 0.5 : trend < 0 ? 0.3 : 0.45)) * 6), 86, 140),
    diastolicBP: clamp(Number(currentVitals.diastolicBP) + Math.round((Math.random() - (trend > 0 ? 0.5 : trend < 0 ? 0.3 : 0.45)) * 4), 56, 95),
    spo2: clamp(Number(currentVitals.spo2) + Math.round((Math.random() - (trend > 0 ? 0.5 : trend < 0 ? 0.3 : 0.45)) * 2), 90, 100),
    temperature: Number(clamp(Number(currentVitals.temperature) + (Math.random() - 0.48) * 0.2, 97.4, 101.5).toFixed(1)),
  }
}

function normalizeHospital(hospital, fallbackOptions = []) {
  if (!hospital) return null
  if (hospital.hospitalId) return hospital
  const matchedOption = fallbackOptions.find(
    (option) => option.hospitalId === hospital._id || option.hospitalId === hospital.id,
  )
  return {
    hospitalId: hospital._id || hospital.id,
    name: hospital.name,
    status: hospital.status,
    location: hospital.location,
    availableResources: hospital.inventory || matchedOption?.availableResources,
    distanceKm: matchedOption?.distanceKm,
    capabilityScore: matchedOption?.capabilityScore,
    matchesAllRequirements: matchedOption?.matchesAllRequirements,
    isBestMatch: matchedOption?.isBestMatch,
  }
}

function ensureStringList(value, fallback = []) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item))
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return fallback
}

export default function AmbulanceDashboardLive() {
  const { user, loading: authLoading, API_URL, API_ORIGIN, logout } = useAuth()
  const ambulanceUserId = user?.id || user?._id || null
  const [incidents, setIncidents] = useState([])
  const [activeIncident, setActiveIncident] = useState(null)
  const [vitals, setVitals] = useState(initialVitals)
  const [hospitalOptions, setHospitalOptions] = useState([])
  const [selectedHospital, setSelectedHospital] = useState(null)
  const [bestHospital, setBestHospital] = useState(null)
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [routeAlert, setRouteAlert] = useState('')
  const [recentIncidents, setRecentIncidents] = useState([])
  const [ambulanceLocation, setAmbulanceLocation] = useState(user?.location || null)
  const vitalsRef = useRef(initialVitals)
  const activeIncidentRef = useRef(null)
  const ambulanceLocationRef = useRef(user?.location || null)

  const mapOrigin = useMemo(
    () => activeIncident?.ambulanceLocation || ambulanceLocation || activeIncident?.location || { lat: 18.5204, lng: 73.8567 },
    [activeIncident, ambulanceLocation],
  )
  const rankedBestHospital = useMemo(
    () => hospitalOptions.find((option) => option.isBestMatch) || bestHospital || null,
    [bestHospital, hospitalOptions],
  )
  const alternativeHospitals = useMemo(
    () => hospitalOptions.filter((option) => option.hospitalId !== rankedBestHospital?.hospitalId),
    [hospitalOptions, rankedBestHospital],
  )

  useEffect(() => { activeIncidentRef.current = activeIncident }, [activeIncident])
  useEffect(() => { vitalsRef.current = vitals }, [vitals])
  useEffect(() => { ambulanceLocationRef.current = ambulanceLocation }, [ambulanceLocation])

  const resetMissionState = () => {
    activeIncidentRef.current = null
    vitalsRef.current = initialVitals
    setActiveIncident(null)
    setVitals(initialVitals)
    setHospitalOptions([])
    setBestHospital(null)
    setSelectedHospital(null)
    setRouteAlert('')
    setStreaming(false)
  }

  const syncMissionState = (incident, fallbackHospital = null) => {
    if (!incident) { resetMissionState(); return }
    const nextVitals = incident.vitals || initialVitals
    const nextHospitalOptions = incident.hospitalOptions || []
    const normalizedAssignedHospital = normalizeHospital(
      fallbackHospital || incident.assignedHospital || incident.selectedHospital,
      nextHospitalOptions,
    )
    activeIncidentRef.current = incident
    vitalsRef.current = nextVitals
    setActiveIncident(incident)
    setVitals(nextVitals)
    setHospitalOptions(nextHospitalOptions)
    setSelectedHospital(normalizedAssignedHospital)
    setBestHospital(nextHospitalOptions.find((option) => option.isBestMatch) || normalizedAssignedHospital)
  }

  useEffect(() => {
    if (!user) return
    const hydrate = async () => {
      try {
        const [pendingRes, activeRes] = await Promise.all([
          axios.get(`${API_URL}/ambulance/incidents/pending`),
          axios.get(`${API_URL}/ambulance/incidents/active`),
        ])
        setIncidents(pendingRes.data.incidents || [])
        setRecentIncidents(activeRes.data.recentIncidents || [])
        if (activeRes.data.incident) syncMissionState(activeRes.data.incident)
      } catch (error) {
        console.error('Failed to load ambulance dashboard state', error)
      }
    }
    hydrate()
  }, [API_URL, user?.id, user?._id])

  useEffect(() => {
    if (!navigator.geolocation) return undefined
    const syncLocation = async (position) => {
      const location = {
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
      }
      setAmbulanceLocation(location)
      try {
        await axios.put(`${API_URL}/ambulance/location`, { location })
      } catch (error) {
        console.error('Failed updating ambulance location', error)
      }
    }
    navigator.geolocation.getCurrentPosition(syncLocation, () => {}, { enableHighAccuracy: true })
    const watchId = navigator.geolocation.watchPosition(syncLocation, () => {}, { enableHighAccuracy: true, distanceFilter: 10 })
    return () => navigator.geolocation.clearWatch(watchId)
  }, [API_URL])

  useEffect(() => {
    if (!ambulanceUserId) return undefined
    const socket = io(API_ORIGIN, { withCredentials: true })
    socket.emit('join', `ambulance_${ambulanceUserId}`)

    socket.on('incident_created', (data) => {
      if (data?.incident) {
        setIncidents((prev) => [data.incident, ...prev.filter((item) => item._id !== data.incident._id)])
      }
    })

    socket.on('ambulance_accepted', (data) => {
      if (data?.incident) {
        setIncidents((prev) => prev.filter((item) => item._id !== data.incident._id))
        syncMissionState(data.incident)
      }
    })

    socket.on('patient_rerouted', ({ incident, reason }) => {
      if (incident?._id === activeIncidentRef.current?._id) {
        syncMissionState(incident, incident.assignedHospital)
        setRouteAlert(reason || 'Patient rerouted due to hospital inventory limits.')
      }
    })

    return () => socket.disconnect()
  }, [ambulanceUserId, API_ORIGIN])

  useEffect(() => {
    if (!activeIncident?._id) return undefined
    const interval = setInterval(async () => {
      const currentAcc = activeIncidentRef.current
      if (!currentAcc?._id) return
      setStreaming(true)
      const next = buildRandomVitals(vitalsRef.current, currentAcc.severityLevel)
      vitalsRef.current = next
      setVitals(next)

      try {
        const response = await axios.post(`${API_URL}/ambulance/stream-vitals`, {
          incidentId: currentAcc._id,
          vitals: next,
          ambulanceLocation: ambulanceLocationRef.current,
        })
        if (response.data?.incident) {
          const updated = response.data.incident
          setActiveIncident(updated)
          activeIncidentRef.current = updated

          if (response.data.rerouted && response.data.newHospital) {
            const nextHospital = normalizeHospital(response.data.newHospital, updated.hospitalOptions || [])
            setSelectedHospital(nextHospital)
            setRouteAlert(response.data.reason || 'Auto-rerouted: Assigned hospital can no longer handle patient vitals.')
          }
        }
      } catch (error) {
        console.error('Failed streaming vitals to backend', error)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [API_URL, activeIncident?._id])

  const handleAccept = async (incident) => {
    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/ambulance/accept-incident`, { incidentId: incident._id })
      setIncidents((prev) => prev.filter((item) => item._id !== incident._id))
      syncMissionState(response.data.incident)
    } catch (error) {
      alert('Failed accepting request.')
    } finally {
      setLoading(false)
    }
  }

  const handleVitalsSubmit = async (event) => {
    event.preventDefault()
    if (!activeIncident) return
    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/ambulance/rank-hospitals`, {
        incidentId: activeIncident._id,
        vitals,
        symptoms: vitals.symptoms,
      })

      const updatedIncident = response.data.incident
      const options = response.data.hospitalOptions || []
      const recommended = response.data.recommendedHospital || options.find((opt) => opt.isBestMatch) || null
      setActiveIncident(updatedIncident)
      activeIncidentRef.current = updatedIncident
      setHospitalOptions(options)
      setBestHospital(recommended)
      if (recommended) handleSelectHospital(recommended.hospitalId, updatedIncident, options)
    } catch (error) {
      alert('Failed to rank hospitals.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHospital = async (hospitalId, incident = activeIncident, options = hospitalOptions) => {
    if (!incident?._id) return
    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/ambulance/select-hospital`, {
        incidentId: incident._id,
        hospitalId,
      })

      const updatedIncident = response.data.incident
      const targetHospital = options.find((opt) => opt.hospitalId === hospitalId) || response.data.assignedHospital
      const normalizedTarget = normalizeHospital(targetHospital, options)
      setActiveIncident(updatedIncident)
      activeIncidentRef.current = updatedIncident
      setSelectedHospital(normalizedTarget)
      setRouteAlert('')
    } catch (error) {
      alert('Failed selecting hospital.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkArrival = async () => {
    try {
      setLoading(true)
      await axios.post(`${API_URL}/ambulance/mark-arrival`, { incidentId: activeIncident._id })
      setRouteAlert('Patient marked as arrived. Hospital dashboard now has the full inbound handoff.')
    } catch (error) {
      alert('Failed to mark arrival.')
    } finally {
      setLoading(false)
    }
  }

  const resetMission = async () => {
    if (!activeIncident) { resetMissionState(); return }
    try {
      setLoading(true)
      await axios.post(`${API_URL}/ambulance/complete-incident`, { incidentId: activeIncident._id })
      resetMissionState()
    } catch (err) {
      console.error('Failed to complete incident on backend', err)
      alert('Failed to clear mission. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading && !user) {
    return <div className="min-h-screen bg-[#f4f7f9]" />
  }

  if (!user || user.role !== 'ambulance') return <Navigate to="/ambulance/login" replace />

  return (
    <div className="min-h-screen bg-[#f4f7f9] pb-16 text-slate-900">
      <header className="sticky top-0 z-50 mb-6 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f5c5a] text-white shadow-sm">
              <Ambulance className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">Unit {user.vehicleNumber}</h1>
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">
                  Ambulance portal
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Sanjeevan · Dispatch, triage, routing & hospital handoff
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeIncident ? 'Mission active' : 'On standby'}
            </div>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              End shift
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6">
        {!activeIncident && (
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending requests</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{incidents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent missions</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{recentIncidents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit status</p>
              <p className="mt-2 text-lg font-bold text-teal-700">Ready for dispatch</p>
            </div>
          </section>
        )}

        {/* ── DISPATCH RADAR ── */}
        {!activeIncident && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-2.5">
                <Activity className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Dispatch queue</h2>
                <p className="text-xs text-slate-500">Incoming citizen reports update live</p>
              </div>
              <span className="ml-auto h-2.5 w-2.5 rounded-full bg-rose-500 pulse-ring" />
            </div>

            {incidents.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                <div className="mb-3 h-3 w-3 animate-ping rounded-full bg-rose-500" />
                <p className="font-semibold text-slate-500">No pending requests. Board updates live.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div key={incident._id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center">
                    <img src={incident.image} alt="Incident" className="h-28 w-full rounded-xl object-cover lg:w-40" />
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          incident.aidType === 'emergency' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {incident.aidType}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                          {incident.createdAt ? new Date(incident.createdAt).toLocaleTimeString() : 'Live'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{incident.description || 'No description provided.'}</p>
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-[#0f5c5a]" />
                        {incident.location?.lat?.toFixed?.(4)}, {incident.location?.lng?.toFixed?.(4)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAccept(incident)}
                      disabled={loading}
                      className="rounded-xl bg-[#0f5c5a] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#0c4c4a]"
                    >
                      Accept request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── ACTIVE MISSION TWO-COLUMN LAYOUT ── */}
        {activeIncident && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            {/* LEFT PANEL */}
            <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              {/* Active Case Header */}
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-teal-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Active case</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Incident accepted — ready for routing</h2>
                </div>
                <span
                  className={`self-start rounded-full px-4 py-1.5 text-xs font-bold uppercase lg:self-auto ${
                    activeIncident.severityLevel === 'critical'
                      ? 'bg-rose-100 text-rose-800'
                      : activeIncident.severityLevel === 'watch'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Severity: {activeIncident.severityLevel || 'stable'}
                </span>
              </div>

              {/* Route Alert */}
              {routeAlert && (
                <div className="flex items-start gap-3 rounded-2xl p-4 bg-amber-50 border border-amber-200 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm font-semibold">{routeAlert}</p>
                </div>
              )}

              {/* Incident image + vitals/form grid */}
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Incident Image Card */}
                <div className="rounded-2xl p-4 bg-white border border-[#cbd8e2]">
                  <img src={activeIncident.image} alt="Incident reference" className="mb-4 h-44 w-full rounded-xl object-cover" />
                  <p className="text-sm font-semibold text-[#0e2632]">{activeIncident.description || 'No extra incident description shared.'}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#5c7c8a]">
                    <MapPin className="h-3.5 w-3.5 text-[#1e4653]" />
                    Pickup: {activeIncident.location?.lat}, {activeIncident.location?.lng}
                  </div>
                </div>

                {/* Vitals form OR live streaming card */}
                {hospitalOptions.length === 0 ? (
                  <div className="space-y-4">
                    {selectedHospital && (
                      <div className="rounded-2xl p-4 bg-emerald-50/80 border border-emerald-200">
                        <div className="mb-2 flex items-center gap-2 text-emerald-800">
                          <Radio className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Current Destination</span>
                        </div>
                        <h3 className="text-lg font-extrabold text-[#0e2632]">{selectedHospital.name}</h3>
                        <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                          <MapPin className="h-3.5 w-3.5" />
                          {selectedHospital.location?.lat}, {selectedHospital.location?.lng}
                        </p>
                        <p className="mt-2 text-xs text-[#5c7c8a]">Submit vitals to generate ranked hospital options.</p>
                      </div>
                    )}
                    <form onSubmit={handleVitalsSubmit} className="rounded-2xl p-5 bg-white border border-[#cbd8e2]">
                      <h3 className="mb-4 flex items-center gap-2 text-base font-extrabold text-[#0e2632]">
                        <Stethoscope className="h-5 w-5 text-[#1e4653]" />
                        Initial Vitals &amp; Symptoms
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Heart Rate', key: 'heartRate' },
                          { label: 'SpO2', key: 'spo2' },
                          { label: 'Systolic BP', key: 'systolicBP' },
                          { label: 'Diastolic BP', key: 'diastolicBP' },
                        ].map((f) => (
                          <label key={f.key} className="text-xs font-bold text-[#5c7c8a]">
                            {f.label}
                            <input
                              type="number"
                              className="mt-1 w-full rounded-xl p-2.5 text-sm font-bold bg-[#f8fafc] border border-[#cbd8e2] text-[#0e2632] focus:outline-none focus:ring-2 focus:ring-[#1e4653]"
                              value={vitals[f.key]}
                              onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })}
                            />
                          </label>
                        ))}
                      </div>
                      <label className="mt-3 block text-xs font-bold text-[#5c7c8a]">
                        Symptoms
                        <textarea
                          className="mt-1 h-20 w-full rounded-xl p-2.5 text-sm font-medium resize-none bg-[#f8fafc] border border-[#cbd8e2] text-[#0e2632] focus:outline-none focus:ring-2 focus:ring-[#1e4653]"
                          value={vitals.symptoms}
                          onChange={(e) => setVitals({ ...vitals, symptoms: e.target.value })}
                          placeholder="chest pain, trauma, bleeding, stroke symptoms..."
                        />
                      </label>
                      <button disabled={loading} type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e4653] hover:bg-[#265564] py-3 text-sm font-extrabold text-white border border-[#2c5a69] shadow-sm transition">
                        Rank Hospitals <ChevronRight className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* ── LIVE STREAMING VITALS CARD ── */
                  <div className="rounded-2xl p-5 bg-white border border-[#cbd8e2]">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                        <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Live Streaming Active</span>
                      </div>
                      <span className="px-3 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {streaming ? '● Live' : '○ Waiting'}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-[#0e2632]">{selectedHospital?.name}</h3>
                    <p className="mt-1 mb-4 flex items-center gap-1.5 text-xs font-semibold text-[#5c7c8a]">
                      <MapPin className="h-3.5 w-3.5 text-[#1e4653]" />
                      {selectedHospital?.location?.lat}, {selectedHospital?.location?.lng}
                    </p>

                    {/* Vital chips */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl p-3 bg-[#f8fafc] border border-[#cbd8e2] text-center">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <HeartPulse className="h-3.5 w-3.5 text-rose-600" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c7c8a]">Heart Rate</p>
                        </div>
                        <p className="text-2xl font-black text-[#0e2632]">{Math.round(vitals.heartRate)}</p>
                        <p className="text-[10px] font-semibold text-[#5c7c8a]">BPM</p>
                      </div>

                      <div className="rounded-xl p-3 bg-[#f8fafc] border border-[#cbd8e2] text-center">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <Wind className="h-3.5 w-3.5 text-emerald-600" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c7c8a]">SpO2</p>
                        </div>
                        <p className={`text-2xl font-black ${Number(vitals.spo2) < 92 ? 'text-rose-600' : 'text-[#0e2632]'}`}>{Math.round(vitals.spo2)}%</p>
                        <p className="text-[10px] font-semibold text-[#5c7c8a]">Oxygen</p>
                      </div>

                      <div className="rounded-xl p-3 bg-[#f8fafc] border border-[#cbd8e2] text-center">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <Droplets className="h-3.5 w-3.5 text-blue-600" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c7c8a]">Blood Pressure</p>
                        </div>
                        <p className="text-xl font-black text-[#0e2632]">{Math.round(vitals.systolicBP)}/{Math.round(vitals.diastolicBP)}</p>
                        <p className="text-[10px] font-semibold text-[#5c7c8a]">mmHg</p>
                      </div>

                      <div className="rounded-xl p-3 bg-[#f8fafc] border border-[#cbd8e2] text-center">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <Thermometer className="h-3.5 w-3.5 text-amber-600" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c7c8a]">Temp</p>
                        </div>
                        <p className="text-2xl font-black text-[#0e2632]">{Number(vitals.temperature).toFixed(1)}</p>
                        <p className="text-[10px] font-semibold text-[#5c7c8a]">°F</p>
                      </div>
                    </div>

                    {/* Hospital requirement summary */}
                    <div className="mt-4 rounded-xl p-3.5 bg-[#f8fafc] border border-[#cbd8e2]">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5c7c8a]">Hospital Requirement Summary</p>
                      <p className="text-xs font-semibold text-[#0e2632]">
                        Specialists: {ensureStringList(activeIncident.mlPrediction?.specialists_Needed, ['general']).join(', ')}
                      </p>
                      <p className="text-xs font-semibold text-[#0e2632]">
                        Beds — ICU: {activeIncident.mlPrediction?.icuBeds_Required || 0} · Vent: {activeIncident.mlPrediction?.ventilators_Required || 0} · General: {activeIncident.mlPrediction?.generalBeds_Required || 0}
                      </p>
                      <p className="mt-1 text-xs text-[#5c7c8a]">Symptoms: {vitals.symptoms || 'Not recorded'}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button onClick={handleMarkArrival} disabled={loading} className="flex-1 py-3 rounded-xl bg-[#1e4653] hover:bg-[#265564] text-white font-extrabold text-xs shadow-sm transition border border-[#2c5a69]">
                        Mark Arrival
                      </button>
                      <button onClick={resetMission} disabled={loading} className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-100 text-[#0e2632] font-extrabold text-xs border border-[#cbd8e2] transition">
                        Clear Mission
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── HOSPITAL RANKING ── */}
              {hospitalOptions.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-[#1e4653]" />
                    <h3 className="text-base font-extrabold text-[#0e2632]">Hospital Ranking</h3>
                  </div>

                  {rankedBestHospital && (
                    <div className="rounded-2xl p-5 bg-emerald-50/90 border border-emerald-200">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Best Suitable Hospital</p>
                          <h4 className="text-xl font-extrabold text-[#0e2632]">{rankedBestHospital.name}</h4>
                          <p className="text-xs font-bold text-emerald-700">{rankedBestHospital.distanceKm} km away</p>
                        </div>
                        <span className="rounded-full px-3 py-1 text-xs font-bold bg-white text-emerald-800 border border-emerald-300">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#0e2632]">
                        ICU {rankedBestHospital.availableResources?.icuBeds || 0} · Vent {rankedBestHospital.availableResources?.ventilators || 0} · General {rankedBestHospital.availableResources?.generalBeds || 0}
                      </p>
                      <p className="mt-1 text-xs text-[#5c7c8a]">
                        Specialists: {ensureStringList(rankedBestHospital.availableResources?.specialists, ['general']).join(', ')}
                      </p>
                      <button
                        onClick={() => handleSelectHospital(rankedBestHospital.hospitalId)}
                        disabled={loading}
                        className={`mt-4 w-full rounded-xl py-3 text-sm font-extrabold transition shadow-sm ${
                          selectedHospital?.hospitalId === rankedBestHospital.hospitalId
                            ? 'bg-[#1e4653] text-white border border-[#2c5a69]'
                            : 'bg-white text-[#1e4653] border border-[#cbd8e2] hover:bg-slate-50'
                        }`}
                      >
                        {selectedHospital?.hospitalId === rankedBestHospital.hospitalId ? 'Chosen Hospital ✓' : 'Choose Best Suitable Hospital'}
                      </button>
                    </div>
                  )}

                  {alternativeHospitals.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-xs font-bold text-[#5c7c8a]">All Other Options</h4>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {alternativeHospitals.map((hospital) => (
                          <div
                            key={hospital.hospitalId}
                            className={`rounded-2xl p-4 border transition ${
                              selectedHospital?.hospitalId === hospital.hospitalId
                                ? 'bg-emerald-50/80 border-emerald-300'
                                : 'bg-white border-[#cbd8e2]'
                            }`}
                          >
                            <h4 className="text-base font-bold text-[#0e2632]">{hospital.name}</h4>
                            <p className="text-xs font-semibold text-[#5c7c8a]">{hospital.distanceKm} km away</p>
                            <p className="mt-2 text-xs font-semibold text-[#0e2632]">
                              ICU {hospital.availableResources?.icuBeds || 0} · Vent {hospital.availableResources?.ventilators || 0} · General {hospital.availableResources?.generalBeds || 0}
                            </p>
                            <p className="mt-1 text-xs text-[#5c7c8a]">
                              Specialists: {ensureStringList(hospital.availableResources?.specialists, ['general']).join(', ')}
                            </p>
                            <button
                              onClick={() => handleSelectHospital(hospital.hospitalId)}
                              disabled={loading}
                              className={`mt-3 w-full rounded-xl py-2.5 text-xs font-extrabold transition ${
                                selectedHospital?.hospitalId === hospital.hospitalId
                                  ? 'bg-[#1e4653] text-white border border-[#2c5a69]'
                                  : 'bg-[#f8fafc] text-[#0e2632] border border-[#cbd8e2] hover:bg-slate-100'
                              }`}
                            >
                              {selectedHospital?.hospitalId === hospital.hospitalId ? 'Chosen Hospital ✓' : 'Choose Hospital'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* RIGHT PANEL */}
            <section className="space-y-6">
              {/* Live Route Map */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-sky-50 p-2.5">
                    <Route className="h-5 w-5 text-sky-700" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">Live route</h2>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50" style={{ height: '380px' }}>
                  <LeafletMap
                    origin={mapOrigin}
                    destination={selectedHospital?.location || null}
                    strokeColor="#0f5c5a"
                    originLabel="A"
                    destLabel="H"
                    height="380px"
                  />
                </div>

                {/* Current Destination */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Current destination</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {selectedHospital ? `${selectedHospital.name}` : 'No hospital selected yet'}
                  </p>
                  {selectedHospital && (
                    <p className="text-xs font-semibold text-slate-500">Status: {selectedHospital.status}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Navigation className="h-3.5 w-3.5 text-[#0f5c5a]" />
                    Route auto-updates when critical vitals trigger a reroute.
                  </p>
                </div>
              </div>

              {/* Mission Log */}
              {recentIncidents.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#0f5c5a]" />
                    <h3 className="text-base font-bold text-slate-900">Mission log</h3>
                  </div>
                  <div className="space-y-3">
                    {recentIncidents.map((incident) => (
                      <div key={incident._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {incident.status && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              {incident.status}
                            </span>
                          )}
                          {incident.transportStatus && (
                            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                              {incident.transportStatus}
                            </span>
                          )}
                          {incident.arrivalStatus && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                              {incident.arrivalStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {incident.description || 'No incident description'}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Destination: {incident.assignedHospital?.name || incident.selectedHospital?.name || 'Not chosen'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
