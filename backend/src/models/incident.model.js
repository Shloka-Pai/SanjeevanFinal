const mongoose = require('mongoose')

const incidentSchema = new mongoose.Schema({

    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'citizen',
        required: true
    },

    image: {
        type: String, // store URL/path
        required: true
    },

    aidType: {
        type: String,
        enum: ['normal', 'emergency'],
        required: true
    },

    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },

    description: {
        type: String
    },

    status: {
        type: String,
        enum: ['pending', 'assigned', 'completed'],
        default: 'pending'
    },

    transportStatus: {
        type: String,
        enum: ['awaiting-acceptance', 'dispatching', 'en-route', 'rerouted', 'arriving', 'completed'],
        default: 'awaiting-acceptance'
    },

    arrivalStatus: {
        type: String,
        enum: ['not-started', 'incoming', 'arrived'],
        default: 'not-started'
    },

    assignedAmbulance: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ambulance',
        default: null
    },

    assignedHospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hospital',
        default: null
    },

    selectedHospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hospital',
        default: null
    },

    hospitalOptions: [
        {
            hospital: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'hospital'
            },
            name: String,
            status: String,
            location: {
                lat: Number,
                lng: Number
            },
            distanceKm: Number,
            capabilityScore: Number,
            matchesAllRequirements: Boolean,
            isBestMatch: Boolean,
            availableResources: {
                icuBeds: Number,
                ventilators: Number,
                generalBeds: Number,
                specialists: [String]
            }
        }
    ],

    ambulanceLocation: {
        lat: Number,
        lng: Number
    },

    vitals: {
        heartRate: Number,
        systolicBP: Number,
        diastolicBP: Number,
        spo2: Number,
        temperature: Number,
        symptoms: String
    },

    vitalsUpdatedAt: {
        type: Date,
        default: null
    },

    severityLevel: {
        type: String,
        enum: ['stable', 'watch', 'critical'],
        default: 'stable'
    },

    mlPrediction: {
        icuBeds_Required: Number,
        ventilators_Required: Number,
        generalBeds_Required: Number,
        specialists_Needed: [String]
    },

    rerouteHistory: [
        {
            fromHospital: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'hospital'
            },
            toHospital: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'hospital'
            },
            reason: String,
            triggeredAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    isHighSeverityTrauma: {
        type: Boolean,
        default: false
    },

    traumaSeverityAssessment: {
        type: String
    },

    timelineEvents: [
        {
            type: {
                type: String,
                enum: [
                    'ambulance_called',
                    'ambulance_dispatched',
                    'en_route_hospital',
                    'hospital_selected',
                    'rerouted',
                    'arrived_er',
                    'er_handover',
                ],
                required: true,
            },
            label: {
                type: String,
                required: true,
            },
            at: {
                type: Date,
                default: Date.now,
            },
            meta: {
                type: mongoose.Schema.Types.Mixed,
                default: {},
            },
        },
    ],

}, { timestamps: true })

const incidentModel = mongoose.model('incident', incidentSchema)

module.exports = incidentModel
