import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'http://localhost:8000';

let socket: Socket | null = null;

export const connectSocket = async () => {
  if (socket?.connected) return socket;
  const token = await AsyncStorage.getItem('access_token');
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
  });
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = () => socket;

export const joinBookingRoom = (bookingId: string) => {
  socket?.emit('join_booking', { booking_id: bookingId });
};

export const leaveBookingRoom = (bookingId: string) => {
  socket?.emit('leave_booking', { booking_id: bookingId });
};

export const sendSocketMessage = (bookingId: string, content: string) => {
  socket?.emit('send_message_ws', { booking_id: bookingId, content });
};
