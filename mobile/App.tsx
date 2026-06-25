import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { store } from './src/store';
import { AppNavigator } from './src/navigation';
import { connectSocket, getSocket } from './src/services/socket';
import { upsertBooking } from './src/store/bookingSlice';
import { initI18n } from './src/i18n';
import { Loading } from './src/components/common/Loading';

function SocketListener() {
  const socket = getSocket();
  useEffect(() => {
    if (!socket) return;
    const handleBookingUpdate = (booking: any) => {
      store.dispatch(upsertBooking(booking));
      Toast.show({
        type: 'info',
        text1: 'Booking Update',
        text2: `Status changed to ${booking.status}`,
      });
    };
    const handleNewBooking = (booking: any) => {
      store.dispatch(upsertBooking(booking));
      Toast.show({
        type: 'success',
        text1: 'New Booking Request!',
        text2: `From ${booking.customer_name}`,
      });
    };
    socket.on('booking_status_updated', handleBookingUpdate);
    socket.on('new_booking', handleNewBooking);
    return () => {
      socket.off('booking_status_updated', handleBookingUpdate);
      socket.off('new_booking', handleNewBooking);
    };
  }, [socket]);
  return null;
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Loading fullScreen message="Loading..." />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <AppNavigator />
          <SocketListener />
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}
