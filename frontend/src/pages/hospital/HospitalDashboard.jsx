import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Activity, MapPin, BellRing, Settings2, Save, Map as MapIcon, Loader2 } from 'lucide-react'
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api'

const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '1.5rem' }

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.8, 0.25, 1] } }
}

export default function HospitalDashboard() {
  const { user, API_URL, API_ORIGIN, logout } = useAuth()
  
  const [inventory, setInventory] = useState({
    icuBeds: user?.inventory?.icuBeds || 0,
    ventilators: user?.inventory?.ventilators || 0,
    generalBeds: user?.inventory?.generalBeds || 0,
    specialists: user?.inventory?.specialists?.join(', ') || 'general'
  })
  
  const [savingInv, setSavingInv] = useState(false)
  const [incomingPatients, setIncomingPatients] = useState([])
  const [activeRoute, setActiveRoute] = useState(null)
  
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: 'AIzaSyCR7LdvZDlkYsjANjULsrQXn7iOw46oH1Q' })

  const hospitalId = user?.id || user?._id
  const hospitalLoc = user?.location || { lat: 18.5204, lng: 73.8567 }

  useEffect(() => {
    if(!hospitalId) return;
    const socket = io(API_ORIGIN, { withCredentials: true })

    socket.emit('join', `hospital_${hospitalId}`)

    socket.on('incoming_patient', (data) => {
      setIncomingPatients(prev => [data, ...prev])

      if (window.google) {
         fetchDirections(data.incident.location, hospitalLoc)
      }
    })

    return () => socket.disconnect()
  }, [hospitalId, hospitalLoc, API_ORIGIN])

  const fetchDirections = (origin, destination) => {
    if(!window.google) return;
    const directionsService = new window.google.maps.DirectionsService()
    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setActiveRoute(result)
        } else {
          console.error("Directions lookup failed:", status)
        }
      }
    )
  }

  const handleInventoryUpdate = async (e) => {
    e.preventDefault()
    setSavingInv(true)
    try {
      const payload = {
        icuBeds: Number(inventory.icuBeds),
        ventilators: Number(inventory.ventilators),
        generalBeds: Number(inventory.generalBeds),
        specialists: typeof inventory.specialists === 'string' ? inventory.specialists.split(',').map(s=>s.trim()) : inventory.specialists
      }
      await axios.put(`${API_URL}/hospital/inventory`, { inventory: payload })
      alert("Inventory synced securely.")
    } catch (err) {
      alert("Failed updating inventory.")
    } finally {
      setSavingInv(false)
    }
  }

  if (!user || user.role !== 'hospital') return <Navigate to="/hospital/login" />

  return (
    <div className="min-h-screen medical-mesh-bg flex flex-col p-4 md:p-8">
      
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto w-full flex justify-between items-center glass-panel p-4 md:p-6 rounded-[2rem] shadow-sm z-10 relative mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg relative overflow-hidden">
             <div className="absolute inset-0 bg-white/20 blur-md pointer-events-none"></div>
             <Building2 className="w-6 h-6 z-10" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Command Center</p>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">{user.name}</h1>
          </div>
        </div>
        <button onClick={logout} className="text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-5 py-2.5 rounded-xl font-bold transition-colors">Sign out</button>
      </motion.header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        
        {/* Left Column: Inventory */}
        <div className="space-y-8">
          <motion.section variants={itemVariants} className="glass-panel p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-emerald-50 rounded-xl">
                 <Settings2 className="w-5 h-5 text-emerald-600"/>
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Active Inventory</h2>
            </div>
            
            <form onSubmit={handleInventoryUpdate} className="space-y-5">
              {[
                { label: 'Available ICU Beds', key: 'icuBeds', type: 'number' },
                { label: 'Available Ventilators', key: 'ventilators', type: 'number' },
                { label: 'General Beds', key: 'generalBeds', type: 'number' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{field.label}</label>
                  <input 
                    type={field.type} 
                    className="input-glass w-full text-slate-700 rounded-xl p-3 font-semibold text-lg" 
                    value={inventory[field.key]} 
                    onChange={e=>setInventory({...inventory, [field.key]: e.target.value})} 
                  />
                </div>
              ))}
              
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">On-Call Specialists</label>
                <input 
                  type="text" 
                  className="input-glass w-full text-slate-700 rounded-xl p-3 font-medium text-sm" 
                  value={inventory.specialists} 
                  onChange={e=>setInventory({...inventory, specialists: e.target.value})} 
                />
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Comma separated</p>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit" 
                disabled={savingInv} 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mt-6 transition-colors"
              >
                {savingInv ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5"/>} Commit to ML Engine
              </motion.button>
            </form>
          </motion.section>
        </div>

        {/* Right Column: Routing & Alerts */}
        <div className="lg:col-span-2 space-y-8 flex flex-col">
          
          <motion.section variants={itemVariants} className="creative-card p-4 rounded-[2.5rem] flex-1 min-h-[400px] flex flex-col relative shadow-sm border border-slate-100/50">
            <div className="px-4 pt-4 pb-2 mb-2 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-50 rounded-xl">
                   <MapIcon className="w-5 h-5 text-blue-600"/>
                 </div>
                 <h2 className="text-xl font-bold text-slate-800 tracking-tight">Live Routing Feed</h2>
               </div>
               {activeRoute && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">Tracking Unit</span>}
            </div>
            
            <div className="flex-1 bg-slate-100 rounded-[1.5rem] overflow-hidden relative border border-slate-200/50 shadow-inner">
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                  <div className="flex flex-col items-center gap-3">
                     <Loader2 className="w-8 h-8 animate-spin text-slate-300"/>
                     <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Initializing Map</span>
                  </div>
                </div>
              )}
              
              {isLoaded && (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={hospitalLoc}
                  zoom={14}
                  options={{ disableDefaultUI: true, styles: [ { featureType: "poi.medical", stylers: [{ visibility: "on" }] } ] }}
                >
                  <Marker position={hospitalLoc} label={{ text: "H", color: "white", fontWeight: "bold" }} />
                  {activeRoute && (
                    <DirectionsRenderer 
                       directions={activeRoute} 
                       options={{
                         polylineOptions: { strokeColor: '#059669', strokeWeight: 6, strokeOpacity: 0.8 }
                       }}
                    />
                  )}
                </GoogleMap>
              )}
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="glass-panel p-6 md:p-8 rounded-[2.5rem]">
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-xl">
                     <BellRing className={`w-5 h-5 text-rose-500 ${incomingPatients.length > 0 ? 'animate-pulse' : ''}`}/>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Incoming Alerts</h2>
                </div>
                
                {incomingPatients.length > 0 && (
                  <span className="bg-rose-100 border border-rose-200 text-rose-700 font-bold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest shadow-sm">
                    {incomingPatients.length} En Route
                  </span>
                )}
             </div>

             <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               {incomingPatients.length === 0 && (
                 <div className="py-12 flex flex-col items-center justify-center text-center">
                   <Activity className="w-12 h-12 text-slate-200 mb-3"/>
                   <p className="text-slate-400 font-bold text-lg">All Clear</p>
                   <p className="text-slate-400 text-sm font-medium mt-1">No incoming emergencies currently targeted to your facility.</p>
                 </div>
               )}
               
               <AnimatePresence>
                 {incomingPatients.map((req, idx) => (
                   <motion.div 
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     key={idx} 
                     className="p-5 md:p-6 border border-rose-100 bg-white rounded-[1.5rem] shadow-sm flex flex-col gap-4 relative overflow-hidden"
                   >
                     <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>

                     <div className="flex justify-between items-start">
                       <div>
                         <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Critical Impact</span>
                         <h3 className="font-bold text-slate-800 mt-2 text-lg">Patient inbound via Ambulance</h3>
                       </div>
                       <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-center shadow-sm">
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Predicted ETA</p>
                         <p className="font-black text-rose-600 text-xl tracking-tighter">{req.eta}</p>
                       </div>
                     </div>

                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                       <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                         <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">ICU Required</p>
                         <p className="font-bold text-slate-700">{req.incident.mlPrediction?.icuBeds_Required > 0 ? 'YES' : 'NO'}</p>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                         <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">SpO2</p>
                         <p className="font-bold text-rose-600">{req.incident.vitals?.spo2}%</p>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                         <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Blood Press.</p>
                         <p className="font-bold text-slate-700">{req.incident.vitals?.systolicBP}/{req.incident.vitals?.diastolicBP}</p>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                         <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Specialty Limit</p>
                         <p className="font-bold text-slate-700 capitalize truncate">{req.incident.mlPrediction?.specialists_Needed?.join(', ') || "None"}</p>
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
          </motion.section>

        </div>

      </motion.div>
    </div>
  )
}
