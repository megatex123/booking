import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔧</Text>
        </View>
        <Text style={styles.brand}>Bengkil Lah</Text>
        <Text style={styles.tagline}>Your trusted car service companion</Text>
        <Text style={styles.description}>
          Find nearby workshops, book services, and track your car's repair — all in one place.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Get Started"
          onPress={() => navigation.navigate('UserType')}
          fullWidth
          size="lg"
          style={styles.primaryBtn}
        />
        <Button
          title="I already have an account"
          onPress={() => navigation.navigate('Login')}
          variant="ghost"
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.lg },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  icon: { fontSize: 44 },
  brand: { ...Typography.h1, color: colors.text, fontSize: 34, letterSpacing: -0.5 },
  tagline: { ...Typography.h3, color: colors.primary, marginTop: 8, marginBottom: Spacing.lg },
  description: {
    ...Typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  buttons: { paddingBottom: Spacing.xl, gap: 8 },
  primaryBtn: { marginBottom: 8 },
  });
}
