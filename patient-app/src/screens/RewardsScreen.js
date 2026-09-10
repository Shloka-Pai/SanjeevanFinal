import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';

function RewardCard({ reward, index }) {
  const date = reward.createdAt ? new Date(reward.createdAt).toLocaleDateString() : '';
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.awardIcon}>
          <Text style={styles.awardEmoji}>🏆</Text>
        </View>
        <View>
          <Text style={styles.reason}>{reward.reason || 'Reward granted'}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
      </View>
      <Text style={styles.points}>+{reward.points || 0}</Text>
    </View>
  );
}

export default function RewardsScreen() {
  const [totalPoints, setTotalPoints] = useState(0);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRewards = async () => {
    try {
      const res = await api.get('/citizen/history');
      setTotalPoints(typeof res.data?.totalRewardPoints === 'number' ? res.data.totalRewardPoints : 0);
      setRewardHistory(Array.isArray(res.data?.rewardHistory) ? [...res.data.rewardHistory].reverse() : []);
    } catch (err) {
      console.error('Failed to load rewards', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadRewards(); }, []));

  const onRefresh = () => { setRefreshing(true); loadRewards(); };

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
        <Text style={styles.title}>Reward Ledger</Text>
      </View>

      {/* Total Points Banner */}
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Points</Text>
        <Text style={styles.totalPoints}>{totalPoints}</Text>
        <Text style={styles.totalSub}>Earned by reporting emergencies</Text>
      </View>

      <FlatList
        data={rewardHistory}
        keyExtractor={(item, index) => `${item.createdAt}-${index}`}
        renderItem={({ item, index }) => <RewardCard reward={item} index={index} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1d4ed8']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>No rewards earned yet.</Text>
            <Text style={styles.emptySubText}>Report an emergency to earn 500 points!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { padding: 20, paddingTop: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: '800', color: '#1e293b' },

  totalBanner: { backgroundColor: '#1d4ed8', margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#1d4ed8', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#bfdbfe', marginBottom: 4 },
  totalPoints: { fontSize: 52, fontWeight: '900', color: '#fff' },
  totalSub: { fontSize: 12, color: '#93c5fd', marginTop: 4 },

  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#d1fae5' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  awardIcon: { width: 36, height: 36, backgroundColor: '#ecfdf5', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  awardEmoji: { fontSize: 18 },
  reason: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  date: { fontSize: 11, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  points: { fontSize: 18, fontWeight: '900', color: '#059669' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  emptySubText: { fontSize: 12, color: '#cbd5e1', marginTop: 4 },
});
