import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import ReportScreen from '../screens/ReportScreen';
import HistoryScreen from '../screens/HistoryScreen';
import RewardsScreen from '../screens/RewardsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = { Report: '🚨', History: '📋', Rewards: '🏆' };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[label]}</Text>
      <Text style={{ fontSize: 10, color: focused ? '#1d4ed8' : '#94a3b8', fontWeight: focused ? '700' : '400' }}>
        {label}
      </Text>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e2e8f0',
          height: 64,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
    </Tab.Navigator>
  );
}
