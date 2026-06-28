import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Image, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';

export const ENIGMA_FOOTER_HEIGHT = 22;

function EnigmaFooter() {
  return (
    <View style={footerStyles.bar}>
      <Image
        source={require('./src/assets/enigma-logo.jpg')}
        style={footerStyles.logo}
        resizeMode="contain"
      />
      <Text style={footerStyles.text}>
        Developed by <Text style={footerStyles.brand}>Enigma Code Solution</Text>
      </Text>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: ENIGMA_FOOTER_HEIGHT,
    backgroundColor: '#0D1B2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    zIndex: 9999,
  } as any,
  logo: {
    width: 14, height: 14,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  brand: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '700',
  },
});
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
        <EnigmaFooter />
      </GestureHandlerRootView>
    </Provider>
  );
}
