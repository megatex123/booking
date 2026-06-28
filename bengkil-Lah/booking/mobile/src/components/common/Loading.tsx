import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../../utils/theme';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<Props> = ({ message, fullScreen = false }) => (
  <View style={[styles.container, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={Colors.primary} />
    {message && <Text style={styles.message}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  fullScreen: { flex: 1, backgroundColor: Colors.background },
  message: { ...Typography.body, color: Colors.textSecondary, marginTop: 12 },
});
