import { Alert, Platform } from 'react-native';

export const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

export const showConfirm = (message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
  } else {
    Alert.alert('', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: onConfirm },
    ]);
  }
};
