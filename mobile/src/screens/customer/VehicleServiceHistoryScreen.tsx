import React, { useEffect, useState, useMemo} from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingAPI, uploadAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice } from '../../utils/helpers';

interface ProductUsed {
  product_id: string;
  product_name: string;
  brand?: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

interface ServiceReport {
  service_id: string;
  service_name: string;
  work_done: string;
  next_service_months?: number | null;
  media?: string[];
  products_used?: ProductUsed[];
}

interface Booking {
  id: string;
  workshop_name: string;
  workshop_address: string;
  services: any[];
  vehicle_plate: string;
  vehicle_name: string;
  vehicle_brand: string;
  scheduled_date: string;
  total_price: number;
  status: string;
  completion_notes?: string;
  next_service_months?: number | null;
  service_reports?: ServiceReport[];
  updated_at: string;
}

interface Props {
  navigation: any;
  route: any;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatMonths(months: number): string {
  if (months >= 12) {
    const y = months / 12;
    return `${y} year${y > 1 ? 's' : ''}`;
  }
  return `${months} month${months > 1 ? 's' : ''}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyColor(dueDate: Date, colors: AppTheme): string {
  const now = new Date();
  const daysLeft = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return colors.danger;
  if (daysLeft < 30) return '#F59E0B';
  return colors.success;
}

export const VehicleServiceHistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { vehicle } = route.params as { vehicle: { plate: string; model: string; year?: string; color?: string } };
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingAPI.getMyBookings('completed').then((res) => {
      const all: Booking[] = res.data;
      const forVehicle = all.filter(
        (b) => b.vehicle_plate.toUpperCase() === vehicle.plate.toUpperCase()
      );
      // Most recent first
      forVehicle.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setBookings(forVehicle);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Compute next service due from most recent booking
  const nextServiceInfo = (() => {
    if (bookings.length === 0) return null;
    const latest = bookings[0];
    // Collect all next_service_months from per-service reports + overall
    const candidates: number[] = [];
    if (latest.service_reports?.length) {
      latest.service_reports.forEach((r) => { if (r.next_service_months) candidates.push(r.next_service_months); });
    }
    if (latest.next_service_months) candidates.push(latest.next_service_months);
    if (candidates.length === 0) return null;
    const soonestMonths = Math.min(...candidates);
    const completedAt = new Date(latest.updated_at);
    const dueDate = addMonths(completedAt, soonestMonths);
    return { dueDate, soonestMonths, workshopName: latest.workshop_name };
  })();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Vehicle summary */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car" size={30} color={colors.primary} />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
            <Text style={styles.vehicleMeta}>
              {vehicle.model}{vehicle.year ? ` • ${vehicle.year}` : ''}{vehicle.color ? ` • ${vehicle.color}` : ''}
            </Text>
            <Text style={styles.serviceCount}>{bookings.length} service{bookings.length !== 1 ? 's' : ''} completed</Text>
          </View>
        </View>

        {/* Next service due card */}
        {nextServiceInfo && (
          <View style={[styles.nextServiceCard, { borderColor: urgencyColor(nextServiceInfo.dueDate, colors) + '60' }]}>
            <View style={styles.nextServiceHeader}>
              <Ionicons name="alarm-outline" size={18} color={urgencyColor(nextServiceInfo.dueDate, colors)} />
              <Text style={[styles.nextServiceTitle, { color: urgencyColor(nextServiceInfo.dueDate, colors) }]}>
                Next Service Due
              </Text>
            </View>
            <Text style={styles.nextServiceDate}>{formatShortDate(nextServiceInfo.dueDate.toISOString())}</Text>
            <Text style={styles.nextServiceSub}>
              In {formatMonths(nextServiceInfo.soonestMonths)} from last service at {nextServiceInfo.workshopName}
            </Text>
            {nextServiceInfo.dueDate < new Date() && (
              <View style={styles.overdueChip}>
                <Ionicons name="warning-outline" size={13} color={colors.danger} />
                <Text style={styles.overdueText}>Overdue — book a service now</Text>
              </View>
            )}
          </View>
        )}

        {/* Service history timeline */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading service history...</Text>
          </View>
        )}

        {!loading && bookings.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No service history</Text>
            <Text style={styles.emptyText}>Completed bookings for this vehicle will appear here</Text>
          </View>
        )}

        {!loading && bookings.length > 0 && (
          <View style={styles.timeline}>
            <Text style={styles.timelineHeader}>Service History</Text>
            {bookings.map((b, idx) => (
              <View key={b.id} style={styles.timelineItem}>
                {/* Connector line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.dot, idx === 0 && styles.dotFirst]} />
                  {idx < bookings.length - 1 && <View style={styles.line} />}
                </View>

                <View style={styles.timelineContent}>
                  <Text style={styles.serviceDate}>{formatShortDate(b.updated_at)}</Text>
                  <View style={styles.serviceCard}>
                    {/* Workshop */}
                    <View style={styles.workshopRow}>
                      <Ionicons name="storefront-outline" size={14} color={colors.primary} />
                      <Text style={styles.workshopName}>{b.workshop_name}</Text>
                    </View>

                    {/* Services list */}
                    <View style={styles.servicesList}>
                      {b.services.map((svc: any) => (
                        <View key={svc._id} style={styles.serviceChip}>
                          <Ionicons name="construct-outline" size={11} color={colors.textSecondary} />
                          <Text style={styles.serviceChipText}>{svc.name}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Per-service reports */}
                    {b.service_reports && b.service_reports.length > 0 && (
                      <View style={styles.reportsSection}>
                        {b.service_reports.map((sr, si) => (
                          sr.work_done ? (
                            <View key={sr.service_id || si} style={styles.svcReport}>
                              <Text style={styles.svcReportName}>{sr.service_name}</Text>
                              <Text style={styles.svcReportWork}>{sr.work_done}</Text>
                              {sr.media && sr.media.length > 0 && (
                                <View style={styles.mediaRow}>
                                  {sr.media.map((url: string) => {
                                    const isVideo = url.match(/\.(mp4|mov|webm|avi)$/i);
                                    return isVideo ? (
                                      <View key={url} style={styles.videoThumb}>
                                        <Ionicons name="videocam" size={16} color="#fff" />
                                      </View>
                                    ) : (
                                      <Image key={url} source={{ uri: uploadAPI.mediaUrl(url) }} style={styles.mediaThumbnail} resizeMode="cover" />
                                    );
                                  })}
                                </View>
                              )}
                              {sr.products_used && sr.products_used.length > 0 && (
                                <View style={styles.productsSection}>
                                  <Text style={styles.productsLabel}>Products Used</Text>
                                  {sr.products_used.map((p, pi) => (
                                    <View key={p.product_id || pi} style={styles.productRow}>
                                      <View style={styles.productDot} />
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.productName}>{p.product_name}</Text>
                                        {p.brand ? <Text style={styles.productBrand}>{p.brand}</Text> : null}
                                      </View>
                                      <Text style={styles.productQty}>{p.quantity} {p.unit}</Text>
                                      <Text style={styles.productPrice}>{formatPrice(p.unit_price * p.quantity)}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                              {sr.next_service_months ? (
                                <View style={styles.nextChip}>
                                  <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                                  <Text style={styles.nextChipText}>
                                    Next in {formatMonths(sr.next_service_months)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null
                        ))}
                      </View>
                    )}

                    {/* General report */}
                    {b.completion_notes ? (
                      <View style={styles.generalReport}>
                        <Text style={styles.reportLabel}>General Report</Text>
                        <Text style={styles.reportText}>{b.completion_notes}</Text>
                      </View>
                    ) : null}

                    {/* Total */}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total paid</Text>
                      <Text style={styles.totalAmount}>{formatPrice(b.total_price)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...Typography.h3, color: colors.text },
  body: { padding: Spacing.lg },

  vehicleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  vehicleIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { ...Typography.h2, color: colors.text },
  vehicleMeta: { ...Typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  serviceCount: { ...Typography.caption, color: colors.primary, fontWeight: '600', marginTop: 4 },

  nextServiceCard: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 14,
    borderWidth: 1.5,
  },
  nextServiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  nextServiceTitle: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextServiceDate: { ...Typography.h2, color: colors.text, marginBottom: 2 },
  nextServiceSub: { ...Typography.caption, color: colors.textSecondary, lineHeight: 16 },
  overdueChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.danger + '12', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: colors.danger + '30',
  },
  overdueText: { ...Typography.caption, color: colors.danger, fontWeight: '600' },

  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { ...Typography.bodySmall, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { ...Typography.h3, color: colors.text },
  emptyText: { ...Typography.bodySmall, color: colors.textSecondary, textAlign: 'center', maxWidth: 260 },

  timeline: { gap: 0 },
  timelineHeader: {
    ...Typography.caption, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 16 },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.border, borderWidth: 2, borderColor: colors.border,
    marginTop: 4,
  },
  dotFirst: { backgroundColor: colors.primary, borderColor: colors.primary },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4, minHeight: 24 },

  timelineContent: { flex: 1, paddingBottom: 20 },
  serviceDate: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 6 },
  serviceCard: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  workshopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workshopName: { ...Typography.bodySmall, fontWeight: '600', color: colors.text, flex: 1 },

  servicesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  serviceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '10', borderRadius: BorderRadius.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  serviceChipText: { ...Typography.caption, color: colors.primary, fontWeight: '500' },

  reportsSection: {
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 8,
  },
  svcReport: {
    backgroundColor: colors.background, borderRadius: BorderRadius.sm,
    padding: 10, borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  svcReportName: { ...Typography.caption, fontWeight: '700', color: colors.text },
  svcReportWork: { ...Typography.caption, color: colors.textSecondary, lineHeight: 16 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  mediaThumbnail: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.border },
  videoThumb: {
    width: 56, height: 56, borderRadius: 6,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  productsSection: {
    borderTopWidth: 1, borderTopColor: colors.border + '80', paddingTop: 6, gap: 5, marginTop: 2,
  },
  productsLabel: {
    ...Typography.caption, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 9, marginBottom: 2,
  },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  productDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textLight, marginTop: 1,
  },
  productName: { ...Typography.caption, color: colors.text, fontWeight: '500', flex: 1 },
  productBrand: { fontSize: 10, color: colors.textSecondary },
  productQty: { ...Typography.caption, color: colors.textSecondary, fontSize: 10 },
  productPrice: { ...Typography.caption, color: colors.primary, fontWeight: '600', fontSize: 10, minWidth: 50, textAlign: 'right' },

  nextChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '12', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2,
  },
  nextChipText: { ...Typography.caption, color: colors.primary, fontWeight: '600', fontSize: 10 },

  generalReport: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  reportLabel: {
    ...Typography.caption, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  },
  reportText: { ...Typography.caption, color: colors.textSecondary, lineHeight: 16 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8,
  },
  totalLabel: { ...Typography.caption, color: colors.textSecondary },
  totalAmount: { ...Typography.bodySmall, fontWeight: '700', color: colors.primary },
  });
}
