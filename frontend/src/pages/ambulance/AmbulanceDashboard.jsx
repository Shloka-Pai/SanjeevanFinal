import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Ambulance, MapPin, Activity, Stethoscope, ChevronRight, CheckCircle2, Navigation2, Loader2, Hospital, AlertTriangle } from 'lucide-react'
import { useJsApiLoader, GoogleMap, DirectionsRenderer } from '@react-google-maps/api'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.1, duration: 0.6, ease: [0.25, 0.8, 0.25, 1] } },
  exit: { opacity: 0, y: -20 }
}

const itemVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.8, 0.25, 1] } }
}

export default function AmbulanceDashboard() {
  const { user, API_URL, API_ORIGIN, logout } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [activeIncident, setActiveIncident] = useState(null)
  const [vitals, setVitals] = useState({
    heartRate: 80,
    systolicBP: 120,
    diastolicBP: 80,
    spo2: 98,
    temperature: 98.6,
    symptoms: ''
  })
  const [allocatedHospital, setAllocatedHospital] = useState(null)
  const [loading, setLoading] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  })

  const [directionsResponse, setDirectionsResponse] = useState(null)
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [routeIndex, setRouteIndex] = useState(0)

  const calculateRoute = async (destinationHospital) => {
    if (!activeIncident || !destinationHospital || !window.google) return
    const directionsService = new window.google.maps.DirectionsService()
    const origin = { lat: activeIncident.location?.lat, lng: activeIncident.location?.lng }
    const destination = { lat: destinationHospital.location?.lat, lng: destinationHospital.location?.lng }
    try {
      const results = await directionsService.route({
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true
      })
      setDirectionsResponse(results)
      setDistance(results.routes[0].legs[0].distance.text)
      setDuration(results.routes[0].legs[0].duration.text)
      setRouteIndex(0)
    } catch (e) {
      console.error("Directions requests failed", e)
    }
  }

  useEffect(() => {
    if (allocatedHospital && activeIncident && isLoaded) {
      calculateRoute(allocatedHospital)
    }
  }, [allocatedHospital, activeIncident, isLoaded])

  const handleReroute = () => {
    if (directionsResponse && directionsResponse.routes.length > 1) {
      const nextIndex = (routeIndex + 1) % directionsResponse.routes.length;
      setRouteIndex(nextIndex);
      setDistance(directionsResponse.routes[nextIndex].legs[0].distance.text);
      setDuration(directionsResponse.routes[nextIndex].legs[0].duration.text);
    } else {
      alert("No alternate routes available at this moment.");
    }
  }

  if (!user || user.role !== 'ambulance') return <Navigate to="/ambulance/login" />

  useEffect(() => {
    const socket = io(API_ORIGIN, { withCredentials: true })
    socket.emit('join', 'ambulance')
    socket.on('incoming_incident', (incident) => setIncidents(prev => [incident, ...prev]))
    socket.on('incident_taken', ({ incidentId }) => {
      setIncidents(prev => prev.filter(i => i._id !== incidentId))
    })
    return () => socket.disconnect()
  }, [activeIncident, API_ORIGIN])

  const handleAccept = async (incident) => {
    try {
      setLoading(true)
      const res = await axios.post(`${API_URL}/ambulance/accept-incident`, { incidentId: incident._id })
      setActiveIncident(res.data.incident)
      if (res.data.allocatedHospital) {
        setAllocatedHospital(res.data.allocatedHospital)
      }
      setIncidents([])
    } catch(err) {
      alert("Failed to accept or already taken.")
    } finally {
      setLoading(false)
    }
  }

  const handleVitalsSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const res = await axios.post(`${API_URL}/ambulance/predict-allocation`, {
        incidentId: activeIncident._id,
        vitals: { ...vitals, heartRate: Number(vitals.heartRate), systolicBP: Number(vitals.systolicBP), diastolicBP: Number(vitals.diastolicBP), spo2: Number(vitals.spo2), temperature: Number(vitals.temperature) }
      })
      setActiveIncident(res.data.incident)
      setAllocatedHospital(res.data.allocatedHospital)
    } catch (err) {
      alert("Failed predicting allocation.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen medical-mesh-bg p-4 md:p-8 text-slate-800">
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-5xl mx-auto space-y-6">
        
        <motion.header variants={itemVariants} className="flex justify-between items-center glass-panel p-4 md:p-6 rounded-[2rem] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden relative">
              <Ambulance className="w-6 h-6 z-10" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Unit</p>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">{user.vehicleNumber}</h1>
            </div>
          </div>
          <button onClick={logout} className="text-sm bg-white/50 border border-slate-200 hover:bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl font-bold transition-all">Sign Off (Logout)</button>
        </motion.header>

        <AnimatePresence mode="wait">
          {!activeIncident && (
            <motion.section key="radar" variants={itemVariants} initial="initial" animate="animate" exit={{ opacity: 0, y: -20 }} className="creative-card p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden bg-white">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50"></div>
              
              <div className="flex items-center gap-3 mb-8">
                <div className="pulse-ring w-3 h-3 bg-rose-500 rounded-full ml-1"></div>
                <h2 className="text-xl font-bold text-slate-800">Dispatch Radar Feed</h2>
              </div>
              
              {incidents.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-3xl">
                  <Activity className="w-10 h-10 text-slate-300 mb-4 animate-pulse" />
                  <p className="text-slate-400 font-bold text-lg">Scanning Sector M-4...</p>
                  <p className="text-slate-400 text-sm mt-1">Waiting for incoming dispatch requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {incidents.map((inc) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={inc._id} 
                        className={`p-4 md:p-5 rounded-[1.5rem] border shadow-sm flex flex-col sm:flex-row gap-5 items-center justify-between transition-all hover:shadow-md ${
                          inc.aidType === 'emergency' 
                            ? 'border-rose-200 bg-rose-50/30' 
                            : 'border-blue-100 bg-blue-50/30'
                        }`}
                      >
                        <div className="relative shrink-0">
                          {inc.image ? (
                            <img src={inc.image} alt="Incident" className="w-24 h-24 object-cover rounded-[1rem] shadow-sm transform transition-transform hover:scale-105" />
                          ) : (
                            <div className="w-24 h-24 bg-slate-200 rounded-[1rem] flex items-center justify-center">No Image</div>
                          )}
                          <div className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white ${inc.aidType === 'emergency' ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'}`}></div>
                        </div>

                        <div className="flex-1 w-full text-center sm:text-left">
                           <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-2 ${
                             inc.aidType === 'emergency' ? 'bg-rose-600 text-white shadow-sm' : 'bg-blue-100 text-blue-700'
                           }`}>
                             {inc.aidType}
                           </span>
                           <p className="text-slate-700 font-semibold text-sm line-clamp-2 md:text-base leading-relaxed">
                             {inc.description || "Unspecified incident detected at location."}
                           </p>
                           <p className="text-slate-400 text-xs mt-3 flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                             <MapPin className="w-3.5 h-3.5"/> 
                             GPS: {inc.location?.lat.toFixed(5)}, {inc.location?.lng.toFixed(5)}
                           </p>
                        </div>
                        
                        <button 
                          onClick={() => handleAccept(inc)}
                          disabled={loading}
                          className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70 group"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Respond'}
                          {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.section>
          )}

          {activeIncident && !allocatedHospital && (
            <motion.section key="active" variants={itemVariants} initial="initial" animate="animate" className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-emerald-100/50 flex flex-col lg:flex-row gap-8 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
               
               <div className="flex-1">
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-6">
                   <Navigation2 className="w-6 h-6" />
                 </div>
                 <h2 className="text-3xl font-black mb-3 text-slate-800 tracking-tight">Mission Active</h2>
                 <p className="text-slate-500 font-medium leading-relaxed mb-8">
                   Proceed to coordinates. Once visual is established, collect patient vitals and symptoms to initiate ML-driven hospital allocation.
                 </p>
                 
                 <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <img src={activeIncident.image} className="w-full h-40 object-cover rounded-xl mb-4 group-hover:scale-105 transition-transform duration-500" alt="Target"/>
                    <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider">
                      LAT: {activeIncident.location?.lat.toFixed(4)} <br/>
                      LNG: {activeIncident.location?.lng.toFixed(4)}
                    </div>
                 </div>
               </div>

               <div className="flex-[1.2]">
                 <form onSubmit={handleVitalsSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border border-slate-100 h-full flex flex-col justify-between">
                   <div>
                     <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                       <Stethoscope className="text-rose-500 w-5 h-5"/> Input Vitals
                     </h3>
                     
                     <div className="grid grid-cols-2 gap-4 mb-6">
                       {[
                         { label: 'Heart Rate', stateKey: 'heartRate', unit: 'bpm', type: 'number' },
                         { label: 'SpO2', stateKey: 'spo2', unit: '%', type: 'number' },
                         { label: 'Systolic BP', stateKey: 'systolicBP', unit: 'mmHg', type: 'number' },
                         { label: 'Diastolic BP', stateKey: 'diastolicBP', unit: 'mmHg', type: 'number' },
                       ].map((field) => (
                         <div key={field.stateKey} className="group">
                           <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                           <div className="relative">
                             <input 
                               type={field.type} 
                               className="input-glass w-full rounded-xl p-3 font-semibold text-slate-700" 
                               value={vitals[field.stateKey]} 
                               onChange={e=>setVitals({...vitals, [field.stateKey]: e.target.value})} 
                             />
                             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">{field.unit}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                     
                     <div className="mb-6">
                       <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Symptoms / Assessment</label>
                       <textarea 
                         className="input-glass w-full rounded-xl p-4 text-sm resize-none h-24 font-medium text-slate-700" 
                         placeholder="e.g. blunt trauma, unresponsiveness, dilated pupils" 
                         value={vitals.symptoms} 
                         onChange={e=>setVitals({...vitals, symptoms: e.target.value})} 
                       />
                     </div>
                   </div>

                   <button disabled={loading} type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95">
                     {loading ? <Loader2 className="w-6 h-6 animate-spin"/> : 'Run Allocation Sequence'}
                     {!loading && <ChevronRight className="w-5 h-5"/>}
                   </button>
                 </form>
               </div>
            </motion.section>
          )}

          {allocatedHospital && (
            <motion.section key="hospital" variants={itemVariants} initial="initial" animate="animate" className="bg-slate-900 text-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent pointer-events-none"></div>
               
               <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-1">
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase mb-6 inline-flex items-center gap-2 border border-emerald-500/30">
                      <CheckCircle2 className="w-4 h-4"/> Routing Locked
                    </span>
                    
                    <h2 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter drop-shadow-md">{allocatedHospital.name}</h2>
                    <p className="text-slate-400 font-medium text-lg mb-8 flex items-center gap-2">
                       <MapPin className="w-5 h-5 text-slate-500"/> 
                       {allocatedHospital.location?.lat.toFixed(4)}, {allocatedHospital.location?.lng.toFixed(4)}
                    </p>
                    
                    <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">ML Engine Assessment</p>
                      <ul className="text-sm space-y-3 font-medium text-slate-300">
                        <li className="flex justify-between">
                           <span>Medical Specialists:</span>
                           <span className="text-white bg-white/10 px-2 py-0.5 rounded text-xs">{activeIncident.mlPrediction?.specialists_Needed?.join(', ') || 'General'}</span>
                        </li>
                        <li className="flex justify-between">
                           <span>ICU Configuration:</span>
                           <span className="text-white bg-white/10 px-2 py-0.5 rounded text-xs">Level {activeIncident.mlPrediction?.icuBeds_Required > 0 ? 'CRITICAL' : 'STANDARD'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-1/3 flex flex-col gap-4">
                        <div className="bg-white/5 rounded-3xl border border-white/10 flex flex-col p-4 w-full mb-4 relative min-h-[300px]">
                           {isLoaded && directionsResponse ? (
                             <>
                               <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold font-mono text-white flex gap-3 shadow-lg">
                                 <span>ETA: {duration}</span>
                                 <span className="text-emerald-400">{distance}</span>
                               </div>
                               <GoogleMap
                                 mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '1.2rem' }}
                                 zoom={14}
                                 center={{ lat: activeIncident.location?.lat, lng: activeIncident.location?.lng }}
                                 options={{ disableDefaultUI: true, zoomControl: true }}
                               >
                                 <DirectionsRenderer directions={directionsResponse} routeIndex={routeIndex} options={{ suppressMarkers: false }} />
                               </GoogleMap>
                             </>
                           ) : (
                             <div className="w-full h-full min-h-[300px] flex flex-col justify-center items-center">
                               <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2"/>
                               <p className="text-xs font-bold text-slate-400 uppercase">Generating Navigation...</p>
                             </div>
                           )}
                        </div>
                        
                        {activeIncident?.isHighSeverityTrauma && (
                           <div className="bg-rose-500/20 text-rose-300 border border-rose-500/30 p-3 rounded-xl mb-4 text-xs font-bold flex gap-2 items-center">
                             <AlertTriangle className="w-5 h-5 shrink-0"/>
                             CRITICAL TRAUMA CASE. ROUTING AUTO-OVERRIDDEN TO LEVEL 1 CENTER.
                           </div>
                        )}

                        <div className="flex gap-3 mb-4">
                           <button onClick={handleReroute} className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl transition-colors border border-white/10 items-center justify-center flex gap-2">
                             <AlertTriangle className="w-4 h-4 text-amber-400"/> Road Blocked (Detour)
                           </button>
                        </div>

                     <button 
                       onClick={() => { setActiveIncident(null); setAllocatedHospital(null); setVitals({heartRate:80, systolicBP:120, diastolicBP:80, spo2:98, temperature:98.6, symptoms:'' })}} 
                       className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-lg rounded-2xl shadow-xl transition-colors"
                     >
                       Conclude Transport
                     </button>
                  </div>
               </div>
            </motion.section>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
