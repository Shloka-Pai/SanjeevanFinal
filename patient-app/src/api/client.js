import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ─── IMPORTANT ───────────────────────────────────────────────────────────────
// Change this to your machine's local IP when testing on a physical device.
// e.g. 'http://192.168.1.10:3000/api'
// For Android emulator use: 'http://10.0.2.2:3000/api'
// For iOS simulator use:    'http://localhost:3000/api'
// ─────────────────────────────────────────────────────────────────────────────
// export const API_URL = 'http://192.168.1.72:3000/api';

export const API_URL = 'http://192.168.1.72:3000/api';

const TOKEN_KEY = 'sanjeevan_token';

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Axios instance with Bearer token injected automatically
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
