import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';

const SPEECH_LANGUAGES = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'bn-IN', label: 'Bengali' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'kn-IN', label: 'Kannada' },
  { value: 'ml-IN', label: 'Malayalam' },
  { value: 'gu-IN', label: 'Gujarati' },
  { value: 'pa-IN', label: 'Punjabi' },
];

export default function ReportScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [image, setImage] = useState(null); // { uri, type, name }
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState(user?.totalRewardPoints || 0);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed to capture incident photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, type: 'image/jpeg', name: 'incident.jpg' });
      setErrorMsg('');
    }
  };

  const handleReport = async (aidType) => {
    if (!image) {
      setErrorMsg('Please capture an image of the incident first.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied. Please enable GPS.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      const formData = new FormData();
      formData.append('image', { uri: image.uri, type: image.type, name: image.name });
      formData.append('aidType', aidType);
      formData.append('lat', String(latitude));
      formData.append('lng', String(longitude));
      formData.append('description', description);

      const res = await api.post('/citizen/report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const nextPoints = typeof res.data?.totalRewardPoints === 'number'
        ? res.data.totalRewardPoints
        : points + 500;

      setPoints(nextPoints);
      setSuccessMsg('Emergency reported successfully! Help is on the way. (+500 Reward Points)');
      setImage(null);
      setDescription('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to report incident.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <View>
            <Text style={styles.brand}>Sanjeevan</Text>
            <Text style={styles.userName}>{user?.name}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.pointsBadge} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.pointsText}>🏆 {points} pts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.navHints}>
        <TouchableOpacity style={styles.navHint} onPress={() => navigation.navigate('History')}>
          <Text style={styles.navHintText}>Trip reports</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navHint} onPress={() => navigation.navigate('Health')}>
          <Text style={styles.navHintText}>Health chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navHint} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.navHintText}>Rank & rewards</Text>
        </TouchableOpacity>
      </View>

      {/* Dispatch Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dispatch Emergency</Text>
        <Text style={styles.cardSub}>Capture the scene, confirm GPS, then send help.</Text>

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
        {!!successMsg && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✅ {successMsg}</Text>
          </View>
        )}

        {/* Image Capture */}
        <TouchableOpacity style={[styles.imageBox, image && styles.imageBoxFilled]} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to capture incident</Text>
              <Text style={styles.imagePlaceholderSub}>Camera only</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* GPS Notice */}
        <View style={styles.gpsBox}>
          <Text style={styles.gpsTitle}>📍 Live GPS Tracking Active</Text>
          <Text style={styles.gpsText}>
            Submitting an alert will use your current location to dispatch aid immediately.
          </Text>
        </View>

        {/* Description */}
        <TextInput
          style={styles.textarea}
          placeholder="Add operational details (optional)..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        {/* Dispatch Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.dispatchBtn, styles.normalBtn]}
            onPress={() => handleReport('normal')}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1d4ed8" />
            ) : (
              <>
                <Text style={styles.normalBtnText}>NORMAL</Text>
                <Text style={styles.normalBtnSub}>ASSIST</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dispatchBtn, styles.emergencyBtn]}
            onPress={() => handleReport('emergency')}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.emergencyBtnText}>CRITICAL</Text>
                <Text style={styles.emergencyBtnSub}>EMERGENCY</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 32, paddingTop: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: '#0f766e', borderRadius: 18, padding: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 20 },
  brand: { fontSize: 11, fontWeight: '800', color: '#99f6e4', letterSpacing: 0.8 },
  userName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointsBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  pointsText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  logoutBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { fontSize: 12, fontWeight: '700', color: '#ecfdf5' },

  navHints: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  navHint: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#a7f3d0' },
  navHintText: { fontSize: 12, fontWeight: '700', color: '#0f766e' },

  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  cardSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16, lineHeight: 18 },

  errorBox: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { color: '#be123c', fontSize: 13, fontWeight: '600' },
  successBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, padding: 12, marginBottom: 12 },
  successText: { color: '#166534', fontSize: 13, fontWeight: '600' },

  imageBox: { height: 200, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 14, overflow: 'hidden' },
  imageBoxFilled: { borderStyle: 'solid', borderColor: 'transparent' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center' },
  cameraIcon: { fontSize: 36, marginBottom: 8 },
  imagePlaceholderText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  imagePlaceholderSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  gpsBox: { backgroundColor: '#ecfdf5', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#a7f3d0' },
  gpsTitle: { fontSize: 13, fontWeight: '700', color: '#065f46', marginBottom: 4 },
  gpsText: { fontSize: 12, color: '#047857', lineHeight: 18 },

  textarea: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 14, color: '#1e293b', minHeight: 90, textAlignVertical: 'top', marginBottom: 16, backgroundColor: '#f8fafc' },

  btnRow: { flexDirection: 'row', gap: 12 },
  dispatchBtn: { flex: 1, height: 80, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  normalBtn: { borderWidth: 2, borderColor: '#0f766e', backgroundColor: '#fff' },
  normalBtnText: { fontSize: 16, fontWeight: '800', color: '#0f766e' },
  normalBtnSub: { fontSize: 10, fontWeight: '700', color: '#14b8a6', marginTop: 2 },
  emergencyBtn: { backgroundColor: '#dc2626', shadowColor: '#dc2626', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  emergencyBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  emergencyBtnSub: { fontSize: 9, fontWeight: '800', color: '#fecaca', marginTop: 2, letterSpacing: 1 },
});
