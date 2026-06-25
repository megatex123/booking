// Web stub for expo-image-picker — native camera/gallery APIs are unavailable on web
const MediaTypeOptions = { All: 'All', Images: 'Images', Videos: 'Videos' };
const UIImagePickerControllerQualityType = { High: 0, Medium: 1, Low: 2 };
const UIImagePickerPresentationStyle = { FullScreen: 0, PageSheet: 1 };
const CameraType = { front: 'front', back: 'back' };
const VideoExportPreset = { Passthrough: 0, LowQuality: 1, MediumQuality: 2, HighestQuality: 3 };

async function launchImageLibraryAsync(_options) {
  return { canceled: true, assets: [] };
}

async function launchCameraAsync(_options) {
  return { canceled: true, assets: [] };
}

async function requestMediaLibraryPermissionsAsync() {
  return { granted: false, status: 'denied' };
}

async function requestCameraPermissionsAsync() {
  return { granted: false, status: 'denied' };
}

async function getMediaLibraryPermissionsAsync() {
  return { granted: false, status: 'denied' };
}

async function getCameraPermissionsAsync() {
  return { granted: false, status: 'denied' };
}

module.exports = {
  MediaTypeOptions,
  UIImagePickerControllerQualityType,
  UIImagePickerPresentationStyle,
  CameraType,
  VideoExportPreset,
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  getMediaLibraryPermissionsAsync,
  getCameraPermissionsAsync,
};
