import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { UserFlagsScreen } from '../screens/admin/UserFlagsScreen';

const Stack = createStackNavigator();

export function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="UserFlags" component={UserFlagsScreen} />
    </Stack.Navigator>
  );
}
