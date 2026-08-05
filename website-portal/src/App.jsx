import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { GoogleMap, DirectionsRenderer, MarkerF, useJsApiLoader } from "@react-google-maps/api";

import { hospitals as hospitalSeed } from "./data/hospitals";
import { analyzePatientNeed, explainHospitalChoice } from "./services/triageService";
import { rewardService } from "./services/rewardService";

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const REWARD_EMAIL = "user2@gmail.com";
const REWARD_POINTS = 500;

const createMockVitals = () => ({
  heartRate: 112,
  spo2: 93,
  systolicBp: 98,
  diastolicBp: 64,
  temperature: 101.2,
  respiratoryRate: 26,
});

const scoreHospital = (hospital, triage) => {
  let score = 0;

  if (triage.needsIcu && hospital.hasIcu) score += 50;
  if (!triage.needsIcu && !hospital.hasIcu) score += 18;

  if (hospital.confidence.includes("verified")) score += 20;
  else if (hospital.confidence.includes("high")) score += 12;
  else score += 6;

  if (triage.needsIcu && hospital.category === "ICU") score += 16;
  if (!triage.needsIcu && hospital.category === "General") score += 10;

  score += hospital.area.includes("Shivajinagar") || hospital.area.includes("Deccan") ? 8 : 4;

  return { ...hospital, score };
};

const NavBar = () => (
  <header className="topbar">
    <a href="/" className="brand">
      Sanjeevan
    </a>
    <nav className="navlinks">
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/hospitals">Hospitals</NavLink>
      <NavLink to="/navigation">Navigation</NavLink>
    </nav>
  </header>
);

const SectionTitle = ({ eyebrow, title, copy }) => (
  <div className="section-heading">
    <span>{eyebrow}</span>
    <h1>{title}</h1>
    <p>{copy}</p>
  </div>
);

const VitalCard = ({ label, value, unit, accent }) => (
  <motion.div className="vital-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
    <div className={`vital-orb ${accent}`} />
    <span>{label}</span>
    <strong>
      {value}
      <small>{unit}</small>
    </strong>
  </motion.div>
);

const HomePage = ({ vitals, symptoms, setSymptoms, onAnalyze, loading, triage, onRewardUser, rewardingUser, rewardStatus }) => (
  <motion.main className="page-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
    <section className="hero-grid">
      <div className="hero-copy">
        <SectionTitle
          eyebrow="Ambulance Live Console"
          title="Critical-response dashboard for rapid hospital triage"
          copy="Track live patient vitals, summarize symptoms, and route the ambulance toward the right facility without losing time."
        />

        <div className="triage-pill-row">
          <div className="triage-pill">
            <span>Current triage focus</span>
            <strong>{triage?.recommendationFocus || "Awaiting analysis"}</strong>
          </div>
          <div className="triage-pill">
            <span>Severity estimate</span>
            <strong>{triage?.severity || "Pending"}</strong>
          </div>
        </div>

        <div className="reward-panel">
          <div>
            <span className="reward-label">User reward</span>
            <h3>Reward</h3>
            <p>Add 500 points directly to this user account.</p>
          </div>

          <button className="reward-button" type="button" onClick={onRewardUser} disabled={rewardingUser}>
            {rewardingUser ? "Rewarding..." : `Reward ${REWARD_POINTS} points`}
          </button>

          {rewardStatus.message ? (
            <div className={`reward-status ${rewardStatus.type === "error" ? "reward-status-error" : "reward-status-success"}`}>
              <strong>{rewardStatus.message}</strong>
              {typeof rewardStatus.totalRewardPoints === "number" ? <span>Total rewards: {rewardStatus.totalRewardPoints}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <motion.div className="command-panel" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.35 }}>
        <div className="panel-header">
          <h2>Live Patient Vitals</h2>
          <span className="status-dot">Mock stream active</span>
        </div>

        <div className="vitals-grid">
          <VitalCard label="Heart Rate" value={vitals.heartRate} unit="bpm" accent="accent-red" />
          <VitalCard label="SpO2" value={vitals.spo2} unit="%" accent="accent-green" />
          <VitalCard label="Blood Pressure" value={`${vitals.systolicBp}/${vitals.diastolicBp}`} unit="mmHg" accent="accent-blue" />
          <VitalCard label="Temperature" value={vitals.temperature} unit="F" accent="accent-amber" />
          <VitalCard label="Respiratory Rate" value={vitals.respiratoryRate} unit="/min" accent="accent-cyan" />
        </div>

        <label className="symptom-box">
          <span>Symptoms</span>
          <textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Example: chest pain, shortness of breath, sweating, confusion..." />
        </label>

        <button className="primary-action" type="button" onClick={onAnalyze} disabled={loading}>
          {loading ? "Analyzing..." : "Find Hospital"}
        </button>
      </motion.div>
    </section>
  </motion.main>
);

const HospitalsPage = ({ triage, rankedHospitals, onChoose, onNavigateToHospital, selectedHospital }) => (
  <motion.main className="page-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
    <SectionTitle eyebrow="Hospital Matchboard" title="Recommended hospitals in priority order" copy={triage ? triage.summary : "Run patient analysis from the landing page to rank hospitals."} />

    <div className="hospital-list">
      {rankedHospitals.map((hospital, index) => (
        <motion.article key={hospital.name} className={`hospital-card ${selectedHospital?.name === hospital.name ? "selected" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
          <div className="hospital-rank">{index + 1}</div>
          <div className="hospital-main">
            <div className="hospital-headline">
              <div>
                <h3>{hospital.name}</h3>
                <p>
                  {hospital.area} · {hospital.category} · {hospital.hasIcu ? "ICU ready" : "No ICU"}
                </p>
              </div>
              <span className="confidence-tag">{hospital.confidence}</span>
            </div>

            <p className="hospital-reason">
              <strong>Why best choice:</strong> {hospital.bestChoice}
            </p>
            <p className="hospital-reason hospital-reason-muted">
              <strong>Why weaker choice:</strong> {hospital.weakChoice}
            </p>

            <div className="hospital-actions">
              <button type="button" className="secondary-action" onClick={() => onChoose(hospital)}>
                Choose
              </button>
              <button type="button" className="primary-link-button" onClick={() => onNavigateToHospital(hospital)}>
                Navigate
              </button>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  </motion.main>
);

const NavigationPage = ({ selectedHospital, ambulanceLocation, directions }) => {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: mapsApiKey,
  });
  const [currentArea, setCurrentArea] = useState("Waiting for GPS");
  const routeLeg = directions?.routes?.[0]?.legs?.[0];
  const routeDuration = routeLeg?.duration_in_traffic?.text || routeLeg?.duration?.text || "Calculating...";

  useEffect(() => {
    if (!ambulanceLocation) {
      setCurrentArea("Waiting for GPS");
      return;
    }

    if (!window.google?.maps?.Geocoder) {
      setCurrentArea("Resolving area...");
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    setCurrentArea("Resolving area...");

    geocoder.geocode({ location: ambulanceLocation }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        setCurrentArea("Area unavailable");
        return;
      }

      const preferredResult =
        results.find((result) => result.types?.includes("sublocality_level_1")) ||
        results.find((result) => result.types?.includes("locality")) ||
        results[0];

      const areaComponent =
        preferredResult.address_components?.find((component) =>
          component.types?.some((type) =>
            ["sublocality_level_1", "sublocality", "locality", "neighborhood", "administrative_area_level_2"].includes(type)
          )
        ) || preferredResult.address_components?.[0];

      setCurrentArea(areaComponent?.long_name || preferredResult.formatted_address || "Area unavailable");
    });
  }, [ambulanceLocation, isLoaded]);

  return (
    <motion.main className="page-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <SectionTitle eyebrow="Ambulance Navigation" title="Live route guidance" copy={selectedHospital ? `Current destination: ${selectedHospital.name}, ${selectedHospital.area}` : "Choose a hospital first to start navigation."} />

      <div className="navigation-layout">
        <div className="map-panel">
          {isLoaded ? (
            <GoogleMap
              mapContainerClassName="map-surface"
              center={ambulanceLocation || { lat: 18.5204, lng: 73.8567 }}
              zoom={12}
              options={{
                disableDefaultUI: true,
                styles: [
                  { elementType: "geometry", stylers: [{ color: "#0d1728" }] },
                  { elementType: "labels.text.fill", stylers: [{ color: "#d6e4ff" }] },
                  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1728" }] },
                  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b4672" }] },
                  { featureType: "water", elementType: "geometry", stylers: [{ color: "#12263f" }] },
                ],
              }}
            >
              {ambulanceLocation ? <MarkerF position={ambulanceLocation} /> : null}
              {selectedHospital?.location ? <MarkerF position={selectedHospital.location} /> : null}
              {directions ? <DirectionsRenderer directions={directions} options={{ polylineOptions: { strokeColor: "#5CE1E6", strokeWeight: 6 } }} /> : null}
            </GoogleMap>
          ) : (
            <div className="map-fallback">Loading map...</div>
          )}
        </div>

        <div className="route-card">
          <h3>Route status</h3>
          <p>{selectedHospital ? "Ambulance route is live and updating from current browser location." : "No destination selected yet."}</p>

          <div className="route-metrics">
            <div>
              <span>Destination</span>
              <strong>{selectedHospital?.name || "Not selected"}</strong>
            </div>
            <div>
              <span>Time remaining</span>
              <strong>{selectedHospital ? routeDuration : "Not available"}</strong>
            </div>
            <div>
              <span>Current area</span>
              <strong>{currentArea}</strong>
            </div>
          </div>
        </div>
      </div>
    </motion.main>
  );
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [vitals, setVitals] = useState(createMockVitals);
  const [symptoms, setSymptoms] = useState("Chest pain with shortness of breath and low oxygen saturation.");
  const [triage, setTriage] = useState(null);
  const [rankedHospitals, setRankedHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [directions, setDirections] = useState(null);
  const [rewardingUser, setRewardingUser] = useState(false);
  const [rewardStatus, setRewardStatus] = useState({ type: "", message: "", totalRewardPoints: null });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVitals((current) => ({
        heartRate: Math.max(72, Math.min(145, current.heartRate + (Math.random() > 0.5 ? 2 : -2))),
        spo2: Math.max(86, Math.min(99, Number((current.spo2 + (Math.random() > 0.5 ? 1 : -1)).toFixed(0)))),
        systolicBp: Math.max(84, Math.min(138, current.systolicBp + (Math.random() > 0.5 ? 2 : -2))),
        diastolicBp: Math.max(54, Math.min(92, current.diastolicBp + (Math.random() > 0.5 ? 2 : -2))),
        temperature: Number(Math.max(98.2, Math.min(103.4, current.temperature + (Math.random() > 0.5 ? 0.1 : -0.1))).toFixed(1)),
        respiratoryRate: Math.max(14, Math.min(34, current.respiratoryRate + (Math.random() > 0.5 ? 1 : -1))),
      }));
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setAmbulanceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setAmbulanceLocation({ lat: 18.5204, lng: 73.8567 });
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDirections = async () => {
      if (!selectedHospital || !ambulanceLocation || !window.google?.maps) {
        setDirections(null);
        return;
      }

      try {
        let DirectionsServiceCtor = window.google.maps.DirectionsService;

        if (typeof DirectionsServiceCtor !== "function" && typeof window.google.maps.importLibrary === "function") {
          const routesLibrary = await window.google.maps.importLibrary("routes");
          DirectionsServiceCtor = routesLibrary?.DirectionsService;
        }

        if (typeof DirectionsServiceCtor !== "function") {
          console.error("Google Maps DirectionsService is unavailable.");
          if (!cancelled) {
            setDirections(null);
          }
          return;
        }

        const service = new DirectionsServiceCtor();
        service.route(
          {
            origin: ambulanceLocation,
            destination: selectedHospital.location,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (cancelled) {
              return;
            }

            if (status === "OK") {
              setDirections(result);
              return;
            }

            console.error("Directions request failed:", status);
            setDirections(null);
          }
        );
      } catch (error) {
        console.error("Failed to initialize directions service:", error);
        if (!cancelled) {
          setDirections(null);
        }
      }
    };

    loadDirections();

    return () => {
      cancelled = true;
    };
  }, [ambulanceLocation, selectedHospital, location.pathname]);

  const analyzeAndRank = async () => {
    setLoading(true);
    const nextTriage = await analyzePatientNeed({ vitals, symptoms });
    const scoredHospitals = hospitalSeed
      .filter((hospital) => (nextTriage.needsIcu ? hospital.hasIcu : true))
      .map((hospital) => scoreHospital(hospital, nextTriage))
      .sort((a, b) => b.score - a.score);

    const nextRankedHospitals = await Promise.all(
      scoredHospitals.map(async (hospital, index) => {
        const explanation = await explainHospitalChoice({
          hospital,
          triage: nextTriage,
          vitals,
          symptoms,
          index,
        });

        return { ...hospital, ...explanation };
      })
    );

    setTriage(nextTriage);
    setRankedHospitals(nextRankedHospitals);
    setSelectedHospital(nextRankedHospitals[0] || null);
    setLoading(false);
    navigate("/hospitals");
  };

  const chooseHospital = (hospital) => {
    setSelectedHospital(hospital);
  };

  const navigateToHospital = (hospital) => {
    setSelectedHospital(hospital);
    navigate("/navigation");
  };

  const rewardTargetUser = async () => {
    try {
      setRewardingUser(true);
      setRewardStatus({ type: "", message: "", totalRewardPoints: null });

      const result = await rewardService.grantReward({
        email: REWARD_EMAIL,
        points: REWARD_POINTS,
      });

      setRewardStatus({
        type: "success",
        message: `${result.rewardedEmail} rewarded with ${result.addedPoints} points.`,
        totalRewardPoints: result.totalRewardPoints,
      });
    } catch (error) {
      setRewardStatus({
        type: "error",
        message: error.message || "Unable to reward user right now.",
        totalRewardPoints: null,
      });
    } finally {
      setRewardingUser(false);
    }
  };

  const motionKey = useMemo(() => location.pathname, [location.pathname]);

  return (
    <div className="portal-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <NavBar />

      <AnimatePresence mode="wait">
        <motion.div key={motionKey}>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  vitals={vitals}
                  symptoms={symptoms}
                  setSymptoms={setSymptoms}
                  onAnalyze={analyzeAndRank}
                  loading={loading}
                  triage={triage}
                  onRewardUser={rewardTargetUser}
                  rewardingUser={rewardingUser}
                  rewardStatus={rewardStatus}
                />
              }
            />
            <Route path="/hospitals" element={<HospitalsPage triage={triage} rankedHospitals={rankedHospitals} onChoose={chooseHospital} onNavigateToHospital={navigateToHospital} selectedHospital={selectedHospital} />} />
            <Route path="/navigation" element={<NavigationPage selectedHospital={selectedHospital} ambulanceLocation={ambulanceLocation} directions={directions} />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
