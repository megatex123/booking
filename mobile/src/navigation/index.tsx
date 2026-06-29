import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useTheme } from '../hooks/useTheme';
import { createStackNavigator } from '@react-navigation/stack';
import { useAppDispatch, useAppSelector } from '../store';
import { setAuth, logout } from '../store/authSlice';
import { addNotification } from '../store/notificationSlice';
import { fetchUnreadCount } from '../store/notificationSlice';
import { fetchFlags } from '../store/flagsSlice';
import { getToken, getUser } from '../services/storage';
import { connectSocket, getSocket } from '../services/socket';
import { setUnauthorizedHandler } from '../services/api';
import { showAlert } from '../utils/webAlert';
import { Loading } from '../components/common/Loading';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { UserTypeScreen } from '../screens/auth/UserTypeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { VerifyOTPScreen } from '../screens/auth/VerifyOTPScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { CustomerNavigator } from './CustomerNavigator';
import { WorkshopNavigator } from './WorkshopNavigator';
import { AdminNavigator } from './AdminNavigator';

const Stack = createStackNavigator();

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler((reason) => {
      if (reason === 'SESSION_EXPIRED') {
        showAlert('Your account has been logged in from another device. You have been signed out.');
      }
      dispatch(logout());
    });
    (async () => {
      const [token, savedUser] = await Promise.all([getToken(), getUser()]);
      if (token && savedUser) {
        dispatch(setAuth({ token, user: savedUser }));
        await connectSocket();
      }
      setInitializing(false);
    })();
  }, []);

  // Re-fetch feature flags whenever the logged-in user changes (covers login, logout, init)
  useEffect(() => {
    dispatch(fetchFlags());
  }, [user?._id]);

  // Wire up notification socket listener whenever socket connects (login or init)
  useEffect(() => {
    if (!user) return;
    const attachListener = () => {
      const sock = getSocket();
      if (!sock) return;
      sock.off('new_notification');
      sock.on('new_notification', (notif: any) => {
        dispatch(addNotification(notif));
      });
      dispatch(fetchUnreadCount());
    };
    // Attach immediately if already connected, or wait for connect
    const sock = getSocket();
    if (sock?.connected) {
      attachListener();
    } else if (sock) {
      sock.once('connect', attachListener);
    }
    return () => {
      getSocket()?.off('new_notification');
    };
  }, [user?._id]);

  if (initializing) {
    return <Loading fullScreen message="Loading..." />;
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="UserType" component={UserTypeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    );
  }

  if (user.role === 'admin') return <AdminNavigator />;
  return user.role === 'customer' ? <CustomerNavigator /> : <WorkshopNavigator />;
}

function ThemedNavigationContainer({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const navTheme = {
    dark: scheme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
}

export function AppNavigator() {
  return (
    <ThemeProvider>
      <ThemedNavigationContainer>
        <RootNavigator />
      </ThemedNavigationContainer>
    </ThemeProvider>
  );
}
