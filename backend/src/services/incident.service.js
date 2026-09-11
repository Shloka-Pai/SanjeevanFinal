const axios = require('axios')
const hospitalModel = require('../models/hospital.model')
const incidentModel = require('../models/incident.model')

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

async function getOsrmRoutingData(originCoords, hospitals) {
  if (!hospitals || hospitals.length === 0) return [];
  
  const coords = [`${originCoords.lng},${originCoords.lat}`];
  hospitals.forEach(h => {
    coords.push(`${h.location.lng},${h.location.lat}`);
  });
  
  const coordsString = coords.join(';');
  const url = `http://router.project-osrm.org/table/v1/driving/${coordsString}?sources=0&annotations=distance,duration`;
  
  try {
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.code !== 'Ok' || !data.distances || !data.durations) {
      throw new Error("Invalid OSRM Response");
    }
    
    const distances = data.distances[0]; 
    const durations = data.durations[0];
    
    return hospitals.map((h, i) => {
      const distMeters = distances[i + 1] || 0;
      const durationSeconds = durations[i + 1] || 0;

      return {
        hospitalId: String(h._id || h.hospital),
        distanceKm: distMeters / 1000,
        etaMins: Math.ceil(durationSeconds / 60)
      };
    });
  } catch (error) {
    console.warn("OSRM Table Route failed, falling back to Haversine", error.message);
    return hospitals.map(h => ({
      hospitalId: String(h._id || h.hospital),
      distanceKm: getDistanceFromLatLonInKm(originCoords.lat, originCoords.lng, h.location.lat, h.location.lng),
      etaMins: Math.ceil(getDistanceFromLatLonInKm(originCoords.lat, originCoords.lng, h.location.lat, h.location.lng) * 2) 
    }));
  }
}

function normalizeSpecialists(list = []) {
  return list
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
}

function determineSeverity(vitals = {}) {
  const heartRate = Number(vitals.heartRate)
  const systolicBP = Number(vitals.systolicBP)
  const diastolicBP = Number(vitals.diastolicBP)
  const spo2 = Number(vitals.spo2)
  const temperature = Number(vitals.temperature)

  const critical =
    spo2 < 90 ||
    systolicBP < 90 ||
    diastolicBP < 60 ||
    heartRate < 45 ||
    heartRate > 140 ||
    temperature >= 103

  if (critical) return 'critical'

  const watch =
    spo2 < 94 ||
    systolicBP < 100 ||
    diastolicBP < 70 ||
    heartRate < 55 ||
    heartRate > 120 ||
    temperature >= 100.4

  return watch ? 'watch' : 'stable'
}

function buildRequirementSummary(mlPrediction = {}) {
  return {
    icuBeds: Number(mlPrediction.icuBeds_Required || 0),
    ventilators: Number(mlPrediction.ventilators_Required || 0),
    generalBeds: Number(mlPrediction.generalBeds_Required || 0),
    specialists: mlPrediction.specialists_Needed || ['general'],
  }
}

function buildFallbackPrediction(vitals = {}) {
  const heartRate = Number(vitals.heartRate || 0)
  const systolicBP = Number(vitals.systolicBP || 0)
  const spo2 = Number(vitals.spo2 || 0)
  const symptoms = String(vitals.symptoms || '').toLowerCase()

  const specialists = new Set(['general'])
  if (/(chest|cardiac|heart)/.test(symptoms)) specialists.add('cardiac')
  if (/(stroke|seizure|neuro|brain|head)/.test(symptoms)) specialists.add('neuro')
  if (/(bleeding|fracture|trauma|injury)/.test(symptoms)) specialists.add('trauma')
  if (/(breath|respiratory|oxygen|asthma)/.test(symptoms)) specialists.add('pulmonology')

  const isCritical = spo2 < 90 || systolicBP < 90 || heartRate > 140 || heartRate < 45
  const isHighRisk = spo2 < 94 || systolicBP < 100 || heartRate > 120 || heartRate < 55

  return {
    icuBeds_Required: isCritical ? 1 : 0,
    ventilators_Required: spo2 < 88 ? 1 : 0,
    generalBeds_Required: 1,
    specialists_Needed: Array.from(specialists),
    triageLevel: isCritical ? 'critical' : isHighRisk ? 'watch' : 'stable',
  }
}

function buildHospitalOption(hospital, incidentLocation, requirements = {}, routingInfo = null) {
  const inventory = hospital.inventory || {}
  
  let distanceKm = 0;
  let etaMins = 0;
  if (routingInfo) {
    distanceKm = routingInfo.distanceKm;
    etaMins = routingInfo.etaMins;
  } else {
    distanceKm = getDistanceFromLatLonInKm(
      incidentLocation.lat,
      incidentLocation.lng,
      hospital.location.lat,
      hospital.location.lng,
    );
    etaMins = Math.ceil(distanceKm * 2);
  }

  const hospitalSpecialists = normalizeSpecialists(inventory.specialists)
  const requiredSpecialists = normalizeSpecialists(requirements.specialists)

  const meetsIcu = (inventory.icuBeds || 0) >= (requirements.icuBeds || 0)
  const meetsVent = (inventory.ventilators || 0) >= (requirements.ventilators || 0)
  const meetsGeneral = (inventory.generalBeds || 0) >= (requirements.generalBeds || 0)

  const needsSpecificSpecialist =
    requiredSpecialists.length > 0 && !requiredSpecialists.includes('general')
  const meetsSpecialists = needsSpecificSpecialist
    ? requiredSpecialists.some((specialist) => hospitalSpecialists.includes(specialist))
    : true

  const matchesAllRequirements = meetsIcu && meetsVent && meetsGeneral && meetsSpecialists
  const capabilityScore =
    (meetsIcu ? 3 : 0) +
    (meetsVent ? 3 : 0) +
    (meetsGeneral ? 2 : 0) +
    (meetsSpecialists ? 2 : 0)

  return {
    hospital: hospital._id,
    name: hospital.name,
    status: hospital.status,
    location: hospital.location,
    distanceKm: Number(distanceKm.toFixed(2)),
    capabilityScore,
    matchesAllRequirements,
    availableResources: {
      icuBeds: inventory.icuBeds || 0,
      ventilators: inventory.ventilators || 0,
      generalBeds: inventory.generalBeds || 0,
      specialists: inventory.specialists || [],
    },
  }
}

async function getEffectiveHospitals(hospitals) {
  const activeIncidents = await incidentModel.find({
    status: { $ne: 'completed' },
    transportStatus: { $in: ['dispatching', 'en-route', 'rerouted'] },
    arrivalStatus: { $ne: 'arrived' },
    assignedHospital: { $ne: null }
  });

  const reservedMap = {};
  for (const inc of activeIncidents) {
    const hId = String(inc.assignedHospital);
    if (!reservedMap[hId]) {
      reservedMap[hId] = { icuBeds: 0, ventilators: 0, generalBeds: 0 };
    }
    const reqs = buildRequirementSummary(inc.mlPrediction);
    reservedMap[hId].icuBeds += (reqs.icuBeds || 0);
    reservedMap[hId].ventilators += (reqs.ventilators || 0);
    reservedMap[hId].generalBeds += (reqs.generalBeds || 0);
  }

  return hospitals.map(h => {
    const hObj = h.toObject ? h.toObject() : { ...h };
    const hId = String(hObj._id);
    if (reservedMap[hId] && hObj.inventory) {
      hObj.inventory.icuBeds = Math.max(0, (hObj.inventory.icuBeds || 0) - reservedMap[hId].icuBeds);
      hObj.inventory.ventilators = Math.max(0, (hObj.inventory.ventilators || 0) - reservedMap[hId].ventilators);
      hObj.inventory.generalBeds = Math.max(0, (hObj.inventory.generalBeds || 0) - reservedMap[hId].generalBeds);
    }
    return hObj;
  });
}

async function rankHospitalsForIncident(incident, hospitals) {
  const effectiveHospitals = await getEffectiveHospitals(hospitals);
  const requirements = buildRequirementSummary(incident.mlPrediction);
  
  const routingData = await getOsrmRoutingData(incident.location, effectiveHospitals);
  const routingMap = {};
  routingData.forEach(r => { routingMap[r.hospitalId] = r; });

  const ranked = effectiveHospitals
    .filter((hospital) => hospital.status !== 'offline')
    .map((hospital) => buildHospitalOption(hospital, incident.location, requirements, routingMap[String(hospital._id)]))
    .sort((a, b) => {
      if (b.capabilityScore !== a.capabilityScore) {
        return b.capabilityScore - a.capabilityScore
      }

      if (b.matchesAllRequirements !== a.matchesAllRequirements) {
        return Number(b.matchesAllRequirements) - Number(a.matchesAllRequirements)
      }

      if (a.etaMins !== b.etaMins) {
        return a.etaMins - b.etaMins
      }

      return a.distanceKm - b.distanceKm
    })

  return ranked.map((option, index) => ({ ...option, isBestMatch: index === 0 }))
}

async function getAvailableHospitals() {
  return hospitalModel.find({ status: { $ne: 'offline' } }).sort({ createdAt: 1 })
}

function canHospitalStabilize(hospitalLike, severityLevel = 'stable') {
  const hospital = hospitalLike.hospital || hospitalLike
  const inventory = hospital.availableResources || hospital.inventory || {}
  const status = hospital.status

  if (status !== 'active') return false

  if (severityLevel === 'critical') {
    return (inventory.icuBeds || 0) > 0 || (inventory.ventilators || 0) > 0 || (inventory.generalBeds || 0) > 1
  }

  return (inventory.generalBeds || 0) > 0 || (inventory.icuBeds || 0) > 0
}

async function findClosestStabilizationHospital(incident, currentHospitalId, severityLevel = 'critical') {
  const hospitals = await hospitalModel.find({ status: 'active' })
  const effectiveHospitals = await getEffectiveHospitals(hospitals);
  
  const origin = incident.ambulanceLocation || incident.location;
  const routingData = await getOsrmRoutingData(origin, effectiveHospitals);
  const routingMap = {};
  routingData.forEach(r => { routingMap[r.hospitalId] = r; });

  const candidates = effectiveHospitals
    .map((hospital) => buildHospitalOption(hospital, origin, {
      icuBeds: 0,
      ventilators: 0,
      generalBeds: 1,
      specialists: ['general'],
    }, routingMap[String(hospital._id)]))
    .filter((option) => canHospitalStabilize(option, severityLevel))
    .sort((a, b) => a.etaMins - b.etaMins || a.distanceKm - b.distanceKm)

  const currentHospitalIdString = currentHospitalId ? String(currentHospitalId) : null
  const alternative = candidates.find((candidate) => String(candidate.hospital) !== currentHospitalIdString)

  return alternative || candidates[0] || null
}

function serializeHospitalOption(option) {
  return {
    hospitalId: option.hospital?._id || option.hospital,
    name: option.name || option.hospital?.name,
    status: option.status || option.hospital?.status,
    location: option.location || option.hospital?.location,
    distanceKm: option.distanceKm,
    etaMins: option.etaMins,
    capabilityScore: option.capabilityScore,
    matchesAllRequirements: option.matchesAllRequirements,
    isBestMatch: option.isBestMatch,
    availableResources: option.availableResources,
  }
}

function buildIncidentRealtimePayload(incident) {
  const hospitalOptions = (incident.hospitalOptions || []).map(serializeHospitalOption)

  return {
    _id: incident._id,
    aidType: incident.aidType,
    description: incident.description,
    image: incident.image,
    location: incident.location,
    ambulanceLocation: incident.ambulanceLocation,
    status: incident.status,
    transportStatus: incident.transportStatus,
    arrivalStatus: incident.arrivalStatus,
    severityLevel: incident.severityLevel,
    vitals: incident.vitals,
    vitalsUpdatedAt: incident.vitalsUpdatedAt,
    mlPrediction: incident.mlPrediction,
    requirements: buildRequirementSummary(incident.mlPrediction),
    symptoms: incident.vitals?.symptoms || '',
    assignedAmbulance: incident.assignedAmbulance,
    assignedHospital: incident.assignedHospital,
    selectedHospital: incident.selectedHospital,
    hospitalOptions,
    rerouteHistory: incident.rerouteHistory || [],
    timelineEvents: incident.timelineEvents || [],
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  }
}

module.exports = {
  buildFallbackPrediction,
  buildIncidentRealtimePayload,
  buildRequirementSummary,
  canHospitalStabilize,
  determineSeverity,
  findClosestStabilizationHospital,
  getAvailableHospitals,
  getDistanceFromLatLonInKm,
  rankHospitalsForIncident,
  serializeHospitalOption,
}
