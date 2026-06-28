export const requestForegroundPermissionsAsync = async () => ({ status: 'granted' });
export const getCurrentPositionAsync = async () => ({
  coords: { latitude: 3.1390, longitude: 101.6869, accuracy: 10 },
});
export const watchPositionAsync = async (options, callback) => {
  callback({ coords: { latitude: 3.1390, longitude: 101.6869, accuracy: 10 } });
  return { remove: () => {} };
};
export const Accuracy = { Balanced: 3, High: 4, Highest: 5 };
export const PermissionStatus = { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' };
