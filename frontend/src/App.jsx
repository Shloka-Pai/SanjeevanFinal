import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import Portals from './pages/Portals'

// Auth Pages
import CitizenAuth from './pages/citizen/CitizenAuth'
import AmbulanceAuth from './pages/ambulance/AmbulanceAuth'
import HospitalAuth from './pages/hospital/HospitalAuth'

// Dashboards
import CitizenDashboard from './pages/citizen/CitizenDashboard'
import AmbulanceDashboard from './pages/ambulance/AmbulanceDashboardLive'
import HospitalDashboard from './pages/hospital/HospitalDashboardLive'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/portals" element={<Portals />} />
          
          {/* Citizen Routes */}
          <Route path="/citizen/login" element={<CitizenAuth mode="login" />} />
          <Route path="/citizen/register" element={<CitizenAuth mode="register" />} />
          <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
          
          {/* Ambulance Routes */}
          <Route path="/ambulance/login" element={<AmbulanceAuth mode="login" />} />
          <Route path="/ambulance/register" element={<AmbulanceAuth mode="register" />} />
          <Route path="/ambulance/dashboard" element={<AmbulanceDashboard />} />
          
          {/* Hospital Routes */}
          <Route path="/hospital/login" element={<HospitalAuth mode="login" />} />
          <Route path="/hospital/register" element={<HospitalAuth mode="register" />} />
          <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
