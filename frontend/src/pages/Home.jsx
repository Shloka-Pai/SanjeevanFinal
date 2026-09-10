import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HeartPulse, Ambulance, Building2 } from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: "easeOut" } }
}

export default function Home() {
  return (
    <div className="min-h-screen animated-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />

      <motion.div 
        className="z-10 text-center mb-16"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="bg-white p-3 rounded-2xl shadow-soft">
            <HeartPulse className="text-blue-600 w-12 h-12 pulse-ring" />
          </div>
          <h1 className="text-6xl font-extrabold text-white tracking-tight drop-shadow-md">
            Sanjeevan
          </h1>
        </div>
        <p className="text-white/95 text-xl font-medium max-w-lg mx-auto leading-relaxed drop-shadow-sm">
          The ultimate platform connecting citizens, ambulances, and hospitals for rapid emergency response.
        </p>
      </motion.div>

      <motion.div 
        className="z-10 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <RoleCard 
          icon={Ambulance}
          title="Ambulance"
          description="Receive critical alerts and navigate to emergencies efficiently."
          path="/ambulance/login"
          color="rose"
        />
        <RoleCard 
          icon={Building2}
          title="Hospital"
          description="Manage inventory, incoming emergencies, and bed availability."
          path="/hospital/login"
          color="emerald"
        />
      </motion.div>
    </div>
  )
}

function RoleCard({ icon: Icon, title, description, path, color }) {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50/50",
    rose: "text-rose-600 bg-rose-50/50",
    emerald: "text-emerald-600 bg-emerald-50/50"
  }

  const borderMap = {
    blue: "hover:border-blue-300",
    rose: "hover:border-rose-300",
    emerald: "hover:border-emerald-300"
  }

  return (
    <motion.div variants={itemVariants} whileHover={{ y: -6, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Link to={path} className="block group h-full">
        <div className={`glass-panel-light rounded-3xl p-8 h-full transition-all duration-300 shadow-soft group-hover:shadow-xl ${borderMap[color]}`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-white ${colorMap[color]}`}>
            <Icon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">{title}</h2>
          <p className="text-gray-600 leading-relaxed font-medium mb-8">
            {description}
          </p>
          <div className={`flex items-center text-sm font-bold ${colorMap[color].split(' ')[0]} transition-colors`}>
            Get Started 
            <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
