import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, ScrollView, Share, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';

function statusColor(status) {
  if (status === 'completed') return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
  if (status === 'assigned') return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
}

function ReportCard({ report, onOpen }) {
  const isEmergency = report.aidType === 'emergency';
  const date = report.createdAt
    ? new Date(report.createdAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const hospital = report.assignedHospital?.name || report.selectedHospital?.name || 'Awaiting hospital';
  const ambulance = report.assignedAmbulance?.vehicleNumber || 'Awaiting ambulance';
  const colors = statusColor(report.status);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onOpen(report)} activeOpacity={0.85}>
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

      <View style={styles.metaBlock}>
        <Text style={styles.metaLine}>Ambulance · {ambulance}</Text>
        <Text style={styles.metaLine}>Hospital · {hospital}</Text>
      </View>

      <View style={styles.cardRow}>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.statusText, { color: colors.text }]}>{report.status}</Text>
        </View>
        <Text style={styles.viewReport}>View full report →</Text>
      </View>
    </TouchableOpacity>
  );
}

function MilestoneRow({ label, value, done }) {
  return (
    <View style={styles.milestoneRow}>
      <View style={[styles.milestoneDot, done ? styles.milestoneDotDone : styles.milestoneDotPending]} />
      <View style={styles.milestoneTextWrap}>
        <Text style={styles.milestoneLabel}>{label}</Text>
        <Text style={styles.milestoneValue}>{value || 'Pending'}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportDoc, setReportDoc] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

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

  const openReport = async (report) => {
    setReportLoading(true);
    setReportDoc(null);
    try {
      const res = await api.get(`/citizen/reports/${report._id}`);
      setReportDoc(res.data.report);
    } catch (err) {
      Alert.alert('Report unavailable', err.response?.data?.message || 'Could not generate trip documentation.');
    } finally {
      setReportLoading(false);
    }
  };

  const shareReport = async () => {
    if (!reportDoc?.documentText) return;
    try {
      await Share.share({
        message: reportDoc.documentText,
        title: reportDoc.title,
      });
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.title}>Trip History</Text>
          <Text style={styles.subtitle}>Reports generate automatically after each trip</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{reports.length}</Text>
        </View>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReportCard report={item} onOpen={openReport} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHistory(); }} colors={['#0f766e']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No trip reports yet.</Text>
            <Text style={styles.emptySub}>
              Documentation appears here automatically after you report an emergency and the trip progresses.
            </Text>
          </View>
        }
      />

      <Modal visible={reportLoading || !!reportDoc} animationType="slide" transparent onRequestClose={() => setReportDoc(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {reportLoading || !reportDoc ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#0f766e" />
                <Text style={styles.modalLoadingText}>Generating trip documentation…</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalEyebrow}>OFFICIAL DOCUMENTATION</Text>
                    <Text style={styles.modalTitle}>{reportDoc.reportId}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setReportDoc(null)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Text style={styles.docTitle}>{reportDoc.title}</Text>
                  <Text style={styles.docMeta}>Generated {reportDoc.generatedAtFormatted}</Text>
                  <Text style={styles.docMeta}>Reporter · {reportDoc.reporter?.name}</Text>

                  <View style={styles.phaseBanner}>
                    <Text style={styles.phaseLabel}>Current phase</Text>
                    <Text style={styles.phaseValue}>{reportDoc.incident?.phase}</Text>
                  </View>

                  <Text style={styles.sectionTitle}>Key milestones</Text>
                  <MilestoneRow label="Ambulance called" value={reportDoc.milestones?.ambulanceCalledAt} done={!!reportDoc.milestones?.ambulanceCalledAt} />
                  <MilestoneRow label="Ambulance dispatched" value={reportDoc.milestones?.ambulanceDispatchedAt} done={!!reportDoc.milestones?.ambulanceDispatchedAt} />
                  <MilestoneRow label="Arrived at ER" value={reportDoc.milestones?.arrivedErAt} done={!!reportDoc.milestones?.arrivedErAt} />
                  <MilestoneRow label="ER handover completed" value={reportDoc.milestones?.erHandoverAt} done={!!reportDoc.milestones?.erHandoverAt} />

                  <Text style={styles.sectionTitle}>Assignment</Text>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLine}>Ambulance: {reportDoc.ambulance?.vehicleNumber || 'Not assigned'}{reportDoc.ambulance?.type ? ` (${reportDoc.ambulance.type})` : ''}</Text>
                    <Text style={styles.infoLine}>Hospital: {reportDoc.hospital?.name || 'Not assigned'}</Text>
                    <Text style={styles.infoLine}>Aid type: {reportDoc.incident?.aidType}</Text>
                    <Text style={styles.infoLine}>Severity: {reportDoc.incident?.severityLevel || 'n/a'}</Text>
                  </View>

                  <Text style={styles.sectionTitle}>Full timeline</Text>
                  {(reportDoc.timeline || []).map((event, index) => (
                    <View key={`${event.type}-${index}`} style={styles.timelineItem}>
                      <Text style={styles.timelineIndex}>{index + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineLabel}>{event.label}</Text>
                        <Text style={styles.timelineTime}>{event.atFormatted}</Text>
                      </View>
                    </View>
                  ))}

                  <Text style={styles.sectionTitle}>Operational notes</Text>
                  <Text style={styles.notes}>{reportDoc.incident?.description}</Text>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.shareBtn} onPress={shareReport}>
                    <Text style={styles.shareBtnText}>Share / Save report</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#0f766e',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 12, color: '#99f6e4', marginTop: 2, fontWeight: '500' },
  countBadge: {
    minWidth: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },
  countText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeRed: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  badgeBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextRed: { color: '#dc2626' },
  badgeTextBlue: { color: '#1d4ed8' },
  dateText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  description: { fontSize: 15, fontWeight: '700', color: '#0f172a', lineHeight: 21 },
  metaBlock: { gap: 2 },
  metaLine: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  viewReport: { fontSize: 12, fontWeight: '700', color: '#0f766e' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#475569', fontWeight: '700' },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', minHeight: '55%',
  },
  modalLoading: { padding: 48, alignItems: 'center', gap: 12 },
  modalLoadingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  modalEyebrow: { fontSize: 10, fontWeight: '800', color: '#0f766e', letterSpacing: 1 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginTop: 2 },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  closeBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  modalBody: { padding: 20, paddingBottom: 28, gap: 6 },
  docTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  docMeta: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  phaseBanner: {
    marginTop: 12, marginBottom: 8, backgroundColor: '#ecfdf5', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#a7f3d0',
  },
  phaseLabel: { fontSize: 11, fontWeight: '700', color: '#047857' },
  phaseValue: { fontSize: 15, fontWeight: '800', color: '#065f46', marginTop: 2 },
  sectionTitle: { marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.6 },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  milestoneDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  milestoneDotDone: { backgroundColor: '#0f766e' },
  milestoneDotPending: { backgroundColor: '#cbd5e1' },
  milestoneTextWrap: { flex: 1 },
  milestoneLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  milestoneValue: { fontSize: 12, color: '#64748b', marginTop: 2 },
  infoBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  infoLine: { fontSize: 13, color: '#334155', fontWeight: '600' },
  timelineItem: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  timelineIndex: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#ccfbf1',
    textAlign: 'center', lineHeight: 22, fontSize: 11, fontWeight: '800', color: '#0f766e', overflow: 'hidden',
  },
  timelineLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  timelineTime: { fontSize: 11, color: '#64748b', marginTop: 1 },
  notes: { fontSize: 13, color: '#475569', lineHeight: 20 },
  modalActions: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff' },
  shareBtn: { backgroundColor: '#0f766e', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
