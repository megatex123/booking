import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/workshop/DashboardScreen';
// Lazy-loaded to break circular module dep that causes TDZ crash on Firefox
let _wbds: React.ComponentType<any> | null = null;
const WorkshopBookingDetailScreen: React.ComponentType<any> = (props) => {
  if (!_wbds) {
    _wbds = require('../screens/workshop/WorkshopBookingDetailScreen').WorkshopBookingDetailScreen;
  }
  return React.createElement(_wbds!, props);
};
import { ServiceManagementScreen } from '../screens/workshop/ServiceManagementScreen';
import { WorkshopBookingsScreen } from '../screens/workshop/WorkshopBookingsScreen';
import { WorkshopProfileScreen } from '../screens/workshop/WorkshopProfileScreen';
import { WorkshopReviewsScreen } from '../screens/workshop/WorkshopReviewsScreen';
import { WorkshopManagementScreen } from '../screens/workshop/WorkshopManagementScreen';
import { ProductManagementScreen } from '../screens/workshop/ProductManagementScreen';
import { WorkshopLayoutScreen } from '../screens/workshop/WorkshopLayoutScreen';
import { MechanicManagementScreen } from '../screens/workshop/MechanicManagementScreen';
import { CustomerCRMScreen } from '../screens/workshop/CustomerCRMScreen';
import { AnalyticsDashboardScreen } from '../screens/workshop/AnalyticsDashboardScreen';
import { WorkshopPanelSettingsScreen } from '../screens/workshop/WorkshopPanelSettingsScreen';
import { WorkshopPromotionsScreen } from '../screens/workshop/WorkshopPromotionsScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/shared/ChangePasswordScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { PrivacyPolicyScreen } from '../screens/shared/PrivacyPolicyScreen';
import { Colors } from '../utils/theme';
import { ENIGMA_FOOTER_HEIGHT } from '../../App';

const Tab = createBottomTabNavigator();
const DashboardStack = createStackNavigator();
const BookingsStack = createStackNavigator();
const ProfileStack = createStackNavigator();

function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="Dashboard" component={DashboardScreen} />
      <DashboardStack.Screen name="WorkshopBookingDetail" component={WorkshopBookingDetailScreen} />
      <DashboardStack.Screen name="Chat" component={ChatScreen} />
      <DashboardStack.Screen name="Services" component={ServiceManagementScreen} />
      <DashboardStack.Screen name="WorkshopProfile" component={WorkshopProfileScreen} />
      <DashboardStack.Screen name="WorkshopReviews" component={WorkshopReviewsScreen} />
      <DashboardStack.Screen name="WorkshopManagement" component={WorkshopManagementScreen} />
      <DashboardStack.Screen name="ProductManagement" component={ProductManagementScreen} />
      <DashboardStack.Screen name="WorkshopLayout" component={WorkshopLayoutScreen} />
      <DashboardStack.Screen name="MechanicManagement" component={MechanicManagementScreen} />
      <DashboardStack.Screen name="CustomerCRM" component={CustomerCRMScreen} />
      <DashboardStack.Screen name="Analytics" component={AnalyticsDashboardScreen} />
      <DashboardStack.Screen name="PanelSettings" component={WorkshopPanelSettingsScreen} />
      <DashboardStack.Screen name="Promotions" component={WorkshopPromotionsScreen} />
      <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
    </DashboardStack.Navigator>
  );
}

function BookingsStackScreen() {
  return (
    <BookingsStack.Navigator screenOptions={{ headerShown: false }}>
      <BookingsStack.Screen name="Bookings" component={WorkshopBookingsScreen} />
      <BookingsStack.Screen name="WorkshopBookingDetail" component={WorkshopBookingDetailScreen} />
      <BookingsStack.Screen name="Chat" component={ChatScreen} />
    </BookingsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="Services" component={ServiceManagementScreen} />
      <ProfileStack.Screen name="WorkshopProfile" component={WorkshopProfileScreen} />
      <ProfileStack.Screen name="WorkshopReviews" component={WorkshopReviewsScreen} />
      <ProfileStack.Screen name="WorkshopManagement" component={WorkshopManagementScreen} />
      <ProfileStack.Screen name="ProductManagement" component={ProductManagementScreen} />
      <ProfileStack.Screen name="WorkshopLayout" component={WorkshopLayoutScreen} />
      <ProfileStack.Screen name="MechanicManagement" component={MechanicManagementScreen} />
      <ProfileStack.Screen name="CustomerCRM" component={CustomerCRMScreen} />
      <ProfileStack.Screen name="Analytics" component={AnalyticsDashboardScreen} />
      <ProfileStack.Screen name="PanelSettings" component={WorkshopPanelSettingsScreen} />
      <ProfileStack.Screen name="Promotions" component={WorkshopPromotionsScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="WorkshopBookingDetail" component={WorkshopBookingDetailScreen} />
      <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </ProfileStack.Navigator>
  );
}

export function WorkshopNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
          marginBottom: ENIGMA_FOOTER_HEIGHT,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            DashboardTab: focused ? 'grid' : 'grid-outline',
            BookingsTab: focused ? 'receipt' : 'receipt-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStackScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="BookingsTab" component={BookingsStackScreen} options={{ tabBarLabel: 'Bookings' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
