import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err) {
      Alert.alert('Registration failed', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🛡️</Text>
          <Text style={styles.title}>Sanjeevan</Text>
          <Text style={styles.subtitle}>Join the community network</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Login instead</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1d4ed8' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 56 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 20 },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1e293b', marginBottom: 14, backgroundColor: '#f8fafc' },
  btn: { backgroundColor: '#1d4ed8', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: '#1d4ed8', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 20, color: '#64748b', fontSize: 14 },
  linkBold: { color: '#1d4ed8', fontWeight: '700' },
});
