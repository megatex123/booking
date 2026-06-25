import React, { useEffect, useState, useMemo} from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showConfirm, showAlert } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBookingById, cancelBooking } from '../../store/bookingSlice';
import { reviewAPI, bookingAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice, formatDate, formatTime } from '../../utils/helpers';
import { Review } from '../../types';
import { uploadAPI } from '../../services/api';

interface Props {
  navigation: any;
  route: any;
}

export const BookingDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bookingId: string = route.params?.bookingId;
  const dispatch = useAppDispatch();
  const { selectedBooking: booking, loading } = useAppSelector((s) => s.bookings);
  const { user } = useAppSelector((s) => s.auth);
  const [review, setReview] = useState<Review | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    dispatch(fetchBookingById(bookingId));
  }, [bookingId]);

  useEffect(() => {
    if (booking?.status === 'completed') {
      reviewAPI.getBookingReview(bookingId).then((r) => setReview(r.data)).catch(() => {});
    }
  }, [booking?.status]);

  const handleCancel = () => {
    showConfirm('Cancel this booking?', async () => {
      setCancelling(true);
      await dispatch(cancelBooking(bookingId));
      setCancelling(false);
    });
  };

  const openReschedule = () => {
    setNewDate(booking.scheduled_date);
    setNewTime(booking.scheduled_time);
    setRescheduleModal(true);
  };

  const handleReschedule = async () => {
    if (!newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      showAlert('Invalid Date', 'Enter date as YYYY-MM-DD');
      return;
    }
    if (!newTime.match(/^\d{2}:\d{2}$/)) {
      showAlert('Invalid Time', 'Enter time as HH:MM (e.g. 14:30)');
      return;
    }
    setRescheduling(true);
    try {
      await bookingAPI.rescheduleBooking(bookingId, newDate, newTime);
      setRescheduleModal(false);
      dispatch(fetchBookingById(bookingId));
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (Platform.OS !== 'web') {
      showAlert('Invoice', 'Invoice download is available on the web version.');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/v1/bookings/${bookingId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showAlert('Error', 'Could not generate invoice.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${bookingId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showAlert('Error', 'Could not download invoice.');
    }
  };

  if (loading || !booking) return <Loading fullScreen message="Loading booking..." />;

  const canReschedule = ['pending', 'confirmed'].includes(booking.status) && user?.role === 'customer';
  const canCancel = ['pending', 'confirmed'].includes(booking.status) && user?.role === 'customer';
  const canPay = ['confirmed', 'completed'].includes(booking.status) && booking.payment_status === 'unpaid' && user?.role === 'customer';
  const canReview = booking.status === 'completed' && booking.payment_status === 'paid' && !review && user?.role === 'customer';
  const awaitingPayment = booking.status === 'completed' && booking.payment_status === 'unpaid' && user?.role === 'customer';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Chat', { bookingId, workshopName: booking.workshop_name })}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <StatusBadge status={booking.status} />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Payment</Text>
            <StatusBadge status={booking.payment_status} />
          </View>
          {(booking as any).payment_type === 'corporate' && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Billing</Text>
              <View style={styles.corporateBadge}>
                <Ionicons name="business-outline" size={12} color={colors.primary} />
                <Text style={styles.corporateBadgeText}>Corporate</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Insurance Claim Card */}
        {(booking as any).payment_type === 'insurance' && (booking as any).insurance_details && (
          <Card style={styles.section}>
            <View style={styles.claimHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#0EA5E9" />
              <Text style={styles.claimTitle}>Insurance Claim</Text>
              {(booking as any).claim_status && (
                <View style={[styles.claimStatusBadge, {
                  backgroundColor: (booking as any).claim_status === 'approved' ? colors.success + '20'
                    : (booking as any).claim_status === 'rejected' ? colors.danger + '20'
                    : (booking as any).claim_status === 'processing' ? colors.warning + '20'
                    : '#0EA5E9' + '20',
                }]}>
                  <Text style={[styles.claimStatusText, {
                    color: (booking as any).claim_status === 'approved' ? colors.success
                      : (booking as any).claim_status === 'rejected' ? colors.danger
                      : (booking as any).claim_status === 'processing' ? colors.warning
                      : '#0EA5E9',
                  }]}>
                    {((booking as any).claim_status as string).charAt(0).toUpperCase() + ((booking as any).claim_status as string).slice(1)}
                  </Text>
                </View>
              )}
            </View>
            {[
              { label: 'Provider', value: ((booking as any).insurance_details?.provider as string)?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) },
              { label: 'Policy No.', value: (booking as any).insurance_details?.policy_number },
              { label: 'Incident Date', value: (booking as any).insurance_details?.incident_date },
              { label: 'Claim No.', value: (booking as any).insurance_details?.claim_number },
            ].filter(f => f.value).map((f) => (
              <View key={f.label} style={styles.metaRow}>
                <Text style={styles.claimField}>{f.label}:</Text>
                <Text style={styles.metaText}>{f.value}</Text>
              </View>
            ))}
            {(booking as any).claim_note && (
              <Text style={styles.claimNote}>{(booking as any).claim_note}</Text>
            )}
          </Card>
        )}

        {/* Workshop */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Workshop</Text>
          <Text style={styles.workshopName}>{booking.workshop_name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{booking.workshop_address}</Text>
          </View>
        </Card>

        {/* Schedule */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(booking.scheduled_date)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatTime(booking.scheduled_time)}</Text>
          </View>
        </Card>

        {/* Vehicle */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.metaRow}>
            <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {booking.vehicle_brand} {booking.vehicle_name} · {booking.vehicle_plate}
            </Text>
          </View>
        </Card>

        {/* Services */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          {booking.services.map((svc: any) => (
            <View key={svc._id} style={styles.serviceRow}>
              <Text style={styles.serviceName}>{svc.name}</Text>
              <Text style={styles.servicePrice}>{formatPrice(svc.price)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.serviceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatPrice(booking.total_price)}</Text>
          </View>
        </Card>

        {booking.notes ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{booking.notes}</Text>
          </Card>
        ) : null}

        {/* Service completion report from workshop */}
        {booking.status === 'completed' && (booking.completion_notes || (booking.service_reports && booking.service_reports.length > 0)) && (
          <Card style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.sectionTitle, { color: colors.success, marginBottom: 0 }]}>Service Report</Text>
            </View>

            {booking.service_reports && booking.service_reports.map((sr: any, idx: number) => (
              <View key={sr.service_id || idx} style={styles.svcReportCard}>
                <Text style={styles.svcReportName}>{sr.service_name}</Text>
                {sr.work_done ? (
                  <>
                    <Text style={styles.reportLabel}>Work Done</Text>
                    <Text style={styles.reportText}>{sr.work_done}</Text>
                  </>
                ) : null}
                {sr.media && sr.media.length > 0 && (
                  <View style={styles.mediaRow}>
                    {sr.media.map((url: string) => {
                      const isVideo = url.match(/\.(mp4|mov|webm|avi)$/i);
                      return isVideo ? (
                        <View key={url} style={styles.videoThumb}>
                          <Ionicons name="videocam" size={20} color="#fff" />
                        </View>
                      ) : (
                        <Image key={url} source={{ uri: uploadAPI.mediaUrl(url) }} style={styles.imageThumbnail} resizeMode="cover" />
                      );
                    })}
                  </View>
                )}
                {sr.products_used && sr.products_used.length > 0 && (
                  <View style={styles.puSection}>
                    <Text style={styles.reportLabel}>Parts & Products Used</Text>
                    {sr.products_used.map((pu: any) => (
                      <View key={pu.product_id} style={styles.puRow}>
                        <Ionicons name="cube-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.puText}>
                          {pu.product_name}{pu.brand ? ` (${pu.brand})` : ''} — {pu.quantity} {pu.unit}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {sr.next_service_months ? (
                  <View style={styles.nextServiceChip}>
                    <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                    <Text style={styles.nextServiceChipText}>
                      Next service in {sr.next_service_months >= 12
                        ? `${sr.next_service_months / 12} year${sr.next_service_months > 12 ? 's' : ''}`
                        : `${sr.next_service_months} month${sr.next_service_months > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}

            {booking.completion_notes ? (
              <>
                <Text style={[styles.reportLabel, { marginTop: booking.service_reports?.length ? 12 : 0 }]}>General Report</Text>
                <Text style={styles.reportText}>{booking.completion_notes}</Text>
              </>
            ) : null}

            {booking.next_service_months && !(booking.service_reports?.length) && (
              <>
                <Text style={[styles.reportLabel, { marginTop: 12 }]}>Next Service Recommended</Text>
                <View style={styles.nextServiceChip}>
                  <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                  <Text style={styles.nextServiceChipText}>
                    In {booking.next_service_months >= 12
                      ? `${booking.next_service_months / 12} year${booking.next_service_months > 12 ? 's' : ''}`
                      : `${booking.next_service_months} month${booking.next_service_months > 1 ? 's' : ''}`}
                  </Text>
                </View>
              </>
            )}
          </Card>
        )}

        {/* Post-completion flow banner */}
        {booking.status === 'completed' && user?.role === 'customer' && (
          <View style={styles.flowCard}>
            <Text style={styles.flowTitle}>Next Steps</Text>
            <View style={styles.flowRow}>
              {/* Step 1 — Service */}
              <View style={styles.flowStep}>
                <View style={[styles.flowIcon, styles.flowIconDone]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.flowLabel}>Service Done</Text>
              </View>
              <View style={[styles.flowLine, booking.payment_status === 'paid' && styles.flowLineDone]} />

              {/* Step 2 — Payment */}
              <View style={styles.flowStep}>
                <View style={[
                  styles.flowIcon,
                  booking.payment_status === 'paid' ? styles.flowIconDone : styles.flowIconActive,
                ]}>
                  <Ionicons
                    name={booking.payment_status === 'paid' ? 'checkmark' : 'card-outline'}
                    size={14}
                    color="#fff"
                  />
                </View>
                <Text style={[
                  styles.flowLabel,
                  booking.payment_status !== 'paid' && styles.flowLabelActive,
                ]}>Payment</Text>
              </View>
              <View style={[styles.flowLine, !review && booking.payment_status === 'paid' ? styles.flowLineActive : (review ? styles.flowLineDone : {})]} />

              {/* Step 3 — Review */}
              <View style={styles.flowStep}>
                <View style={[
                  styles.flowIcon,
                  review ? styles.flowIconDone
                    : booking.payment_status === 'paid' ? styles.flowIconActive
                    : styles.flowIconPending,
                ]}>
                  <Ionicons name={review ? 'checkmark' : 'star-outline'} size={14} color="#fff" />
                </View>
                <Text style={styles.flowLabel}>Review</Text>
              </View>
            </View>

            {awaitingPayment && (
              <View style={styles.payNotice}>
                <Ionicons name="information-circle-outline" size={15} color={colors.warning} />
                <Text style={styles.payNoticeText}>
                  Please settle your payment to unlock the review option.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {canPay && (
            <Button
              title={booking.status === 'completed' ? 'Pay Now to Continue' : 'Pay Now'}
              onPress={() => navigation.navigate('Payment', { bookingId: booking.id, totalPrice: booking.total_price })}
              fullWidth
              size="lg"
              style={styles.actionBtn}
            />
          )}
          {canReview && (
            <Button
              title="Leave a Review"
              onPress={() => navigation.navigate('Review', { booking })}
              variant="outline"
              fullWidth
              size="lg"
              style={styles.actionBtn}
            />
          )}
          {review && (
            <Card style={styles.reviewCard}>
              <Text style={styles.sectionTitle}>Your Review</Text>
              <View style={styles.stars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={18} color="#FBBC04" />
                ))}
              </View>
              {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
            </Card>
          )}
          {booking.status === 'completed' && (
            <TouchableOpacity style={styles.invoiceBtn} onPress={handleDownloadInvoice} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color="#2563EB" />
              <Text style={styles.invoiceBtnText}>Download Invoice (PDF)</Text>
              <Ionicons name="download-outline" size={16} color="#2563EB" />
            </TouchableOpacity>
          )}
          {canReschedule && (
            <>
              <Button
                title="Reschedule"
                onPress={openReschedule}
                variant="outline"
                fullWidth
                size="lg"
                style={styles.actionBtn}
              />
              <Text style={styles.rescheduleHint}>
                <Ionicons name="information-circle-outline" size={12} color={colors.textLight} /> You can reschedule until the workshop starts your service
              </Text>
            </>
          )}
          {canCancel && (
            <Button
              title="Cancel Booking"
              onPress={handleCancel}
              variant="danger"
              fullWidth
              size="lg"
              loading={cancelling}
            />
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal visible={rescheduleModal} transparent animationType="slide" onRequestClose={() => setRescheduleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Booking</Text>
              <TouchableOpacity onPress={() => setRescheduleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>Current: {formatDate(booking.scheduled_date)} at {formatTime(booking.scheduled_time)}</Text>

            <Text style={styles.fieldLabel}>New Date</Text>
            <TextInput
              style={styles.input}
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>New Time</Text>
            <View style={styles.timeGrid}>
              {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeChip, newTime === t && styles.timeChipActive]}
                  onPress={() => setNewTime(t)}
                >
                  <Text style={[styles.timeChipText, newTime === t && styles.timeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, rescheduling && { opacity: 0.6 }]}
              onPress={handleReschedule}
              disabled={rescheduling}
            >
              <Text style={styles.submitBtnText}>{rescheduling ? 'Saving…' : 'Confirm Reschedule'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
  headerTitle: { ...Typography.h3, color: colors.text },
  content: { padding: Spacing.lg, gap: 12 },
  statusCard: {},
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statusLabel: { ...Typography.bodySmall, color: colors.textSecondary },
  corporateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  corporateBadgeText: { ...Typography.caption, color: colors.primary, fontWeight: '700' },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  claimTitle: { ...Typography.body, color: '#0EA5E9', fontWeight: '700', flex: 1 },
  claimStatusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  claimStatusText: { ...Typography.caption, fontWeight: '700' },
  claimField: { ...Typography.bodySmall, color: colors.textSecondary, width: 90 },
  claimNote: { ...Typography.bodySmall, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
  section: {},
  sectionTitle: { ...Typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  workshopName: { ...Typography.body, fontWeight: '600', color: colors.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { ...Typography.bodySmall, color: colors.textSecondary, flex: 1 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  serviceName: { ...Typography.bodySmall, color: colors.text },
  servicePrice: { ...Typography.bodySmall, color: colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  totalLabel: { ...Typography.body, color: colors.text, fontWeight: '600' },
  totalAmount: { ...Typography.body, color: colors.primary, fontWeight: '700' },
  notes: { ...Typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  actions: { gap: 10 },
  actionBtn: {},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { ...Typography.h3, color: colors.text },
  modalHint: { ...Typography.bodySmall, color: colors.textSecondary, marginBottom: 20 },
  fieldLabel: { ...Typography.caption, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, ...Typography.body, color: colors.text },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  timeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  timeChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  timeChipTextActive: { color: colors.primary },
  submitBtn: { backgroundColor: colors.primary, borderRadius: BorderRadius.md, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { ...Typography.button, color: '#fff' },
  rescheduleHint: { fontSize: 11, color: colors.textLight, textAlign: 'center', marginTop: -4 },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#2563EB', borderRadius: BorderRadius.md,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
  },
  invoiceBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB', flex: 1, textAlign: 'center' },
  reviewCard: { backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '30' },
  stars: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  reviewComment: { ...Typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },

  flowCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  flowTitle: { ...Typography.bodySmall, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  flowRow: { flexDirection: 'row', alignItems: 'center' },
  flowStep: { alignItems: 'center', gap: 5, width: 60 },
  flowIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  flowIconDone: { backgroundColor: colors.success },
  flowIconActive: { backgroundColor: colors.primary },
  flowIconPending: { backgroundColor: colors.border },
  flowLabel: { ...Typography.caption, color: colors.textSecondary, textAlign: 'center', fontSize: 10 },
  flowLabelActive: { color: colors.primary, fontWeight: '700' },
  flowLine: { flex: 1, height: 2, backgroundColor: colors.border, marginBottom: 12 },
  flowLineDone: { backgroundColor: colors.success },
  flowLineActive: { backgroundColor: colors.primary + '40' },
  payNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.warning + '12',
    borderRadius: BorderRadius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  payNoticeText: { ...Typography.caption, color: colors.warning, flex: 1, lineHeight: 16, fontWeight: '500' },

  reportCard: { backgroundColor: colors.success + '08', borderWidth: 1, borderColor: colors.success + '30', gap: 8 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  reportLabel: { ...Typography.caption, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  reportText: { ...Typography.bodySmall, color: colors.text, lineHeight: 20 },
  svcReportCard: {
    backgroundColor: colors.background,
    borderRadius: BorderRadius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    marginTop: 6,
  },
  svcReportName: { ...Typography.bodySmall, fontWeight: '700', color: colors.text, marginBottom: 4 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  imageThumbnail: { width: 72, height: 72, borderRadius: BorderRadius.sm, backgroundColor: colors.border },
  videoThumb: {
    width: 72, height: 72, borderRadius: BorderRadius.sm,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  puSection: { marginTop: 6, gap: 4 },
  puRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  puText: { ...Typography.caption, color: colors.textSecondary, flex: 1 },
  nextServiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nextServiceChipText: { ...Typography.bodySmall, fontWeight: '600', color: colors.primary },
  });
}
