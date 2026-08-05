const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || "openai/gpt-4o-mini";

const fallbackTriage = ({ vitals, symptoms }) => {
  const critical =
    vitals.heartRate >= 130 ||
    vitals.spo2 <= 90 ||
    vitals.systolicBp <= 90 ||
    vitals.temperature >= 103 ||
    /unconscious|chest pain|stroke|seizure|difficulty breathing|breathing/i.test(symptoms);

  return {
    needsIcu: critical,
    severity: critical ? "critical" : "urgent",
    summary: critical
      ? "Patient condition looks unstable and ICU-ready hospitals should be prioritized."
      : "Patient appears urgent but may not need ICU as the first destination.",
    recommendationFocus: critical ? "ICU with emergency stabilization" : "fast emergency assessment",
  };
};

export const analyzePatientNeed = async ({ vitals, symptoms }) => {
  if (!OPENROUTER_API_KEY) {
    return fallbackTriage({ vitals, symptoms });
  }

  const prompt = `
You are helping an ambulance dashboard decide whether a patient should be routed to an ICU-capable hospital.
Respond with valid JSON only.

Patient vitals:
- Heart rate: ${vitals.heartRate} bpm
- SpO2: ${vitals.spo2}%
- Systolic BP: ${vitals.systolicBp} mmHg
- Diastolic BP: ${vitals.diastolicBp} mmHg
- Temperature: ${vitals.temperature} F
- Respiratory rate: ${vitals.respiratoryRate} /min

Symptoms:
${symptoms || "No extra symptoms provided"}

Return exactly this JSON shape:
{
  "needsIcu": true,
  "severity": "critical",
  "summary": "short sentence",
  "recommendationFocus": "short phrase"
}

Rules:
- Be strict and concise.
- Choose needsIcu true only if patient likely needs ICU or high-dependency stabilization.
- No markdown.
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a clinical triage assistant. Return strict JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("triage request failed");
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return {
      needsIcu: Boolean(parsed.needsIcu),
      severity: parsed.severity || "urgent",
      summary: parsed.summary || fallbackTriage({ vitals, symptoms }).summary,
      recommendationFocus: parsed.recommendationFocus || "emergency assessment",
    };
  } catch {
    return fallbackTriage({ vitals, symptoms });
  }
};

const fallbackHospitalExplanation = (hospital, triage, index) => {
  const bestChoice =
    index === 0
      ? `${hospital.name} is the top match because it fits the current ${triage.severity} case and supports the expected level of emergency care.`
      : `${hospital.name} still matches part of the patient need and can be used if the top option is delayed.`;

  const weakChoice = hospital.hasIcu
    ? "It becomes a weaker option if another closer ICU-capable hospital is available."
    : "It becomes a weaker option if the patient worsens and needs ICU-level stabilization.";

  return { bestChoice, weakChoice };
};

export const explainHospitalChoice = async ({ hospital, triage, vitals, symptoms, index }) => {
  if (!OPENROUTER_API_KEY) {
    return fallbackHospitalExplanation(hospital, triage, index);
  }

  const prompt = `
You are writing short ambulance dashboard recommendation notes.
Respond with valid JSON only.

Patient triage:
- needsIcu: ${triage.needsIcu}
- severity: ${triage.severity}
- summary: ${triage.summary}
- recommendationFocus: ${triage.recommendationFocus}

Vitals:
- Heart rate: ${vitals.heartRate}
- SpO2: ${vitals.spo2}
- Blood pressure: ${vitals.systolicBp}/${vitals.diastolicBp}
- Temperature: ${vitals.temperature}
- Respiratory rate: ${vitals.respiratoryRate}

Symptoms:
${symptoms || "No symptoms provided"}

Hospital:
- Name: ${hospital.name}
- Area: ${hospital.area}
- Category: ${hospital.category}
- ICU ready: ${hospital.hasIcu}
- Notes: ${hospital.notes}
- Confidence: ${hospital.confidence}
- Rank position: ${index + 1}

Return exactly:
{
  "bestChoice": "short sentence",
  "weakChoice": "short sentence"
}

Rules:
- Keep both lines short.
- Explain why this hospital is a strong fit and why it is weaker than a better match.
- No markdown.
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: "You generate strict JSON hospital fit explanations." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("hospital explanation request failed");
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const fallback = fallbackHospitalExplanation(hospital, triage, index);

    return {
      bestChoice: parsed.bestChoice || fallback.bestChoice,
      weakChoice: parsed.weakChoice || fallback.weakChoice,
    };
  } catch {
    return fallbackHospitalExplanation(hospital, triage, index);
  }
};
