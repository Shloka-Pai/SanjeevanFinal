const ambulanceModel = require('../models/ambulance.model')
const incidentModel = require('../models/incident.model')
const hospitalModel = require('../models/hospital.model')
const axios = require('axios')
const { getIO } = require('../socket')
const {
  buildFallbackPrediction,
  buildIncidentRealtimePayload,
  canHospitalStabilize,
  determineSeverity,
  findClosestStabilizationHospital,
  getAvailableHospitals,
  getDistanceFromLatLonInKm,
  rankHospitalsForIncident,
  serializeHospitalOption,
} = require('../services/incident.service')
const { pushTimelineEvent } = require('../services/timeline.service')

async function populateIncident(incidentId) {
  return incidentModel
    .findById(incidentId)
    .populate('assignedAmbulance', 'vehicleNumber type status location')
    .populate('assignedHospital', 'name email location inventory status')
    .populate('selectedHospital', 'name email location inventory status')
    .populate('hospitalOptions.hospital', 'name email location inventory status')
}

function emitHospitalCaseUpdate(eventName, hospitalId, incident, extra = {}) {
  if (!hospitalId) return

  getIO().to(`hospital_${hospitalId}`).emit(eventName, {
    incident: buildIncidentRealtimePayload(incident),
    ...extra,
  })
}

function emitAmbulanceCaseUpdate(ambulanceId, incident, extra = {}) {
  if (!ambulanceId) return

  getIO().to(`ambulance_${ambulanceId}`).emit('ambulance_case_update', {
    incident: buildIncidentRealtimePayload(incident),
    ...extra,
  })
}

function emitCitizenTripUpdate(citizenId, incident) {
  if (!citizenId) return

  try {
    getIO().to(`citizen_${citizenId}`).emit('citizen_trip_update', {
      incident: buildIncidentRealtimePayload(incident),
    })
  } catch (err) {
    console.log('citizen trip socket emit skipped', err.message)
  }
}

async function getPendingIncidents(req, res) {
  try {
    const incidents = await incidentModel
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })

    res.status(200).json({
      incidents: incidents.map((incident) => buildIncidentRealtimePayload(incident)),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function getActiveIncident(req, res) {
  try {
    const activeIncident = await incidentModel
      .findOne({
        assignedAmbulance: req.user.id,
        status: 'assigned',
      })
      .sort({ updatedAt: -1 })
      .populate('assignedAmbulance', 'vehicleNumber type status location')
      .populate('assignedHospital', 'name email location inventory status')
      .populate('selectedHospital', 'name email location inventory status')
      .populate('hospitalOptions.hospital', 'name email location inventory status')

    const recentIncidents = await incidentModel
      .find({ assignedAmbulance: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('assignedAmbulance', 'vehicleNumber type status location')
      .populate('assignedHospital', 'name email location inventory status')
      .populate('selectedHospital', 'name email location inventory status')
      .populate('hospitalOptions.hospital', 'name email location inventory status')

    console.log('getActiveIncident → sending:', activeIncident ? activeIncident._id : null)

    res.status(200).json({
      incident: activeIncident ? buildIncidentRealtimePayload(activeIncident) : null,
      recentIncidents: recentIncidents.map((incident) => buildIncidentRealtimePayload(incident)),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function updateLocation(req, res) {
  try {
    const { lat, lng, incidentId } = req.body
    const location = { lat: Number(lat), lng: Number(lng) }

    const ambulance = await ambulanceModel.findByIdAndUpdate(
      req.user.id,
      {
        location,
        lastLocationUpdate: new Date(),
      },
      { returnDocument: 'after' },
    )

    if (incidentId) {
      const incident = await incidentModel.findByIdAndUpdate(
        incidentId,
        {
          ambulanceLocation: location,
        },
        { returnDocument: 'after' },
      )

      if (incident) {
        const populatedIncident = await populateIncident(incident._id)
        emitAmbulanceCaseUpdate(req.user.id, populatedIncident)
        emitHospitalCaseUpdate('patient_vitals_update', populatedIncident.assignedHospital?._id, populatedIncident)
      }
    }

    res.status(200).json({ message: 'Location updated', ambulance })
  } catch (err) {
    console.error('updateLocation error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

async function acceptIncident(req, res) {
  try {
    const { incidentId } = req.body
    const incident = await incidentModel.findById(incidentId)

    if (!incident || incident.status !== 'pending') {
      return res.status(400).json({ message: 'Incident not available.' })
    }

    incident.status = 'assigned'
    incident.assignedAmbulance = req.user.id
    incident.arrivalStatus = 'not-started'

    let preAllocatedHospital = null

    if (incident.isHighSeverityTrauma) {
      const level1Hospitals = await hospitalModel.find({ traumaLevel: 1, status: { $ne: 'offline' } })
      if (level1Hospitals.length > 0) {
        let closest = level1Hospitals[0]
        let minDistance = getDistanceFromLatLonInKm(
          incident.location.lat, incident.location.lng,
          closest.location.lat, closest.location.lng
        )
        for (let i=1; i<level1Hospitals.length; i++) {
          const dist = getDistanceFromLatLonInKm(
            incident.location.lat, incident.location.lng,
            level1Hospitals[i].location.lat, level1Hospitals[i].location.lng
          )
          if (dist < minDistance) {
            minDistance = dist
            closest = level1Hospitals[i]
          }
        }
        preAllocatedHospital = closest
        
        incident.selectedHospital = closest._id
        incident.assignedHospital = closest._id
        incident.transportStatus = 'en-route'
        incident.arrivalStatus = 'incoming'
        incident.severityLevel = 'critical'
      } else {
        incident.transportStatus = 'dispatching'
      }
    } else {
      incident.transportStatus = 'dispatching'
    }

    pushTimelineEvent(incident, 'ambulance_dispatched', {
      ambulanceId: String(req.user.id),
    })

    if (preAllocatedHospital) {
      pushTimelineEvent(incident, 'hospital_selected', {
        hospital: preAllocatedHospital.name,
      })
      pushTimelineEvent(incident, 'en_route_hospital', {
        hospital: preAllocatedHospital.name,
      })
    }

    await incident.save()

    const populatedIncident = await populateIncident(incident._id)

    getIO().to('ambulance').emit('incident_taken', { incidentId })
    
    if (preAllocatedHospital) {
      emitHospitalCaseUpdate('incoming_patient', preAllocatedHospital._id, populatedIncident, {
        eta: '10 mins',
        rerouted: false,
      })
    }
    
    emitAmbulanceCaseUpdate(req.user.id, populatedIncident)
    emitCitizenTripUpdate(populatedIncident.reportedBy, populatedIncident)

    res.status(200).json({
      message: 'Incident accepted',
      incident: buildIncidentRealtimePayload(populatedIncident),
      allocatedHospital: preAllocatedHospital ? serializeHospitalOption({
        hospital: preAllocatedHospital,
        distanceKm: getDistanceFromLatLonInKm(incident.location.lat, incident.location.lng, preAllocatedHospital.location.lat, preAllocatedHospital.location.lng),
        capabilityScore: 10,
        matchesAllRequirements: true,
        availableResources: preAllocatedHospital.inventory
      }) : null
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function predictAllocation(req, res) {
  try {
    const { incidentId, vitals } = req.body
    const incident = await incidentModel.findById(incidentId)

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    let mlPrediction
    try {
      const response = await axios.post('http://127.0.0.1:8000/predict', vitals)
      mlPrediction = response.data
    } catch (mlErr) {
      console.warn('ML Service unavailable, using local triage engine:', mlErr.message)
      mlPrediction = buildFallbackPrediction(vitals)
    }

    const allHospitals = await getAvailableHospitals()
    const rankedHospitals = await rankHospitalsForIncident(
      { ...incident.toObject(), mlPrediction },
      allHospitals,
    )
    const bestHospitalOption = rankedHospitals[0]

    incident.vitals = {
      ...vitals,
      heartRate: Number(vitals.heartRate),
      systolicBP: Number(vitals.systolicBP),
      diastolicBP: Number(vitals.diastolicBP),
      spo2: Number(vitals.spo2),
      temperature: Number(vitals.temperature),
    }
    incident.vitalsUpdatedAt = new Date()
    incident.mlPrediction = mlPrediction
    incident.severityLevel = determineSeverity(incident.vitals)
    incident.hospitalOptions = rankedHospitals
    incident.selectedHospital = bestHospitalOption?.hospital || null
    incident.assignedHospital = bestHospitalOption?.hospital || null
    incident.transportStatus = 'en-route'
    incident.arrivalStatus = 'incoming'

    const hospitalName = bestHospitalOption?.name || bestHospitalOption?.hospital?.name
    if (hospitalName) {
      pushTimelineEvent(incident, 'hospital_selected', { hospital: hospitalName })
    }
    pushTimelineEvent(incident, 'en_route_hospital', {
      hospital: hospitalName || undefined,
    })

    await incident.save()

    const populatedIncident = await populateIncident(incident._id)

    if (populatedIncident.assignedHospital?._id) {
      emitHospitalCaseUpdate('incoming_patient', populatedIncident.assignedHospital._id, populatedIncident, {
        eta: '10 mins',
        rerouted: false,
      })
    }

    emitAmbulanceCaseUpdate(req.user.id, populatedIncident)
    emitCitizenTripUpdate(populatedIncident.reportedBy, populatedIncident)

    res.status(200).json({
      message: 'Prediction and allocation complete',
      incident: buildIncidentRealtimePayload(populatedIncident),
      bestHospital: serializeHospitalOption(rankedHospitals[0]),
      availableHospitals: rankedHospitals.map(serializeHospitalOption),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
}

async function selectHospital(req, res) {
  try {
    const { incidentId, hospitalId } = req.body
    const incident = await incidentModel.findById(incidentId)

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    const previousHospitalId = incident.assignedHospital ? String(incident.assignedHospital) : null
    const nextHospital = await hospitalModel.findById(hospitalId)

    if (!nextHospital) {
      return res.status(404).json({ message: 'Hospital not found' })
    }

    incident.selectedHospital = nextHospital._id
    incident.assignedHospital = nextHospital._id
    incident.transportStatus = 'en-route'
    incident.arrivalStatus = 'incoming'

    pushTimelineEvent(incident, 'hospital_selected', {
      hospital: nextHospital.name,
    })
    pushTimelineEvent(incident, 'en_route_hospital', {
      hospital: nextHospital.name,
    })

    await incident.save()

    const populatedIncident = await populateIncident(incident._id)

    if (previousHospitalId && previousHospitalId !== String(nextHospital._id)) {
      emitHospitalCaseUpdate('patient_rerouted_away', previousHospitalId, populatedIncident, {
        reason: 'Destination changed by ambulance',
      })
    }

    emitHospitalCaseUpdate('incoming_patient', nextHospital._id, populatedIncident, {
      eta: '10 mins',
      rerouted: previousHospitalId && previousHospitalId !== String(nextHospital._id),
    })
    emitAmbulanceCaseUpdate(req.user.id, populatedIncident)
    emitCitizenTripUpdate(populatedIncident.reportedBy, populatedIncident)

    res.status(200).json({
      message: 'Hospital selected',
      incident: buildIncidentRealtimePayload(populatedIncident),
      selectedHospital: serializeHospitalOption(
        populatedIncident.hospitalOptions.find(
          (option) => String(option.hospital?._id || option.hospital) === String(nextHospital._id),
        ) || {
          hospital: nextHospital._id,
          name: nextHospital.name,
          status: nextHospital.status,
          location: nextHospital.location,
          availableResources: nextHospital.inventory,
        },
      ),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function streamVitals(req, res) {
  try {
    const { incidentId, vitals, ambulanceLocation } = req.body
    const incident = await incidentModel.findById(incidentId)

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    incident.vitals = {
      ...incident.vitals,
      ...vitals,
      heartRate: Number(vitals.heartRate),
      systolicBP: Number(vitals.systolicBP),
      diastolicBP: Number(vitals.diastolicBP),
      spo2: Number(vitals.spo2),
      temperature: Number(vitals.temperature),
    }
    incident.vitalsUpdatedAt = new Date()
    incident.severityLevel = determineSeverity(incident.vitals)

    if (ambulanceLocation?.lat && ambulanceLocation?.lng) {
      incident.ambulanceLocation = {
        lat: Number(ambulanceLocation.lat),
        lng: Number(ambulanceLocation.lng),
      }
    }

    let rerouted = false
    let rerouteReason = ''
    let previousHospitalId = incident.assignedHospital ? String(incident.assignedHospital) : null

    const currentHospital = incident.assignedHospital
      ? await hospitalModel.findById(incident.assignedHospital)
      : null

    const currentHospitalCanStabilize = currentHospital
      ? canHospitalStabilize(currentHospital, incident.severityLevel)
      : false

    if (incident.severityLevel === 'critical' && !currentHospitalCanStabilize) {
      const stabilizationHospital = await findClosestStabilizationHospital(
        incident,
        incident.assignedHospital,
        incident.severityLevel,
      )

      if (
        stabilizationHospital &&
        String(stabilizationHospital.hospital) !== previousHospitalId
      ) {
        rerouted = true
        rerouteReason = 'Vitals turned critical. Redirecting to the nearest stabilisation-ready hospital.'
        incident.rerouteHistory.push({
          fromHospital: incident.assignedHospital,
          toHospital: stabilizationHospital.hospital,
          reason: rerouteReason,
        })
        incident.assignedHospital = stabilizationHospital.hospital
        incident.selectedHospital = stabilizationHospital.hospital
        incident.transportStatus = 'rerouted'
        pushTimelineEvent(incident, 'rerouted', {
          reason: rerouteReason,
          hospital: stabilizationHospital.name,
        })
      }
    }

    await incident.save()
    const populatedIncident = await populateIncident(incident._id)

    if (rerouted && previousHospitalId) {
      emitHospitalCaseUpdate('patient_rerouted_away', previousHospitalId, populatedIncident, {
        reason: rerouteReason,
      })
    }

    emitHospitalCaseUpdate(
      rerouted ? 'patient_rerouted' : 'patient_vitals_update',
      populatedIncident.assignedHospital?._id,
      populatedIncident,
      {
        reason: rerouteReason,
      },
    )
    emitAmbulanceCaseUpdate(req.user.id, populatedIncident, {
      rerouted,
      reason: rerouteReason,
    })
    emitCitizenTripUpdate(populatedIncident.reportedBy, populatedIncident)

    res.status(200).json({
      message: rerouted ? 'Vitals streamed and route updated' : 'Vitals streamed',
      incident: buildIncidentRealtimePayload(populatedIncident),
      rerouted,
      reason: rerouteReason,
      selectedHospital: populatedIncident.assignedHospital
        ? {
            hospitalId: populatedIncident.assignedHospital._id,
            name: populatedIncident.assignedHospital.name,
            location: populatedIncident.assignedHospital.location,
            status: populatedIncident.assignedHospital.status,
            availableResources: populatedIncident.assignedHospital.inventory,
          }
        : null,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function markArrival(req, res) {
  try {
    const { incidentId } = req.body
    const incident = await incidentModel.findById(incidentId)

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    incident.arrivalStatus = 'arrived'
    incident.transportStatus = 'arriving'

    let hospitalName
    if (incident.assignedHospital) {
      const hospital = await hospitalModel.findById(incident.assignedHospital).select('name')
      hospitalName = hospital?.name
    }
    pushTimelineEvent(incident, 'arrived_er', {
      hospital: hospitalName,
    })
    await incident.save()

    const populatedIncident = await populateIncident(incident._id)
    emitHospitalCaseUpdate('patient_arrived', populatedIncident.assignedHospital?._id, populatedIncident)
    emitAmbulanceCaseUpdate(req.user.id, populatedIncident)
    emitCitizenTripUpdate(populatedIncident.reportedBy, populatedIncident)

    res.status(200).json({
      message: 'Hospital arrival marked',
      incident: buildIncidentRealtimePayload(populatedIncident),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

async function completeIncident(req, res) {
  try {
    const { incidentId } = req.body
    console.log('completeIncident → completing:', incidentId)

    const existing = await incidentModel.findById(incidentId)
    if (!existing) {
      return res.status(404).json({ message: 'Incident not found' })
    }

    existing.status = 'completed'
    existing.transportStatus = 'completed'
    pushTimelineEvent(existing, 'er_handover', {})
    await existing.save()

    console.log('completeIncident → updated status:', existing.status)

    const populatedIncident = await populateIncident(existing._id)
    emitHospitalCaseUpdate('patient_completed', populatedIncident.assignedHospital?._id, populatedIncident)
    emitCitizenTripUpdate(populatedIncident.reportedBy, populatedIncident)

    res.status(200).json({
      message: 'Incident marked as completed',
      incident: buildIncidentRealtimePayload(populatedIncident),
    })
  } catch (err) {
    console.error('completeIncident error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  acceptIncident,
  completeIncident,
  getActiveIncident,
  getPendingIncidents,
  markArrival,
  predictAllocation,
  selectHospital,
  streamVitals,
  updateLocation,
}
