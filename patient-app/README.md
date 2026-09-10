# Sanjeevan — Patient Mobile App (React Native / Expo)

## Overview
This is the React Native mobile application for the **Citizen (Patient) Portal** of the Sanjeevan Hospital Navigation system.

The Hospital Portal and Ambulance Portal remain as the existing React web application (`frontend/`).

---

## Architecture

```
patient-app/          ← React Native (Expo) — THIS APP
frontend/             ← React Web (Hospital + Ambulance portals — UNCHANGED)
backend/              ← Node.js + Express + MongoDB (UNCHANGED, minor backward-compatible additions)
ml_service/           ← Python ML service (UNCHANGED)
```

---

## Backend Changes (backward-compatible)

Two minimal changes were made to the backend:

1. **`backend/src/middlewares/auth.middleware.js`**
   - Added Bearer token fallback: if no cookie is present, reads `Authorization: Bearer <token>` header.
   - Cookie auth still works exactly as before for Hospital and Ambulance web portals.

2. **`backend/src/controller/auth.controller.js`**
   - Added `token` field to citizen `register` and `login` responses so the mobile app can store it.
   - All other responses (hospital, ambulance) are unchanged.
   - `getMe` now also supports Bearer token in addition to cookie.

3. **`backend/src/app.js`**
   - CORS expanded to allow `localhost:8081` (Metro bundler) and local network IPs for device testing.

---

## Setup

### 1. Install dependencies
```bash
cd patient-app
npm install
```

### 2. Configure the backend URL

Open `src/api/client.js` and set `API_URL` to match your environment:

| Environment              | URL                          |
|--------------------------|------------------------------|
| Android Emulator         | `http://10.0.2.2:3000/api`   |
| iOS Simulator            | `http://localhost:3000/api`  |
| Physical device (Wi-Fi)  | `http://192.168.x.x:3000/api`|

### 3. Add Expo icon placeholder (required by Expo)
Place any PNG image at `patient-app/assets/icon.png` (1024×1024 recommended).
You can use any placeholder image for development.

---

## Running the App

### Start the backend first
```bash
cd backend
npm start
```

### Start the React Native app
```bash
cd patient-app
npx expo start
```

Then press:
- `a` — open Android emulator
- `i` — open iOS simulator
- Scan QR code with **Expo Go** app on a physical device

---

## Running the Web Portals (unchanged)
```bash
cd frontend
npm run dev
```
Hospital portal: `http://localhost:5173/hospital/login`
Ambulance portal: `http://localhost:5173/ambulance/login`

---

## Features

| Feature | Status |
|---|---|
| Citizen Register | ✅ |
| Citizen Login | ✅ |
| Persistent session (SecureStore) | ✅ |
| Logout | ✅ |
| Capture incident photo (camera) | ✅ |
| GPS location capture | ✅ |
| NORMAL / CRITICAL dispatch | ✅ |
| Incident description | ✅ |
| AI image validation (Gemini) | ✅ via existing backend |
| Reward points display | ✅ |
| Report history | ✅ |
| Reward ledger | ✅ |
| Pull-to-refresh | ✅ |
| Bottom tab navigation | ✅ |

---

## APIs Reused (no new endpoints created)

| Method | Endpoint | Used for |
|---|---|---|
| POST | `/api/auth/citizen/register` | Register |
| POST | `/api/auth/citizen/login` | Login |
| GET | `/api/auth/me` | Session restore |
| POST | `/api/citizen/report` | Report incident |
| GET | `/api/citizen/history` | History + rewards |

---

## Files Created
- `patient-app/` — entire React Native app (new)

## Files Modified (backend — backward-compatible only)
- `backend/src/middlewares/auth.middleware.js` — Bearer token fallback added
- `backend/src/controller/auth.controller.js` — `token` added to citizen responses; `getMe` supports Bearer
- `backend/src/app.js` — CORS expanded for mobile

## Files NOT Modified
- All Hospital portal files
- All Ambulance portal files
- All MongoDB models
- All other backend routes and controllers
- ML service
