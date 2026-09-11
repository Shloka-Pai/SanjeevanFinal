import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

function rankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [yourRank, setYourRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('rank'); // rank | rewards

  const load = async () => {
    try {
      const [profileRes, boardRes] = await Promise.all([
        api.get('/citizen/profile'),
        api.get('/citizen/leaderboard'),
      ]);
      setProfile(profileRes.data.profile);
      setLeaders(boardRes.data.leaders || []);
      setYourRank(boardRes.data.yourRank);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const points = profile?.totalRewardPoints ?? user?.totalRewardPoints ?? 0;
  const rank = profile?.rank ?? yourRank ?? '—';

  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.eyebrow}>CITIZEN PROFILE</Text>
          <Text style={styles.title}>{profile?.name || user?.name || 'Citizen'}</Text>
          <Text style={styles.email}>{profile?.email || user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#0f766e']} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.scoreGrid}>
          <View style={[styles.scoreCard, styles.scorePrimary]}>
            <Text style={styles.scoreLabel}>Reward score</Text>
            <Text style={styles.scoreValue}>{points}</Text>
            <Text style={styles.scoreHint}>Points for helpful reports</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabelDark}>Community rank</Text>
            <Text style={styles.scoreValueDark}>{rankMedal(rank)}</Text>
            <Text style={styles.scoreHintDark}>
              of {profile?.totalCitizens || '—'} citizens
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <Text style={styles.statNum}>{profile?.reportsCount ?? 0}</Text>
            <Text style={styles.statLabel}>Reports</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statNum}>{profile?.percentile ?? '—'}%</Text>
            <Text style={styles.statLabel}>Top percentile</Text>
          </View>
          <TouchableOpacity style={styles.statChip} onPress={() => navigation.navigate('History')}>
            <Text style={styles.statNum}>→</Text>
            <Text style={styles.statLabel}>Trip docs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, tab === 'rank' && styles.modeBtnActive]}
            onPress={() => setTab('rank')}
          >
            <Text style={[styles.modeBtnText, tab === 'rank' && styles.modeBtnTextActive]}>Leaderboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, tab === 'rewards' && styles.modeBtnActive]}
            onPress={() => setTab('rewards')}
          >
            <Text style={[styles.modeBtnText, tab === 'rewards' && styles.modeBtnTextActive]}>Reward ledger</Text>
          </TouchableOpacity>
        </View>

        {tab === 'rank' ? (
          <View style={styles.boardCard}>
            <Text style={styles.boardTitle}>Who helped the most</Text>
            <Text style={styles.boardSub}>Ranked by total reward points for emergency reports</Text>
            {leaders.length === 0 ? (
              <Text style={styles.emptyText}>No rankings yet. Be the first to report and earn points.</Text>
            ) : (
              leaders.map((leader) => (
                <View
                  key={leader.id}
                  style={[styles.leaderRow, leader.isYou && styles.leaderRowYou]}
                >
                  <Text style={styles.leaderRank}>{rankMedal(leader.rank)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderName}>
                      {leader.name}{leader.isYou ? ' (You)' : ''}
                    </Text>
                  </View>
                  <Text style={styles.leaderPoints}>{leader.totalRewardPoints} pts</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.boardCard}>
            <Text style={styles.boardTitle}>Your rewards</Text>
            {(profile?.rewardHistory || []).length === 0 ? (
              <Text style={styles.emptyText}>No rewards yet. Report an emergency to earn 500 points.</Text>
            ) : (
              profile.rewardHistory.map((reward, index) => (
                <View key={`${reward.createdAt}-${index}`} style={styles.rewardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardReason}>{reward.reason || 'Reward granted'}</Text>
                    <Text style={styles.rewardDate}>
                      {reward.createdAt ? new Date(reward.createdAt).toLocaleDateString('en-IN') : ''}
                    </Text>
                  </View>
                  <Text style={styles.rewardPts}>+{reward.points || 0}</Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.quickNav}>
          <Text style={styles.quickTitle}>Quick navigation</Text>
          <TouchableOpacity style={styles.quickItem} onPress={() => navigation.navigate('Report')}>
            <Text style={styles.quickItemText}>Report emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickItem} onPress={() => navigation.navigate('History')}>
            <Text style={styles.quickItemText}>Open trip documentation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickItem} onPress={() => navigation.navigate('Health')}>
            <Text style={styles.quickItemText}>Health assistant</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 18, backgroundColor: '#0f766e',
  },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#99f6e4', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 4 },
  email: { fontSize: 12, color: '#ccfbf1', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  content: { padding: 16, paddingBottom: 40, gap: 14 },
  scoreGrid: { flexDirection: 'row', gap: 10 },
  scoreCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  scorePrimary: { backgroundColor: '#134e4a', borderColor: '#134e4a' },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: '#99f6e4' },
  scoreValue: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4 },
  scoreHint: { fontSize: 11, color: '#5eead4', marginTop: 4 },
  scoreLabelDark: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  scoreValueDark: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginTop: 4 },
  scoreHintDark: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  statRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  statNum: { fontSize: 16, fontWeight: '900', color: '#0f766e' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 2 },

  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#e2e8f0', alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#0f766e' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  modeBtnTextActive: { color: '#fff' },

  boardCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0', gap: 8,
  },
  boardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  boardSub: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#94a3b8', paddingVertical: 12 },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  leaderRowYou: { backgroundColor: '#ecfdf5', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 10 },
  leaderRank: { width: 36, fontSize: 14, fontWeight: '800', color: '#0f766e' },
  leaderName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  leaderPoints: { fontSize: 13, fontWeight: '800', color: '#047857' },

  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  rewardReason: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  rewardDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  rewardPts: { fontSize: 16, fontWeight: '900', color: '#059669' },

  quickNav: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  quickTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  quickItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  quickItemText: { fontSize: 14, fontWeight: '600', color: '#0f766e' },
});
