import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import ReportScreen from '../screens/ReportScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = {
    Report: '🚨',
    History: '📄',
    Assist: '🩺',
    Health: '🩺',
    Profile: '👤',
  };

  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconBubble, focused && styles.iconBubbleActive]}>
        <Text style={styles.iconEmoji}>{icons[label]}</Text>
      </View>
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>{label}</Text>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Report" component={ReportScreen} options={{ title: 'Report' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="Health" component={ChatScreen} options={{ title: 'Health' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    height: 72,
    paddingBottom: 8,
    paddingTop: 6,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  iconBubble: {
    width: 36, height: 28, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBubbleActive: { backgroundColor: '#ccfbf1' },
  iconEmoji: { fontSize: 18 },
  iconLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  iconLabelActive: { color: '#0f766e', fontWeight: '800' },
});
