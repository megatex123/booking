import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { CustomerDashboardScreen } from '../screens/customer/CustomerDashboardScreen';
import { CarHealthScreen } from '../screens/customer/CarHealthScreen';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { WorkshopDetailScreen } from '../screens/customer/WorkshopDetailScreen';
import { BookingScreen } from '../screens/customer/BookingScreen';
import { BookingSuccessScreen } from '../screens/customer/BookingSuccessScreen';
import { BookingHistoryScreen } from '../screens/customer/BookingHistoryScreen';
import { BookingDetailScreen } from '../screens/customer/BookingDetailScreen';
import { MyVehiclesScreen } from '../screens/customer/MyVehiclesScreen';
import { MyReviewsScreen } from '../screens/customer/MyReviewsScreen';
import { VehicleServiceHistoryScreen } from '../screens/customer/VehicleServiceHistoryScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { PaymentScreen } from '../screens/shared/PaymentScreen';
import { ReviewScreen } from '../screens/shared/ReviewScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/shared/ChangePasswordScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { PrivacyPolicyScreen } from '../screens/shared/PrivacyPolicyScreen';
import { CompareScreen } from '../screens/customer/CompareScreen';
import { ReferralScreen } from '../screens/customer/ReferralScreen';
import { CorporateRegistrationScreen } from '../screens/customer/CorporateRegistrationScreen';
import { CorporateManagementScreen } from '../screens/customer/CorporateManagementScreen';
import { LoyaltyScreen } from '../screens/customer/LoyaltyScreen';
import { QueueStatusScreen } from '../screens/customer/QueueStatusScreen';
import { PriceEstimatorScreen } from '../screens/customer/PriceEstimatorScreen';
import { Colors } from '../utils/theme';
import { ENIGMA_FOOTER_HEIGHT } from '../../App';

const Tab = createBottomTabNavigator();
const DashboardStack = createStackNavigator();
const HomeStack = createStackNavigator();
const BookingsStack = createStackNavigator();
const ProfileStack = createStackNavigator();

function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="CustomerDashboard" component={CustomerDashboardScreen} />
      <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
      <DashboardStack.Screen name="MyReviews" component={MyReviewsScreen} />
      <DashboardStack.Screen name="CarHealth" component={CarHealthScreen} />
    </DashboardStack.Navigator>
  );
}

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="WorkshopDetail" component={WorkshopDetailScreen} />
      <HomeStack.Screen name="Compare" component={CompareScreen} />
      <HomeStack.Screen name="Booking" component={BookingScreen} />
      <HomeStack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
      <HomeStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <HomeStack.Screen name="Chat" component={ChatScreen} />
      <HomeStack.Screen name="Payment" component={PaymentScreen} />
      <HomeStack.Screen name="Review" component={ReviewScreen} />
      <HomeStack.Screen name="QueueStatus" component={QueueStatusScreen} />
      <HomeStack.Screen name="PriceEstimator" component={PriceEstimatorScreen} />
    </HomeStack.Navigator>
  );
}

function BookingsStackScreen() {
  return (
    <BookingsStack.Navigator screenOptions={{ headerShown: false }}>
      <BookingsStack.Screen name="BookingHistory" component={BookingHistoryScreen} />
      <BookingsStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <BookingsStack.Screen name="Chat" component={ChatScreen} />
      <BookingsStack.Screen name="Payment" component={PaymentScreen} />
      <BookingsStack.Screen name="Review" component={ReviewScreen} />
    </BookingsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="MyVehicles" component={MyVehiclesScreen} />
      <ProfileStack.Screen name="VehicleServiceHistory" component={VehicleServiceHistoryScreen} />
      <ProfileStack.Screen name="MyReviews" component={MyReviewsScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="Loyalty" component={LoyaltyScreen} />
      <ProfileStack.Screen name="Referral" component={ReferralScreen} />
      <ProfileStack.Screen name="CorporateRegistration" component={CorporateRegistrationScreen} />
      <ProfileStack.Screen name="CorporateManagement" component={CorporateManagementScreen} />
    </ProfileStack.Navigator>
  );
}

export function CustomerNavigator() {
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
            HomeTab: focused ? 'search' : 'search-outline',
            BookingsTab: focused ? 'receipt' : 'receipt-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStackScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="HomeTab" component={HomeStackScreen} options={{ tabBarLabel: 'Explore' }} />
      <Tab.Screen name="BookingsTab" component={BookingsStackScreen} options={{ tabBarLabel: 'Bookings' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
