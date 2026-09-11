import React from 'react'
import { Link } from 'react-router-dom'
import { HeartPulse, Clock3, Hospital, Siren, ArrowRight, Users, Ambulance, Building2 } from 'lucide-react'

function SiteNav({ active }) {
  const linkClass = (key) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
      active === key
        ? 'bg-[#0f5c5a] text-white'
        : 'text-slate-500 hover:bg-white hover:text-slate-800'
    }`

  return (
    <header className="relative z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5c5a] text-white">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">Sanjeevan</p>
            <p className="text-[11px] font-medium text-slate-500">Hospital navigation network</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/" className={linkClass('about')}>About</Link>
          <Link to="/how-it-works" className={linkClass('how')}>How to use</Link>
          <Link to="/portals" className={linkClass('portals')}>Portals</Link>
        </nav>
      </div>
    </header>
  )
}

function PageShell({ active, children }) {
  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900">
      <SiteNav active={active} />
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
    </div>
  )
}

export default function Home() {
  return (
    <PageShell active="about">
      <section className="rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm md:px-12 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">About</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Faster emergency care when minutes decide outcomes.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
          Patients, ambulances, and hospitals still operate in silos. Time is lost finding a hospital
          with the right beds and specialists — while families wait without clear updates.
        </p>
      </section>

      <section className="mt-10">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">What we work on</p>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Clock3,
              title: 'The problem',
              copy: 'Ambulances guess destinations, hospitals learn too late, and citizens cannot see what happens after help is called.',
            },
            {
              icon: Siren,
              title: 'What we built',
              copy: 'One workflow for citizen reporting, dispatch, live vitals, hospital capacity, and ER handoff.',
            },
            {
              icon: Hospital,
              title: 'What we solve',
              copy: 'Better hospital matching, inbound visibility for ER teams, and a documented trip from call to handover.',
            },
          ].map((item) => (
            <article key={item.title} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Who we serve</p>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: 'Citizens',
              copy: 'Report from the patient app, earn rewards, and open a trip report after the emergency is logged.',
            },
            {
              icon: Ambulance,
              title: 'Ambulance teams',
              copy: 'Accept cases, stream vitals, and route to the hospital best able to stabilize the patient.',
            },
            {
              icon: Building2,
              title: 'Hospitals',
              copy: 'See inbound ambulances early, keep inventory current, and prepare ER handoff with live data.',
            },
          ].map((item) => (
            <article key={item.title} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#0f5c5a]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Next: step-by-step instructions for each role.</p>
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f5c5a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c4c4a]"
        >
          How to use <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PageShell>
  )
}

export { PageShell, SiteNav }
