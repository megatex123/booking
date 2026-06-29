// Web implementation for expo-image-picker using a hidden <input type="file">
const MediaTypeOptions = { All: 'All', Images: 'Images', Videos: 'Videos' };
const UIImagePickerControllerQualityType = { High: 0, Medium: 1, Low: 2 };
const UIImagePickerPresentationStyle = { FullScreen: 0, PageSheet: 1 };
const CameraType = { front: 'front', back: 'back' };
const VideoExportPreset = { Passthrough: 0, LowQuality: 1, MediumQuality: 2, HighestQuality: 3 };

async function launchImageLibraryAsync(options) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.allowsMultipleSelection !== false;

    const mediaType = options?.mediaTypes;
    if (mediaType === 'Images') {
      input.accept = 'image/*';
    } else if (mediaType === 'Videos') {
      input.accept = 'video/*';
    } else {
      input.accept = 'image/*,video/*';
    }

    let resolved = false;
    const finish = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    input.onchange = () => {
      if (!input.files || input.files.length === 0) {
        finish({ canceled: true, assets: [] });
        return;
      }
      const assets = Array.from(input.files).map((file) => ({
        uri: URL.createObjectURL(file),
        type: file.type.startsWith('video') ? 'video' : 'image',
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
        width: 0,
        height: 0,
      }));
      finish({ canceled: false, assets });
    };

    // Fallback: if user closes dialog without selecting, resolve after focus returns
    const onFocus = () => {
      setTimeout(() => finish({ canceled: true, assets: [] }), 500);
    };
    window.addEventListener('focus', onFocus, { once: true });

    input.click();
  });
}

async function launchCameraAsync(_options) {
  return { canceled: true, assets: [] };
}

async function requestMediaLibraryPermissionsAsync() {
  return { granted: true, status: 'granted' };
}

async function requestCameraPermissionsAsync() {
  return { granted: true, status: 'granted' };
}

async function getMediaLibraryPermissionsAsync() {
  return { granted: true, status: 'granted' };
}

async function getCameraPermissionsAsync() {
  return { granted: true, status: 'granted' };
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
