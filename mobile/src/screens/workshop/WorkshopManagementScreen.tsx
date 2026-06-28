import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

const SECTIONS = [
  {
    icon: 'cube-outline' as const,
    iconBg: '#E8F5E9',
    iconColor: '#2E7D32',
    title: 'Product Inventory',
    description: 'Manage spare parts, materials, and reorder alerts',
    route: 'ProductManagement',
  },
  {
    icon: 'grid-outline' as const,
    iconBg: '#E3F2FD',
    iconColor: '#1565C0',
    title: 'Workshop Layout',
    description: 'Manage repair stations and assign active bookings',
    route: 'WorkshopLayout',
  },
  {
    icon: 'people-outline' as const,
    iconBg: '#FFF3E0',
    iconColor: '#E65100',
    title: 'Mechanics',
    description: 'Add staff, assign bookings, track individual workload',
    route: 'MechanicManagement',
  },
  {
    icon: 'people-circle-outline' as const,
    iconBg: '#F3E5F5',
    iconColor: '#7B1FA2',
    title: 'Customer CRM',
    description: 'Past customers, visit history, vehicles, and total spend',
    route: 'CustomerCRM',
  },
  {
    icon: 'bar-chart-outline' as const,
    iconBg: '#E8F4FD',
    iconColor: '#0277BD',
    title: 'Revenue & Analytics',
    description: 'Monthly revenue, peak hours, top services, customer ratio',
    route: 'Analytics',
  },
  {
    icon: 'shield-checkmark-outline',
    iconBg: '#E0F2FE',
    iconColor: '#0EA5E9',
    title: 'Panel Workshop Settings',
    description: 'Accept insurance claim bookings — configure accepted providers',
    route: 'PanelSettings',
  },
  {
    icon: 'flame-outline' as const,
    iconBg: '#FFF3E0',
    iconColor: '#F97316',
    title: 'Promotions & Flash Deals',
    description: 'Create time-limited offers that appear as badges on your workshop card',
    route: 'Promotions',
  },
  {
    icon: 'calendar-outline' as const,
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
    title: 'Staff Scheduling',
    description: 'Roster mechanics by day and shift — track who is on duty',
    route: 'StaffScheduling',
  },
];

export const WorkshopManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Workshop Management</Text>
      <View style={{ width: 24 }} />
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>
        Manage your workshop resources, inventory, and repair bay assignments.
      </Text>

      {SECTIONS.map((s) => (
        <TouchableOpacity
          key={s.route}
          style={styles.card}
          onPress={() => navigation.navigate(s.route)}
          activeOpacity={0.85}
        >
          <View style={[styles.iconBox, { backgroundColor: s.iconBg }]}>
            <Ionicons name={s.icon} size={28} color={s.iconColor} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardDesc}>{s.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  </SafeAreaView>
  );
}

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...Typography.h3, color: colors.text },
  content: { padding: Spacing.lg, gap: 14 },
  subtitle: {
    ...Typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { ...Typography.body, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardDesc: { ...Typography.caption, color: colors.textSecondary, lineHeight: 18 },
  });
}
