const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Mock native-only packages for web builds
const nativeOnlyMocks = {
  'react-native-maps': path.resolve(__dirname, 'src/mocks/react-native-maps.js'),
  '@stripe/stripe-react-native': path.resolve(__dirname, 'src/mocks/stripe-react-native.js'),
  'expo-location': path.resolve(__dirname, 'src/mocks/expo-location.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeOnlyMocks[moduleName]) {
    return { filePath: nativeOnlyMocks[moduleName], type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
