import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';

function ReportCard({ report }) {
  const isEmergency = report.aidType === 'emergency';
  const date = report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '';
  const hospital = report.assignedHospital?.name || report.selectedHospital?.name || 'Awaiting assignment';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.badge, isEmergency ? styles.badgeRed : styles.badgeBlue]}>
          <Text style={[styles.badgeText, isEmergency ? styles.badgeTextRed : styles.badgeTextBlue]}>
            {report.aidType?.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.dateText}>{date}</Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {report.description || 'No operational description.'}
      </Text>
      <View style={styles.cardRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{report.status}</Text>
        </View>
        <Text style={styles.hospitalText} numberOfLines={1}>{hospital}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const res = await api.get('/citizen/history');
      setReports(Array.isArray(res.data?.reports) ? res.data.reports : []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const onRefresh = () => { setRefreshing(true); loadHistory(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Report History</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{reports.length} Total</Text>
        </View>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReportCard report={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1d4ed8']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No reports submitted yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  countBadge: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  list: { padding: 16, gap: 12 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeRed: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  badgeBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextRed: { color: '#dc2626' },
  badgeTextBlue: { color: '#1d4ed8' },
  dateText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  description: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  statusBadge: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  hospitalText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', maxWidth: 180 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
});
