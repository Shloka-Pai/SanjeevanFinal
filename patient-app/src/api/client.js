import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const configuredApiUrl =
  Constants.expoConfig?.extra?.API_URL ||
  Constants.expoConfig?.extra?.MOBILEAPP_URL ||
  'http://localhost:3000/api';

export const API_URL = configuredApiUrl;

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
