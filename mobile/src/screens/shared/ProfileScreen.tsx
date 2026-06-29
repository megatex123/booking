import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/common/Card';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/authSlice';
import { fetchMyBookings } from '../../store/bookingSlice';
import { reviewAPI, uploadAPI } from '../../services/api';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../i18n';

type ThemePref = 'system' | 'light' | 'dark';
type LangCode = 'en' | 'ms';

interface Props {
  navigation?: any;
}

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { bookings } = useAppSelector((s) => s.bookings);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const { colors, preference, setScheme } = useTheme();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as LangCode;

  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (user?.role === 'customer') {
      dispatch(fetchMyBookings(undefined));
      reviewAPI.getMyReviews().then((r) => setReviewCount(r.data?.length ?? 0)).catch(() => setReviewCount(0));
    }
  }, [user?.role]);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('auth.logoutConfirm'))) {
        dispatch(logout());
      }
    } else {
      Alert.alert(t('auth.logoutTitle'), t('auth.logoutConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.logout'), style: 'destructive', onPress: () => dispatch(logout()) },
      ]);
    }
  };

  const menuItems = [
    { icon: 'person-outline', label: t('profile.editProfile'), onPress: () => navigation?.navigate('EditProfile') },
    ...(user?.role === 'customer'
      ? [
          { icon: 'car-outline', label: t('profile.myVehicles'), onPress: () => navigation?.navigate('MyVehicles') },
          { icon: 'star-outline', label: t('profile.loyaltyPoints'), onPress: () => navigation?.navigate('Loyalty') },
          { icon: 'gift-outline', label: t('profile.referralProgram'), onPress: () => navigation?.navigate('Referral') },
          { icon: 'business-outline', label: t('profile.corporateAccount'), onPress: () => navigation?.navigate('CorporateManagement') },
        ]
      : [
          { icon: 'business-outline', label: t('profile.workshopProfile'), onPress: () => navigation?.navigate('WorkshopProfile') },
          { icon: 'construct-outline', label: t('profile.manageServices'), onPress: () => navigation?.navigate('Services') },
        ]),
    { icon: 'key-outline', label: t('profile.changePassword'), onPress: () => navigation?.navigate('ChangePassword') },
    { icon: 'notifications-outline', label: t('profile.notifications'), onPress: () => navigation?.navigate('Notifications') },
    { icon: 'help-circle-outline', label: t('profile.helpSupport'), onPress: () => navigation?.navigate('HelpSupport') },
    { icon: 'shield-outline', label: t('profile.privacyPolicy'), onPress: () => navigation?.navigate('PrivacyPolicy') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.header}>
          {user?.avatar ? (
            <Image
              source={{ uri: uploadAPI.getFullUrl(user.avatar) }}
              style={styles.avatarImg}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role === 'customer' ? `🚗 ${t('profile.carOwner')}` : `🔧 ${t('profile.workshopVendor')}`}
            </Text>
          </View>
        </View>

        {/* Stats (customer) */}
        {user?.role === 'customer' && (
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.stat} onPress={() => navigation?.navigate && navigation.navigate('BookingsTab')}>
              <Text style={styles.statValue}>{bookings.length}</Text>
              <Text style={styles.statLabel}>{t('profile.bookings')}</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.stat} onPress={() => navigation?.navigate('MyReviews')}>
              <Text style={styles.statValue}>{reviewCount ?? '-'}</Text>
              <Text style={styles.statLabel}>{t('profile.reviews')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu */}
        <Card style={styles.menu}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, idx < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon as any} size={20} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Phone */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('auth.phone')}</Text>
          <Text style={styles.infoValue}>{user?.phone}</Text>
        </Card>

        {/* Language */}
        <Card style={styles.appearanceCard}>
          <Text style={styles.appearanceTitle}>{t('profile.language')}</Text>
          <View style={styles.themeRow}>
            {([['en', '🇬🇧', 'English'], ['ms', '🇲🇾', 'Bahasa Malaysia']] as [LangCode, string, string][]).map(([code, flag, label]) => (
              <TouchableOpacity
                key={code}
                style={[styles.themeOption, currentLang === code && styles.themeOptionActive]}
                onPress={() => setLanguage(code)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 16 }}>{flag}</Text>
                <Text style={[styles.themeOptionText, currentLang === code && { color: colors.primary, fontWeight: '700' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Appearance */}
        <Card style={styles.appearanceCard}>
          <Text style={styles.appearanceTitle}>{t('profile.appearance')}</Text>
          <View style={styles.themeRow}>
            {([['system', 'phone-portrait-outline', t('profile.system')], ['light', 'sunny-outline', t('profile.light')], ['dark', 'moon-outline', t('profile.dark')]] as [ThemePref, string, string][]).map(([val, icon, label]) => (
              <TouchableOpacity
                key={val}
                style={[styles.themeOption, preference === val && styles.themeOptionActive]}
                onPress={() => setScheme(val)}
                activeOpacity={0.8}
              >
                <Ionicons name={icon as any} size={18} color={preference === val ? colors.primary : colors.textSecondary} />
                <Text style={[styles.themeOptionText, preference === val && { color: colors.primary, fontWeight: '700' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{t('profile.version')}</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
    avatarImg: { width: 90, height: 90, borderRadius: 45 },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 4,
    },
    avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
    name: { ...Typography.h2, color: colors.text, marginBottom: 4 },
    email: { ...Typography.body, color: colors.textSecondary, marginBottom: 12 },
    roleBadge: {
      backgroundColor: colors.primary + '15',
      borderRadius: BorderRadius.full,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    roleText: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.lg,
      padding: Spacing.lg,
    },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { ...Typography.h2, color: colors.primary },
    statLabel: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
    statDivider: { width: 1, backgroundColor: colors.border },
    menu: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: 0, overflow: 'hidden' },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 16,
    },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
    menuLabel: { ...Typography.body, color: colors.text, flex: 1 },
    infoCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
    infoLabel: { ...Typography.caption, color: colors.textSecondary, marginBottom: 4 },
    infoValue: { ...Typography.body, color: colors.text },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      paddingVertical: 15,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.danger + '12',
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    logoutText: { ...Typography.button, color: colors.danger },
    version: { ...Typography.caption, color: colors.textLight, textAlign: 'center' },
    appearanceCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, padding: Spacing.md },
    appearanceTitle: {
      ...Typography.bodySmall,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    themeRow: { flexDirection: 'row', gap: 8 },
    themeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    themeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0D' },
    themeOptionText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  });
}
