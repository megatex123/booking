import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  navigation: any;
}

const FEATURES = [
  { icon: 'location-outline' as const,  label: 'Workshops Near You',  desc: 'Discover trusted mechanics around you' },
  { icon: 'calendar-outline' as const,  label: 'Instant Booking',     desc: 'Book appointments in seconds' },
  { icon: 'construct-outline' as const, label: 'Live Updates',        desc: 'Track your car repair in real-time' },
];

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.outer}>
      {/* Hero — primary background */}
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Ionicons name="car-sport" size={52} color="#fff" />
        </View>
        <Text style={styles.brand}>Bengkil Lah</Text>
        <Text style={styles.tagline}>Your trusted car service companion</Text>
      </View>

      {/* Sheet — surface background, rounded top */}
      <View style={styles.sheet}>
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name={f.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Button
          title="Get Started"
          onPress={() => navigation.navigate('UserType')}
          fullWidth
          size="lg"
        />

        <TouchableOpacity
          style={styles.signInRow}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text style={styles.signInText}>Already have an account?  </Text>
          <Text style={styles.signInLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: colors.primary },

    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    logoRing: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    brand: {
      fontSize: 38,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginBottom: 8,
    },
    tagline: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.82)',
      textAlign: 'center',
      lineHeight: 24,
    },

    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    features: { marginBottom: Spacing.xl },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
    },
    featureIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    featureLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    featureDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.md,
      paddingBottom: 8,
    },
    signInText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    signInLink: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}
