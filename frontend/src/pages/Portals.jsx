import React from 'react'
import { Link } from 'react-router-dom'
import { Ambulance, Building2, ArrowLeft, LogIn, Smartphone } from 'lucide-react'
import { PageShell } from './Home'

export default function Portals() {
  return (
    <PageShell active="portals">
      <section className="page-hero-card rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm md:px-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Portals</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
          Sign in to your operations portal.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">
          Ambulance and hospital teams use this website. Citizens report emergencies from the Sanjeevan patient app.
        </p>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <PortalCard
          icon={Ambulance}
          title="Ambulance"
          description="Dispatch, vitals, hospital ranking, and ER handoff."
          points={['Accept live citizen requests', 'Rank hospitals by capacity', 'Stream vitals while en route']}
          loginPath="/ambulance/login"
          registerPath="/ambulance/register"
        />
        <PortalCard
          icon={Building2}
          title="Hospital"
          description="Inventory, inbound ambulances, and ER preparation."
          points={['Update beds and specialists', 'Watch inbound queue in real time', 'Open handoff with live vitals']}
          loginPath="/hospital/login"
          registerPath="/hospital/register"
        />
      </section>

      <section className="workflow-summary-card mt-6 rounded-3xl p-6">
        <div className="flex items-start gap-3">
          <div className="workflow-summary-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Citizen access</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Reporting, trip history, rewards, and health chat are available only in the patient mobile app — not on this website.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> How to use
        </Link>
      </section>
    </PageShell>
  )
}

function PortalCard({ icon: Icon, title, description, points, loginPath, registerPath }) {
  return (
    <article className="workflow-card flex h-full flex-col rounded-3xl p-7">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f5c5a] text-white shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-black text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {points.map((point) => (
          <li key={point} className="workflow-list-row rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700">
            {point}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={loginPath}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f5c5a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c4c4a]"
        >
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
        <Link
          to={registerPath}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Register
        </Link>
      </div>
    </article>
  )
}
