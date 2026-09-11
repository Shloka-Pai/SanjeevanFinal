import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Smartphone, Ambulance, Building2, FileText } from 'lucide-react'
import { PageShell } from './Home'

const steps = [
  {
    for: 'Citizens',
    role: 'Patient app',
    icon: Smartphone,
    items: [
      'Register or sign in on the Sanjeevan patient app.',
      'Open Report, capture a photo, and submit Normal Assist or Critical Emergency.',
      'A trip report appears automatically in History as the case progresses.',
      'Use Health chat for first-aid guidance, and Profile for rewards and rank.',
    ],
  },
  {
    for: 'Ambulance teams',
    role: 'Web portal',
    icon: Ambulance,
    items: [
      'Sign in from the Portals page with your ambulance account.',
      'Accept a pending request from the dispatch queue.',
      'Enter vitals, rank hospitals, and stream updates live.',
      'Mark arrival at ER, then complete the mission after handoff.',
    ],
  },
  {
    for: 'Hospitals',
    role: 'Web portal',
    icon: Building2,
    items: [
      'Sign in from the Portals page with your hospital account.',
      'Keep ICU beds, ventilators, general beds, and specialists up to date.',
      'Select an inbound case to open routing and handoff details.',
      'Use live vitals to prepare the ER before the ambulance arrives.',
    ],
  },
]

export default function HowItWorks() {
  return (
    <PageShell active="how">
      <section className="page-hero-card rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm md:px-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">How to use</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          One workflow, three roles.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
          Follow the steps for your role. Citizens use the mobile app. Ambulance and hospital teams use the web portals.
        </p>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-3">
        {steps.map((step, index) => (
          <article key={step.for} className="workflow-card flex h-full flex-col rounded-3xl p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="workflow-icon flex h-11 w-11 items-center justify-center rounded-xl">
                <step.icon className="h-5 w-5" />
              </div>
              <span className="workflow-step-badge rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
                {index + 1}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{step.for}</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-teal-700">{step.role}</p>
            <ol className="mt-5 flex-1 space-y-4">
              {step.items.map((item, itemIndex) => (
                <li key={item} className="workflow-list-row flex gap-3 text-sm leading-relaxed text-slate-600">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                    {itemIndex + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <section className="workflow-summary-card mt-8 rounded-3xl p-6">
        <div className="flex items-start gap-3">
          <div className="workflow-summary-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Trip documentation</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              After a report is submitted, History automatically builds a record of call time, dispatch, ER arrival, and handover. Open any trip card to view or share it.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> About
        </Link>
        <Link
          to="/portals"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f5c5a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c4c4a]"
        >
          Portal login <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </PageShell>
  )
}
