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
  const { user, loading: authLoading, API_URL, logout } = useAuth()
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
        await axios.post(`${API_URL}/ambulance/location`, {
          lat: location.lat,
          lng: location.lng,
          incidentId: activeIncidentRef.current?._id,
        })
      } catch (error) {
        console.error('Live location sync failed', error)
      }
    }
    navigator.geolocation.getCurrentPosition(syncLocation, () => {}, { enableHighAccuracy: true, timeout: 10000 })
    const watchId = navigator.geolocation.watchPosition(syncLocation, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 })
    return () => navigator.geolocation.clearWatch(watchId)
  }, [API_URL])

  useEffect(() => {
    if (!ambulanceUserId) return undefined
    const socket = io('http://localhost:3000', { withCredentials: true })
    socket.emit('join', 'ambulance')
    socket.emit('join', `ambulance_${ambulanceUserId}`)
    socket.on('incoming_incident', (incident) => {
      setIncidents((prev) => [incident, ...prev.filter((item) => item._id !== incident._id)])
    })
    socket.on('incident_taken', ({ incidentId }) => {
      setIncidents((prev) => prev.filter((incident) => incident._id !== incidentId))
    })
    socket.on('ambulance_case_update', ({ incident, rerouted, reason }) => {
      if (incident.status === 'completed') return
      setRecentIncidents((prev) => [incident, ...prev.filter((item) => item._id !== incident._id)].slice(0, 10))
      syncMissionState(incident)
      if (rerouted && reason) setRouteAlert(reason)
    })
    return () => socket.disconnect()
  }, [ambulanceUserId])

  useEffect(() => {
    if (!activeIncident?._id || !selectedHospital?.hospitalId) { setStreaming(false); return undefined }
    setStreaming(true)
    const intervalId = window.setInterval(async () => {
      const nextVitals = buildRandomVitals(vitalsRef.current, activeIncidentRef.current?.severityLevel)
      setVitals(nextVitals)
      try {
        const response = await axios.post(`${API_URL}/ambulance/stream-vitals`, {
          incidentId: activeIncidentRef.current._id,
          vitals: nextVitals,
          ambulanceLocation: ambulanceLocationRef.current || mapOrigin,
        })
        setActiveIncident(response.data.incident)
        if (response.data.incident?.status === 'completed') return
        const nextSelectedHospital = normalizeHospital(
          response.data.selectedHospital || response.data.incident.assignedHospital,
          response.data.incident.hospitalOptions || [],
        )
        setSelectedHospital(nextSelectedHospital)
        if (response.data.rerouted && response.data.reason) setRouteAlert(response.data.reason)
      } catch (error) {
        console.error('Vitals streaming failed', error)
      }
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [API_URL, activeIncident?._id, mapOrigin, selectedHospital?.hospitalId])

  const handleAccept = async (incident) => {
    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/ambulance/accept-incident`, { incidentId: incident._id })
      syncMissionState(response.data.incident, response.data.allocatedHospital)
      setIncidents((prev) => prev.filter((item) => item._id !== incident._id))
      setRouteAlert('')
    } catch (error) {
      alert('Failed to accept the request. Another ambulance may have taken it.')
    } finally {
      setLoading(false)
    }
  }

  const handleVitalsSubmit = async (event) => {
    event.preventDefault()
    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/ambulance/predict-allocation`, {
        incidentId: activeIncident._id,
        vitals: {
          ...vitals,
          heartRate: Number(vitals.heartRate),
          systolicBP: Number(vitals.systolicBP),
          diastolicBP: Number(vitals.diastolicBP),
          spo2: Number(vitals.spo2),
          temperature: Number(vitals.temperature),
        },
      })
      syncMissionState(response.data.incident, response.data.bestHospital)
      setHospitalOptions(response.data.availableHospitals || [])
      setBestHospital(response.data.bestHospital || null)
      setSelectedHospital(response.data.bestHospital || null)
      setRouteAlert('')
    } catch (error) {
      alert('Failed to rank hospitals for this patient.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHospital = async (hospitalId) => {
    try {
      setLoading(true)
      const response = await axios.post(`${API_URL}/ambulance/select-hospital`, { incidentId: activeIncident._id, hospitalId })
      syncMissionState(response.data.incident, response.data.selectedHospital)
      setSelectedHospital(response.data.selectedHospital)
      setRouteAlert('')
    } catch (error) {
      alert('Failed to switch hospital destination.')
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
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f0e8' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#2d5a27', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!user || user.role !== 'ambulance') return <Navigate to="/ambulance/login" replace />

  return (
    <div className="amb-bg p-4 md:p-6 pb-20">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* ── HEADER ── */}
        <header className="amb-card-primary flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl p-3.5 text-white shadow-md" style={{ background: '#2d5a27' }}>
              <Ambulance className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7a9e72' }}>Active Unit</p>
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: '#1a2e18' }}>Unit {user.vehicleNumber}</h1>
              <p className="text-xs font-medium" style={{ color: '#8a7d65' }}>Dispatch · Triage · Routing · Live Handoff</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-80"
            style={{ background: 'rgba(245,240,228,0.9)', border: '1.5px solid #c8b89a', color: '#5a4a35' }}
          >
            End Shift
          </button>
        </header>

        {/* ── DISPATCH RADAR ── */}
        {!activeIncident && (
          <section className="amb-card-primary p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl p-2" style={{ background: 'rgba(200,180,150,0.25)' }}>
                <Activity className="h-5 w-5" style={{ color: '#8b5e3c' }} />
              </div>
              <h2 className="text-lg font-extrabold" style={{ color: '#1a2e18' }}>Dispatch Radar</h2>
              <span className="amb-live-pulse ml-1 h-2.5 w-2.5 rounded-full" style={{ background: '#c0392b', display: 'inline-block' }} />
            </div>

            {incidents.length === 0 ? (
              <div className="flex h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed" style={{ borderColor: '#d4c9b0', background: 'rgba(245,240,228,0.4)' }}>
                <div className="mb-3 h-3 w-3 animate-ping rounded-full" style={{ background: '#c0392b' }} />
                <p className="font-semibold" style={{ color: '#8a7d65' }}>No pending requests. Board updates live.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div key={incident._id} className="flex flex-col gap-4 rounded-2xl p-4 lg:flex-row lg:items-center" style={{ background: 'rgba(245,240,228,0.6)', border: '1px solid rgba(200,185,160,0.45)' }}>
                    <img src={incident.image} alt="Incident" className="h-28 w-full rounded-xl object-cover lg:w-40" />
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="amb-status-pill" style={{ background: incident.aidType === 'emergency' ? '#fde8e8' : '#e8f0e8', color: incident.aidType === 'emergency' ? '#9b1c1c' : '#2d5a27' }}>
                          {incident.aidType}
                        </span>
                        <span className="amb-status-pill" style={{ background: 'rgba(255,252,245,0.8)', color: '#8a7d65' }}>
                          {incident.createdAt ? new Date(incident.createdAt).toLocaleTimeString() : 'Live'}
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#3a3020' }}>{incident.description || 'No description provided.'}</p>
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold" style={{ color: '#8a7d65' }}>
                        <MapPin className="h-3 w-3" />
                        {incident.location?.lat?.toFixed?.(4)}, {incident.location?.lng?.toFixed?.(4)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAccept(incident)}
                      disabled={loading}
                      className="amb-btn-primary rounded-xl px-7 py-3 text-sm"
                    >
                      Accept Request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── ACTIVE MISSION TWO-COLUMN LAYOUT ── */}
        {activeIncident && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">

            {/* LEFT PANEL */}
            <section className="amb-card-primary space-y-5 p-6 md:p-7">

              {/* Active Case Header */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-1.5 flex items-center gap-2" style={{ color: '#2d5a27' }}>
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Active Case</span>
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: '#1a2e18' }}>Incident accepted and ready for routing</h2>
                </div>
                <span
                  className="self-start rounded-full px-4 py-1.5 text-sm font-bold lg:self-auto"
                  style={{
                    background: activeIncident.severityLevel === 'critical' ? '#fde8e8' : activeIncident.severityLevel === 'watch' ? '#fef3e2' : '#e8f0e8',
                    color: activeIncident.severityLevel === 'critical' ? '#9b1c1c' : activeIncident.severityLevel === 'watch' ? '#92400e' : '#2d5a27',
                    border: `1.5px solid ${activeIncident.severityLevel === 'critical' ? '#fca5a5' : activeIncident.severityLevel === 'watch' ? '#fcd34d' : '#86c87a'}`,
                  }}
                >
                  Severity: {activeIncident.severityLevel || 'stable'}
                </span>
              </div>

              {/* Route Alert */}
              {routeAlert && (
                <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: '#fef3e2', border: '1px solid #fcd34d', color: '#92400e' }}>
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-semibold">{routeAlert}</p>
                </div>
              )}

              {/* Incident image + vitals/form grid */}
              <div className="grid gap-5 lg:grid-cols-2">

                {/* Incident Image Card */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(245,240,228,0.7)', border: '1px solid rgba(200,185,160,0.4)' }}>
                  <img src={activeIncident.image} alt="Incident reference" className="mb-4 h-44 w-full rounded-xl object-cover" />
                  <p className="text-sm font-medium" style={{ color: '#3a3020' }}>{activeIncident.description || 'No extra incident description shared.'}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color: '#8a7d65' }}>
                    <MapPin className="h-3.5 w-3.5" />
                    Pickup: {activeIncident.location?.lat}, {activeIncident.location?.lng}
                  </div>
                </div>

                {/* Vitals form OR live streaming card */}
                {hospitalOptions.length === 0 ? (
                  <div className="space-y-4">
                    {selectedHospital && (
                      <div className="rounded-2xl p-4" style={{ background: 'rgba(220,237,220,0.45)', border: '1px solid rgba(130,170,130,0.35)' }}>
                        <div className="mb-2 flex items-center gap-2" style={{ color: '#2d5a27' }}>
                          <Radio className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Current Destination</span>
                        </div>
                        <h3 className="text-lg font-bold" style={{ color: '#1a2e18' }}>{selectedHospital.name}</h3>
                        <p className="mt-1 flex items-center gap-2 text-xs font-medium" style={{ color: '#4a7a42' }}>
                          <MapPin className="h-3.5 w-3.5" />
                          {selectedHospital.location?.lat}, {selectedHospital.location?.lng}
                        </p>
                        <p className="mt-2 text-xs" style={{ color: '#5a7a55' }}>Submit vitals to generate ranked hospital options.</p>
                      </div>
                    )}
                    <form onSubmit={handleVitalsSubmit} className="rounded-2xl p-5" style={{ background: 'rgba(255,252,245,0.9)', border: '1px solid rgba(200,185,160,0.4)' }}>
                      <h3 className="mb-4 flex items-center gap-2 text-base font-bold" style={{ color: '#1a2e18' }}>
                        <Stethoscope className="h-5 w-5" style={{ color: '#8b5e3c' }} />
                        Initial Vitals &amp; Symptoms
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Heart Rate', key: 'heartRate' },
                          { label: 'SpO2', key: 'spo2' },
                          { label: 'Systolic BP', key: 'systolicBP' },
                          { label: 'Diastolic BP', key: 'diastolicBP' },
                        ].map((f) => (
                          <label key={f.key} className="text-xs font-bold" style={{ color: '#8a7d65' }}>
                            {f.label}
                            <input
                              type="number"
                              className="mt-1 w-full rounded-xl p-3 text-sm font-semibold"
                              style={{ background: 'rgba(245,240,228,0.8)', border: '1px solid rgba(200,185,160,0.5)', color: '#1a2e18' }}
                              value={vitals[f.key]}
                              onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })}
                            />
                          </label>
                        ))}
                      </div>
                      <label className="mt-3 block text-xs font-bold" style={{ color: '#8a7d65' }}>
                        Symptoms
                        <textarea
                          className="mt-1 h-24 w-full rounded-xl p-3 text-sm resize-none"
                          style={{ background: 'rgba(245,240,228,0.8)', border: '1px solid rgba(200,185,160,0.5)', color: '#1a2e18' }}
                          value={vitals.symptoms}
                          onChange={(e) => setVitals({ ...vitals, symptoms: e.target.value })}
                          placeholder="chest pain, trauma, bleeding, stroke symptoms..."
                        />
                      </label>
                      <button disabled={loading} type="submit" className="amb-btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm">
                        Rank Hospitals <ChevronRight className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* ── LIVE STREAMING VITALS CARD ── */
                  <div className="amb-card-vitals p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="amb-live-pulse h-2.5 w-2.5 rounded-full" style={{ background: '#3a8a3a', display: 'inline-block' }} />
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#2d5a27' }}>Live Streaming Active</span>
                      </div>
                      <span className="amb-status-pill" style={{ background: 'rgba(220,237,220,0.7)', color: '#2d5a27', border: '1px solid rgba(130,170,130,0.4)' }}>
                        {streaming ? '● Live' : '○ Waiting'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: '#1a2e18' }}>{selectedHospital.name}</h3>
                    <p className="mt-1 mb-4 flex items-center gap-1.5 text-xs font-medium" style={{ color: '#4a7a42' }}>
                      <MapPin className="h-3.5 w-3.5" />
                      {selectedHospital.location?.lat}, {selectedHospital.location?.lng}
                    </p>

                    {/* Vital chips */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="amb-vital-chip">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <HeartPulse className="h-3.5 w-3.5" style={{ color: '#c0392b' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8a7d65' }}>Heart Rate</p>
                        </div>
                        <p className="text-2xl font-black" style={{ color: '#1a2e18' }}>{Math.round(vitals.heartRate)}</p>
                        <p className="text-[10px] font-semibold" style={{ color: '#8a7d65' }}>BPM</p>
                      </div>
                      <div className="amb-vital-chip">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <Wind className="h-3.5 w-3.5" style={{ color: '#2d5a27' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8a7d65' }}>SpO2</p>
                        </div>
                        <p className="text-2xl font-black" style={{ color: Number(vitals.spo2) < 92 ? '#9b1c1c' : '#1a2e18' }}>{Math.round(vitals.spo2)}%</p>
                        <p className="text-[10px] font-semibold" style={{ color: '#8a7d65' }}>Oxygen</p>
                      </div>
                      <div className="amb-vital-chip">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <Droplets className="h-3.5 w-3.5" style={{ color: '#5a7aaa' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8a7d65' }}>Blood Pressure</p>
                        </div>
                        <p className="text-xl font-black" style={{ color: '#1a2e18' }}>{Math.round(vitals.systolicBP)}/{Math.round(vitals.diastolicBP)}</p>
                        <p className="text-[10px] font-semibold" style={{ color: '#8a7d65' }}>mmHg</p>
                      </div>
                      <div className="amb-vital-chip">
                        <div className="mb-1 flex items-center justify-center gap-1">
                          <Thermometer className="h-3.5 w-3.5" style={{ color: '#c07a2a' }} />
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8a7d65' }}>Temp</p>
                        </div>
                        <p className="text-2xl font-black" style={{ color: '#1a2e18' }}>{Number(vitals.temperature).toFixed(1)}</p>
                        <p className="text-[10px] font-semibold" style={{ color: '#8a7d65' }}>°F</p>
                      </div>
                    </div>

                    {/* Hospital requirement summary */}
                    <div className="mt-4 rounded-xl p-3.5" style={{ background: 'rgba(255,252,245,0.75)', border: '1px solid rgba(200,185,160,0.35)' }}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8a7d65' }}>Hospital Requirement Summary</p>
                      <p className="text-xs font-semibold" style={{ color: '#3a3020' }}>
                        Specialists: {ensureStringList(activeIncident.mlPrediction?.specialists_Needed, ['general']).join(', ')}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: '#3a3020' }}>
                        Beds — ICU: {activeIncident.mlPrediction?.icuBeds_Required || 0} · Vent: {activeIncident.mlPrediction?.ventilators_Required || 0} · General: {activeIncident.mlPrediction?.generalBeds_Required || 0}
                      </p>
                      <p className="mt-1.5 text-xs" style={{ color: '#8a7d65' }}>Symptoms: {vitals.symptoms || 'Not recorded'}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button onClick={handleMarkArrival} disabled={loading} className="amb-btn-primary flex-1 py-3 text-sm">
                        Mark Arrival
                      </button>
                      <button onClick={resetMission} disabled={loading} className="amb-btn-secondary flex-1 py-3 text-sm">
                        Clear Mission
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── HOSPITAL RANKING ── */}
              {hospitalOptions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5" style={{ color: '#8b5e3c' }} />
                    <h3 className="text-base font-bold" style={{ color: '#1a2e18' }}>Hospital Ranking</h3>
                  </div>

                  {rankedBestHospital && (
                    <div className="rounded-2xl p-5" style={{ background: 'rgba(220,237,220,0.55)', border: '1.5px solid rgba(130,170,130,0.45)', backdropFilter: 'blur(10px)' }}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4a7a42' }}>Best Suitable Hospital</p>
                          <h4 className="text-xl font-bold" style={{ color: '#1a2e18' }}>{rankedBestHospital.name}</h4>
                          <p className="text-xs font-semibold" style={{ color: '#4a7a42' }}>{rankedBestHospital.distanceKm} km away</p>
                        </div>
                        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(255,252,245,0.85)', color: '#2d5a27', border: '1px solid #86c87a' }}>
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#2a4a25' }}>
                        ICU {rankedBestHospital.availableResources?.icuBeds || 0} · Vent {rankedBestHospital.availableResources?.ventilators || 0} · General {rankedBestHospital.availableResources?.generalBeds || 0}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: '#3a5a35' }}>
                        Specialists: {ensureStringList(rankedBestHospital.availableResources?.specialists, ['general']).join(', ')}
                      </p>
                      <button
                        onClick={() => handleSelectHospital(rankedBestHospital.hospitalId)}
                        disabled={loading}
                        className="mt-4 w-full rounded-xl py-3 text-sm font-bold transition"
                        style={
                          selectedHospital?.hospitalId === rankedBestHospital.hospitalId
                            ? { background: '#2d5a27', color: '#fff' }
                            : { background: 'rgba(255,252,245,0.85)', color: '#2d5a27', border: '1.5px solid #86c87a' }
                        }
                      >
                        {selectedHospital?.hospitalId === rankedBestHospital.hospitalId ? 'Chosen Hospital ✓' : 'Choose Best Suitable Hospital'}
                      </button>
                    </div>
                  )}

                  {alternativeHospitals.length > 0 && (
                    <div>
                      <h4 className="mb-3 text-sm font-bold" style={{ color: '#5a4a35' }}>All Other Options</h4>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {alternativeHospitals.map((hospital) => (
                          <div
                            key={hospital.hospitalId}
                            className="rounded-2xl p-4"
                            style={
                              selectedHospital?.hospitalId === hospital.hospitalId
                                ? { background: 'rgba(220,237,220,0.5)', border: '1.5px solid rgba(130,170,130,0.5)' }
                                : { background: 'rgba(245,240,228,0.6)', border: '1px solid rgba(200,185,160,0.4)' }
                            }
                          >
                            <h4 className="text-base font-bold" style={{ color: '#1a2e18' }}>{hospital.name}</h4>
                            <p className="text-xs font-semibold" style={{ color: '#8a7d65' }}>{hospital.distanceKm} km away</p>
                            <p className="mt-2 text-xs font-medium" style={{ color: '#3a3020' }}>
                              ICU {hospital.availableResources?.icuBeds || 0} · Vent {hospital.availableResources?.ventilators || 0} · General {hospital.availableResources?.generalBeds || 0}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: '#5a4a35' }}>
                              Specialists: {ensureStringList(hospital.availableResources?.specialists, ['general']).join(', ')}
                            </p>
                            <button
                              onClick={() => handleSelectHospital(hospital.hospitalId)}
                              disabled={loading}
                              className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold transition"
                              style={
                                selectedHospital?.hospitalId === hospital.hospitalId
                                  ? { background: '#2d5a27', color: '#fff' }
                                  : { background: 'rgba(255,252,245,0.85)', color: '#3a3020', border: '1px solid rgba(200,185,160,0.5)' }
                              }
                            >
                              {selectedHospital?.hospitalId === hospital.hospitalId ? 'Chosen Hospital ✓' : 'Choose Hospital'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rankedBestHospital && (
                    <p className="text-xs font-semibold" style={{ color: '#8a7d65' }}>
                      Best match: <span style={{ color: '#2d5a27' }}>{rankedBestHospital.name}</span>. Ranked from registered hospital inventory.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* RIGHT PANEL */}
            <section className="space-y-5">

              {/* Live Route Map */}
              <div className="amb-card-map p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl p-2" style={{ background: 'rgba(200,185,160,0.25)' }}>
                    <Route className="h-5 w-5" style={{ color: '#5a7aaa' }} />
                  </div>
                  <h2 className="text-base font-extrabold" style={{ color: '#1a2e18' }}>Live Route</h2>
                </div>
                <div className="overflow-hidden rounded-2xl" style={{ height: '380px', border: '1px solid rgba(200,185,160,0.35)' }}>
                  <LeafletMap
                    origin={mapOrigin}
                    destination={selectedHospital?.location || null}
                    strokeColor="#2d5a27"
                    originLabel="A"
                    destLabel="H"
                    height="380px"
                  />
                </div>

                {/* Current Destination */}
                <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(245,240,228,0.7)', border: '1px solid rgba(200,185,160,0.4)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8a7d65' }}>Current Destination</p>
                  <p className="mt-1 text-sm font-bold" style={{ color: '#1a2e18' }}>
                    {selectedHospital ? `${selectedHospital.name}` : 'No hospital selected yet'}
                  </p>
                  {selectedHospital && (
                    <p className="text-xs font-medium" style={{ color: '#8a7d65' }}>Status: {selectedHospital.status}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#8a7d65' }}>
                    <Navigation className="h-3.5 w-3.5" />
                    Route auto-updates when critical vitals trigger a reroute.
                  </p>
                </div>
              </div>

              {/* Mission Log */}
              {recentIncidents.length > 0 && (
                <div className="amb-card-secondary p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" style={{ color: '#5a7aaa' }} />
                    <h3 className="text-base font-bold" style={{ color: '#1a2e18' }}>Mission Log</h3>
                  </div>
                  <div className="space-y-3">
                    {recentIncidents.map((incident) => (
                      <div key={incident._id} className="rounded-xl p-4" style={{ background: 'rgba(255,252,245,0.75)', border: '1px solid rgba(200,185,160,0.35)' }}>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {incident.status && (
                            <span className="amb-status-pill" style={{ background: 'rgba(220,237,220,0.6)', color: '#2d5a27', border: '1px solid rgba(130,170,130,0.35)' }}>
                              {incident.status}
                            </span>
                          )}
                          {incident.transportStatus && (
                            <span className="amb-status-pill" style={{ background: 'rgba(245,240,228,0.8)', color: '#8b5e3c', border: '1px solid rgba(200,170,130,0.4)' }}>
                              {incident.transportStatus}
                            </span>
                          )}
                          {incident.arrivalStatus && (
                            <span className="amb-status-pill" style={{ background: 'rgba(235,245,255,0.7)', color: '#3a5a8a', border: '1px solid rgba(130,160,200,0.35)' }}>
                              {incident.arrivalStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold" style={{ color: '#1a2e18' }}>
                          {incident.description || 'No incident description'}
                        </p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: '#8a7d65' }}>
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
