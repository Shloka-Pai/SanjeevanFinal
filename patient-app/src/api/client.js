import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Prefer the Expo dev-server host IP for the same Wi‑Fi network.
// That removes the need to edit a hard-coded phone IP whenever the router changes.
const hostUri =
  Constants.expoConfig?.hostUri ||
  Constants.manifest?.debuggerHost ||
  Constants.manifest2?.extra?.expoGo?.debuggerHost ||
  '';

const devHost = hostUri ? hostUri.split(':')[0] : '127.0.0.1';

export const API_URL = `http://${devHost}:3000/api`;

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
