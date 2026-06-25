import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'user_data';

export const saveToken = (token: string) => AsyncStorage.setItem(TOKEN_KEY, token);
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const removeToken = () => AsyncStorage.removeItem(TOKEN_KEY);

export const saveUser = (user: User) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
export const getUser = async (): Promise<User | null> => {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};
export const removeUser = () => AsyncStorage.removeItem(USER_KEY);

export const clearAuth = async () => {
  await removeToken();
  await removeUser();
};
