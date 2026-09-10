const incidentModel = require("../models/incident.model");
const citizenModel = require("../models/citizen.model");
const storageService = require("../services/storage.service");
const { v4: uuid } = require("uuid");
const { getIO } = require('../socket');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// ============================================================
// GEMINI IMAGE JSON PROMPT
// ============================================================

async function runGeminiImageJsonPrompt(prompt, file) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 800,
      temperature: 0,
    }
  });

  const imagePart = {
    inlineData: {
      data: file.buffer.toString('base64'),
      mimeType: file.mimetype || "image/jpeg"
    }
  };

  const result = await model.generateContent([prompt, imagePart]);

  let responseText = result.response.text();

  console.log("===== GEMINI RAW RESPONSE =====");
  console.log(responseText);
  console.log("===== END GEMINI RESPONSE =====");

  // Remove markdown code fences if Gemini returns them
  responseText = responseText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error("Gemini returned invalid JSON:");
    console.error(responseText);
    console.error("JSON parse error:", parseError.message);

    throw new Error(
      `Gemini returned invalid JSON: ${parseError.message}`
    );
  }
}


// ============================================================
// GEMINI TEXT JSON PROMPT
// ============================================================

async function runGeminiTextJsonPrompt(prompt) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 800,
      temperature: 0,
    }
  });

  const result = await model.generateContent(prompt);

  let responseText = result.response.text();

  console.log("===== GEMINI TEXT RAW RESPONSE =====");
  console.log(responseText);
  console.log("===== END GEMINI TEXT RESPONSE =====");

  // Remove markdown code fences if Gemini returns them
  responseText = responseText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error("Gemini returned invalid JSON:");
    console.error(responseText);
    console.error("JSON parse error:", parseError.message);

    throw new Error(
      `Gemini returned invalid JSON: ${parseError.message}`
    );
  }
}


// ============================================================
// GEMINI RETRY DELAY
// ============================================================

function extractRetryDelaySeconds(error) {
  const retryInfo = error?.errorDetails?.find(
    (detail) => detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
  );

  const retryDelay = retryInfo?.retryDelay;

  if (!retryDelay || typeof retryDelay !== 'string') return null;

  const seconds = Number.parseInt(
    retryDelay.replace(/s$/i, ''),
    10
  );

  return Number.isFinite(seconds) ? seconds : null;
}


// ============================================================
// REPORT INCIDENT
// ============================================================

async function reportIncident(req, res) {
  try {
    const { aidType, lat, lng, description } = req.body;

    if (!req.file) {
      return res.status(400).json({
        message: "Image is required"
      });
    }

    if (!aidType) {
      return res.status(400).json({
        message: "Aid type is required"
      });
    }

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Location is required"
      });
    }

    let isHighSeverityTrauma = false;
    let traumaSeverityAssessment = "No AI analysis performed.";

    // ========================================================
    // GEMINI IMAGE ANALYSIS
    // ========================================================

    try {

      // ------------------------------------------------------
      // STEP 1: VALIDATE INCIDENT IMAGE
      // ------------------------------------------------------

      const imageValidation = await runGeminiImageJsonPrompt(
        [
          "You are validating whether an uploaded photo is suitable for emergency incident reporting.",
          "Decide whether this image shows a real emergency, injury, accident scene, medical distress, fire, disaster, road collision, or another situation that warrants ambulance/help dispatch.",
          "Reject clearly irrelevant uploads such as household objects, fans, furniture, pets, selfies, landscapes, memes, documents, food, or ordinary non-emergency scenes.",
          "Respond with a JSON object containing exactly these keys:",
          "isValidIncidentImage (boolean), confidence (string: high|medium|low), reason (string, 1-2 short sentences).",
          "Return ONLY valid JSON.",
          "Do not include markdown.",
          "Do not include any explanation outside the JSON."
        ].join(" "),
        req.file,
      );

      if (imageValidation.isValidIncidentImage !== true) {
        return res.status(400).json({
          message:
            imageValidation.reason ||
            "The uploaded image does not appear to show a valid emergency incident.",
          imageValidation,
        });
      }


      // ------------------------------------------------------
      // STEP 2: DETERMINE TRAUMA SEVERITY
      // ------------------------------------------------------

      const severityContent = await runGeminiImageJsonPrompt(
        [
          "Analyze this validated emergency incident image.",
          "Does it appear to be a high-severity trauma case such as a major crash, severe visible wound, heavy bleeding, unconscious casualty, major fire injury, or another immediately life-threatening scene?",
          "Respond with a JSON object containing exactly these keys:",
          "isHighSeverity (boolean), assessment (string explaining in 1-2 short sentences why).",
          "Return ONLY valid JSON.",
          "Do not include markdown.",
          "Do not include any explanation outside the JSON."
        ].join(" "),
        req.file,
      );

      isHighSeverityTrauma =
        severityContent.isHighSeverity === true;

      traumaSeverityAssessment =
        severityContent.assessment ||
        "Analysis complete.";

    } catch (aiErr) {

      console.error("Gemini processing failed:", aiErr);

      return res.status(502).json({
        message:
          "Image validation service is unavailable right now. Please try again with a clear incident photo.",
      });
    }


    // ========================================================
    // UPLOAD IMAGE
    // ========================================================

    const uploadResult = await storageService.uploadFile(
      req.file.buffer,
      uuid(),
    );

    if (!uploadResult || !uploadResult.url) {
      return res.status(500).json({
        message: "Image upload failed",
      });
    }


    // ========================================================
    // CREATE INCIDENT
    // ========================================================

    const incident = await incidentModel.create({
      reportedBy: req.user.id,
      image: uploadResult.url,
      aidType,

      location: {
        lat: Number(lat),
        lng: Number(lng),
      },

      description,

      isHighSeverityTrauma,
      traumaSeverityAssessment
    });


    // ========================================================
    // REWARD CITIZEN
    // ========================================================

    const user = await citizenModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "Citizen account not found"
      });
    }

    user.totalRewardPoints += 500;

    user.rewardHistory.push({
      points: 500,
      reason: "Incident reported",
    });

    await user.save();


    // ========================================================
    // SOCKET NOTIFICATION
    // ========================================================

    try {

      getIO()
        .to('ambulance')
        .emit('incoming_incident', incident);

    } catch (err) {

      console.log(
        'Socket mapping failed or no ambulances attached',
        err
      );

    }


    // ========================================================
    // RESPONSE
    // ========================================================

    res.status(201).json({
      message: "Incident reported successfully",
      incident,
      totalRewardPoints: user.totalRewardPoints,
      rewardHistory: user.rewardHistory,
    });

  } catch (err) {

    console.error(
      "REPORT INCIDENT ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });

  }
}


// ============================================================
// DEMO INCIDENT
// ============================================================

async function reportDemoIncident(req, res) {

  try {

    const {
      aidType,
      lat,
      lng,
      description,
      image
    } = req.body;

    if (!aidType) {
      return res.status(400).json({
        message: "Aid type is required"
      });
    }

    if (
      lat === undefined ||
      lng === undefined
    ) {
      return res.status(400).json({
        message: "Location is required"
      });
    }


    const incident = await incidentModel.create({

      reportedBy: req.user.id,

      image:
        image ||
        "https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1200&q=80",

      aidType,

      location: {
        lat: Number(lat),
        lng: Number(lng),
      },

      description:
        description ||
        "Demo incident created from Postman.",

      isHighSeverityTrauma:
        aidType === 'emergency',

      traumaSeverityAssessment:
        "Demo incident created without AI validation.",
    });


    try {

      getIO()
        .to('ambulance')
        .emit('incoming_incident', incident);

    } catch (err) {

      console.log(
        'Socket mapping failed or no ambulances attached',
        err
      );

    }


    return res.status(201).json({
      message: "Demo incident sent successfully",
      incident,
    });

  } catch (err) {

    console.error(
      "REPORT DEMO INCIDENT ERROR:",
      err
    );

    return res.status(500).json({
      message: err.message,
    });

  }
}


// ============================================================
// CITIZEN HISTORY
// ============================================================

async function getCitizenHistory(req, res) {

  try {

    const [citizen, reports] =
      await Promise.all([

        citizenModel
          .findById(req.user.id)
          .select(
            'name totalRewardPoints rewardHistory'
          ),

        incidentModel
          .find({
            reportedBy: req.user.id
          })
          .sort({
            createdAt: -1
          })
          .populate(
            'assignedAmbulance',
            'vehicleNumber type'
          )
          .populate(
            'assignedHospital',
            'name status'
          )
          .populate(
            'selectedHospital',
            'name status'
          ),

      ]);


    if (!citizen) {

      return res.status(404).json({
        message: 'Citizen not found'
      });

    }


    res.status(200).json({

      totalRewardPoints:
        citizen.totalRewardPoints,

      rewardHistory:
        citizen.rewardHistory || [],

      reports,

    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

}


// ============================================================
// TRANSLATE OPERATIONAL DETAILS
// ============================================================

async function translateOperationalDetails(req, res) {

  try {

    const {
      text,
      sourceLanguage
    } = req.body;


    if (
      !text ||
      !String(text).trim()
    ) {

      return res.status(400).json({
        message:
          'Text is required for translation.'
      });

    }


    const translation =
      await runGeminiTextJsonPrompt(

        [

          "Translate the following emergency operational note into clear English.",

          "The speaker may be using any Indian or other natural language and may describe injuries, location clues, pain, bleeding, crash details, or distress.",

          "Preserve urgency and concrete medical details.",

          "Do not add facts that were not spoken.",

          "Return JSON with exactly these keys:",

          "translatedText (string), detectedLanguage (string), notes (string).",

          "Return ONLY valid JSON.",

          "Do not include markdown.",

          "Do not include any explanation outside the JSON.",

          `Source language hint: ${sourceLanguage || 'unknown'}.`,

          `Text: """${String(text).trim()}"""`,

        ].join(" "),
      );


    return res.status(200).json({

      translatedText:
        translation.translatedText ||
        String(text).trim(),

      detectedLanguage:
        translation.detectedLanguage ||
        sourceLanguage ||
        'unknown',

      notes:
        translation.notes ||
        'Translated to English.',

    });

  } catch (err) {

    console.error(
      'translateOperationalDetails error:',
      err
    );


    const retryAfterSeconds =
      extractRetryDelaySeconds(err);


    if (err?.status === 429) {

      return res.status(429).json({

        message:

          retryAfterSeconds

            ? `Voice translation is temporarily rate-limited. Please retry in about ${retryAfterSeconds} seconds, or continue with the captured transcript.`

            : 'Voice translation is temporarily rate-limited. Please retry shortly, or continue with the captured transcript.',

        retryAfterSeconds,

        fallbackText:
          String(text).trim(),

      });

    }


    return res.status(502).json({

      message:
        'Voice translation is unavailable right now. Please continue with the captured transcript or type the details manually.',

      fallbackText:
        String(text).trim(),

    });

  }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  reportIncident,
  reportDemoIncident,
  getCitizenHistory,
  translateOperationalDetails
};