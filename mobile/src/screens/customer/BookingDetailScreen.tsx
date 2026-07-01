import React, { useEffect, useState, useMemo} from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, Platform } from 'react-native';
import { showConfirm, showAlert } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBookingById, cancelBooking } from '../../store/bookingSlice';
import { reviewAPI, bookingAPI, workshopAPI, loyaltyAPI } from '../../services/api';
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
  const [calOpen, setCalOpen] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [rescheduling, setRescheduling] = useState(false);
  const [respondingQuotationId, setRespondingQuotationId] = useState<string | null>(null);
  const [activePromotions, setActivePromotions] = useState<any[]>([]);
  const [workshopServices, setWorkshopServices] = useState<any[]>([]);
  const [loyaltyBalance, setLoyaltyBalance] = useState<{ points: number; rm_value: number } | null>(null);
  const [useLoyaltyForQuote, setUseLoyaltyForQuote] = useState<Set<string>>(new Set());

  // Rejection modal state
  const [rejectModalQid, setRejectModalQid] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [submittingReject, setSubmittingReject] = useState(false);

  // Edit services modal state
  const [showServiceEditModal, setShowServiceEditModal] = useState(false);
  const [editServiceIds, setEditServiceIds] = useState<Set<string>>(new Set());
  const [savingServiceEdit, setSavingServiceEdit] = useState(false);

  useEffect(() => {
    dispatch(fetchBookingById(bookingId));
  }, [bookingId]);

  // Load workshop services whenever booking is pending (for edit services feature)
  // or when there is a pending quotation (for quotation approval/rejection)
  useEffect(() => {
    const needsWorkshopData = booking?.status === 'pending' || booking?.quotations?.some((q) => q.status === 'pending');
    if (needsWorkshopData && booking?.workshop_id) {
      workshopAPI.getById(booking.workshop_id).then((r) => {
        setActivePromotions(r.data?.active_promotions || []);
        setWorkshopServices(r.data?.services?.filter((s: any) => s.is_active !== false) || []);
      }).catch(() => {});
      loyaltyAPI.getBalance().then((r) => setLoyaltyBalance(r.data)).catch(() => {});
    }
  }, [booking?.quotations, booking?.workshop_id]);

  // Auto-pick the best active promotion for a given quotation subtotal
  const bestPromoFor = (subtotal: number) => {
    return activePromotions
      .filter((p) => p.discount_type && p.discount_value != null && p.discount_value > 0)
      .reduce((best: any, p: any) => {
        const calc = (promo: any) =>
          promo.discount_type === 'percentage'
            ? Math.min(subtotal * promo.discount_value / 100, subtotal)
            : Math.min(promo.discount_value, subtotal);
        if (!best) return p;
        return calc(p) >= calc(best) ? p : best;
      }, null);
  };

  const quotePromoDiscount = (subtotal: number, promo: any) =>
    !promo ? 0 : promo.discount_type === 'percentage'
      ? Math.min(subtotal * promo.discount_value / 100, subtotal)
      : Math.min(promo.discount_value, subtotal);

  const quoteLoyaltyMaxPts = (afterPromo: number) =>
    loyaltyBalance ? Math.min(Math.floor(loyaltyBalance.points / 100) * 100, Math.floor(afterPromo / 0.01 / 100) * 100) : 0;

  const handleApproveQuotation = (quotationId: string, subtotal: number) => {
    const promo = bestPromoFor(subtotal);
    const promoDiscount = quotePromoDiscount(subtotal, promo);
    const afterPromo = Math.max(subtotal - promoDiscount, 0);
    const useLoyalty = useLoyaltyForQuote.has(quotationId);
    const loyaltyPts = useLoyalty ? quoteLoyaltyMaxPts(afterPromo) : 0;
    const finalAmount = Math.max(afterPromo - loyaltyPts * 0.01, 0);

    showConfirm(`Approve this quotation for ${formatPrice(finalAmount)}? The amount will be added to your total.`, async () => {
      setRespondingQuotationId(quotationId);
      try {
        await bookingAPI.respondToQuotation(bookingId, quotationId, 'approve', undefined, promo?.id, loyaltyPts >= 100 ? loyaltyPts : undefined);
        await dispatch(fetchBookingById(bookingId));
      } catch (e: any) {
        showAlert(e?.response?.data?.detail || 'Failed to approve quotation.');
      } finally {
        setRespondingQuotationId(null);
      }
    });
  };

  const openRejectModal = (quotationId: string) => {
    // Pre-select current booking services
    const currentIds = new Set((booking?.services || []).map((s: any) => s._id));
    setSelectedServiceIds(currentIds);
    setRejectReason('');
    setRejectModalQid(quotationId);
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmitReject = async () => {
    if (!rejectModalQid) return;
    setSubmittingReject(true);
    try {
      await bookingAPI.respondToQuotation(bookingId, rejectModalQid, 'reject', rejectReason.trim() || undefined);
      // If services changed, also update the booking's service selection
      const currentIds = new Set((booking?.services || []).map((s: any) => s._id));
      const newIds = Array.from(selectedServiceIds);
      const changed = newIds.length !== currentIds.size || newIds.some((id) => !currentIds.has(id));
      if (changed && newIds.length > 0) {
        await bookingAPI.updateServices(bookingId, newIds);
      }
      await dispatch(fetchBookingById(bookingId));
      setRejectModalQid(null);
    } catch (e: any) {
      showAlert(e?.response?.data?.detail || 'Failed to reject quotation.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const openServiceEditModal = () => {
    const currentIds = new Set((booking?.services || []).map((s: any) => s._id));
    setEditServiceIds(currentIds);
    setShowServiceEditModal(true);
  };

  const toggleEditService = (id: string) => {
    setEditServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSaveServiceEdit = async () => {
    if (editServiceIds.size === 0) {
      showAlert('Please select at least one service.');
      return;
    }
    setSavingServiceEdit(true);
    try {
      await bookingAPI.updateServices(bookingId, Array.from(editServiceIds));
      await dispatch(fetchBookingById(bookingId));
      setShowServiceEditModal(false);
    } catch (e: any) {
      showAlert(e?.response?.data?.detail || 'Failed to update services.');
    } finally {
      setSavingServiceEdit(false);
    }
  };

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
    const d = new Date(booking.scheduled_date);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setCalOpen(false);
    setRescheduleModal(true);
  };

  const handleReschedule = async () => {
    if (!newDate) {
      showAlert('Invalid Date', 'Please pick a date from the calendar');
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
      const res = await bookingAPI.downloadInvoice(bookingId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${bookingId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Could not generate invoice.';
      showAlert('Error', detail);
    }
  };

  const handleDownloadQuotation = async (quotationId: string) => {
    if (Platform.OS !== 'web') {
      showAlert('Quotation', 'Quotation download is available on the web version.');
      return;
    }
    try {
      const res = await bookingAPI.downloadQuotation(bookingId, quotationId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation-${quotationId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Could not generate quotation PDF.';
      showAlert('Error', detail);
    }
  };

  if (loading || !booking) return <Loading fullScreen message="Loading booking..." />;

  const canReschedule = ['pending', 'confirmed'].includes(booking.status) && user?.role === 'customer';
  const canCancel = ['pending', 'confirmed'].includes(booking.status) && user?.role === 'customer';
  const canEditServices = booking.status === 'pending' && user?.role === 'customer';
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
          {!!booking.mechanic_name && (
            <View style={styles.metaRow}>
              <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>Mechanic: <Text style={{ fontWeight: '700', color: colors.text }}>{booking.mechanic_name}</Text></Text>
            </View>
          )}
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
          {(() => {
            const promoDiscount: number = booking.promotion_discount ?? 0;
            const promoTitle: string | null = booking.promotion_title ?? null;
            const referralDiscount: number = booking.referral_discount ?? 0;
            const loyaltyDiscount: number = booking.loyalty_discount ?? 0;
            const hasProducts = booking.products_total != null && booking.products_total > 0;
            // Raw sum of originally selected services — reliable regardless of any
            // approved quotations, which are tracked (and displayed) separately below.
            const rawServicesTotal = booking.services.reduce((sum: number, s: any) => sum + s.price, 0);
            const subtotal = hasProducts ? (booking.services_total ?? 0) + (booking.products_total ?? 0) : rawServicesTotal;
            // The total for THIS card's discounts is the original price before any
            // quotations were approved — booking.total_price may have since been
            // revised/added to by approved quotations (shown in the Quotations card).
            const originalTotal = booking.original_total_price ?? booking.total_price;
            const hasDiscounts = promoDiscount > 0 || referralDiscount > 0 || loyaltyDiscount > 0;

            return (
              <>
                {hasProducts && (
                  <>
                    <View style={styles.serviceRow}>
                      <Text style={styles.totalLabel}>Services</Text>
                      <Text style={styles.servicePrice}>{formatPrice(booking.services_total ?? 0)}</Text>
                    </View>
                    <View style={styles.serviceRow}>
                      <Text style={styles.totalLabel}>Parts &amp; Products</Text>
                      <Text style={styles.servicePrice}>{formatPrice(booking.products_total ?? 0)}</Text>
                    </View>
                  </>
                )}

                {hasDiscounts && (
                  <View style={styles.serviceRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={[styles.servicePrice, { textDecorationLine: 'line-through', color: colors.textSecondary }]}>
                      {formatPrice(subtotal)}
                    </Text>
                  </View>
                )}

                {promoDiscount > 0 && (
                  <View style={styles.serviceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="pricetag-outline" size={13} color="#F97316" />
                      <Text style={{ fontSize: 13, color: '#F97316', fontWeight: '600' }}>
                        {promoTitle ?? 'Promotion'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#F97316' }}>
                      -{formatPrice(promoDiscount)}
                    </Text>
                  </View>
                )}

                {referralDiscount > 0 && (
                  <View style={styles.serviceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="people-outline" size={13} color="#8B5CF6" />
                      <Text style={{ fontSize: 13, color: '#8B5CF6', fontWeight: '600' }}>Referral Discount</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#8B5CF6' }}>
                      -{formatPrice(referralDiscount)}
                    </Text>
                  </View>
                )}

                {loyaltyDiscount > 0 && (
                  <View style={styles.serviceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="star-outline" size={13} color="#F59E0B" />
                      <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '600' }}>Loyalty Points</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
                      -{formatPrice(loyaltyDiscount)}
                    </Text>
                  </View>
                )}

                {hasDiscounts && <View style={[styles.divider, { marginVertical: 6 }]} />}

                <View style={[styles.serviceRow, { marginTop: hasDiscounts ? 0 : 4 }]}>
                  <Text style={[styles.totalLabel, { fontWeight: '800' }]}>
                    {!!booking.quotations?.length ? 'Services Total' : 'Total'}
                  </Text>
                  <Text style={styles.totalAmount}>{formatPrice(originalTotal)}</Text>
                </View>
              </>
            );
          })()}
        </Card>

        {/* Quotations */}
        {!!booking.quotations?.length && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Quotations</Text>
            {booking.quotations.slice().reverse().map((q) => {
              const statusColor = q.status === 'approved' ? colors.success : q.status === 'rejected' ? colors.danger : '#F59E0B';
              return (
                <View key={q._id} style={{ borderWidth: 1, borderColor: q.status === 'pending' ? statusColor : colors.border, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                      {q.type === 'additional' ? 'Additional Work Found' : 'Initial Quote'}
                    </Text>
                    <View style={{ backgroundColor: statusColor + '18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor, textTransform: 'capitalize' }}>{q.status}</Text>
                    </View>
                  </View>
                  {!!q.note && <Text style={{ fontSize: 13, color: colors.text, marginBottom: 8, fontStyle: 'italic' }}>"{q.note}"</Text>}
                  {q.items.map((it, i) => (
                    <View key={i} style={styles.serviceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.serviceName, { fontSize: 13 }]}>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}</Text>
                        {!!it.description && <Text style={{ fontSize: 11, color: colors.textSecondary }}>{it.description}</Text>}
                      </View>
                      <Text style={[styles.servicePrice, { fontSize: 13 }]}>{formatPrice(it.price * it.quantity)}</Text>
                    </View>
                  ))}
                  {q.status === 'pending' && (() => {
                    const promo = bestPromoFor(q.subtotal);
                    const promoDiscount = quotePromoDiscount(q.subtotal, promo);
                    const afterPromo = Math.max(q.subtotal - promoDiscount, 0);
                    const loyaltyOn = useLoyaltyForQuote.has(q._id);
                    const maxPts = quoteLoyaltyMaxPts(afterPromo);
                    const loyaltyDiscountPreview = loyaltyOn ? maxPts * 0.01 : 0;
                    const finalPreview = Math.max(afterPromo - loyaltyDiscountPreview, 0);
                    const hasAnyDiscount = promoDiscount > 0 || (loyaltyOn && maxPts >= 100);

                    return (
                      <>
                        <View style={[styles.serviceRow, { marginTop: 4 }]}>
                          <Text style={[styles.totalLabel, { fontSize: 13 }]}>Subtotal</Text>
                          <Text style={[styles.totalAmount, { fontSize: 13 }]}>{formatPrice(q.subtotal)}</Text>
                        </View>

                        {promoDiscount > 0 && (
                          <View style={styles.serviceRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="pricetag-outline" size={12} color="#F97316" />
                              <Text style={{ fontSize: 12, color: '#F97316', fontWeight: '600' }}>{promo?.title ?? 'Promotion'} (auto-applied)</Text>
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#F97316' }}>-{formatPrice(promoDiscount)}</Text>
                          </View>
                        )}

                        {loyaltyBalance && loyaltyBalance.points >= 100 && (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: loyaltyOn ? '#F59E0B18' : colors.background, borderWidth: 1, borderColor: loyaltyOn ? '#F59E0B' : colors.border }}
                            onPress={() => setUseLoyaltyForQuote((prev) => {
                              const next = new Set(prev);
                              if (next.has(q._id)) next.delete(q._id); else next.add(q._id);
                              return next;
                            })}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name={loyaltyOn ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={loyaltyOn ? '#F59E0B' : colors.textLight} />
                              <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>
                                Use loyalty points ({loyaltyBalance.points} pts ≈ {formatPrice(loyaltyBalance.rm_value)})
                              </Text>
                            </View>
                            {loyaltyOn && maxPts >= 100 && (
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>-{formatPrice(loyaltyDiscountPreview)}</Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {hasAnyDiscount && (
                          <View style={[styles.serviceRow, { marginTop: 6 }]}>
                            <Text style={[styles.totalLabel, { fontSize: 13, fontWeight: '800' }]}>You'll Pay</Text>
                            <Text style={[styles.totalAmount, { fontSize: 14 }]}>{formatPrice(finalPreview)}</Text>
                          </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                            onPress={() => openRejectModal(q._id)}
                            disabled={respondingQuotationId === q._id}
                          >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reject</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: colors.success, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                            onPress={() => handleApproveQuotation(q._id, q.subtotal)}
                            disabled={respondingQuotationId === q._id}
                          >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Approve</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    );
                  })()}

                  {q.status !== 'pending' && (
                    <>
                      <View style={[styles.serviceRow, { marginTop: 4 }]}>
                        <Text style={[styles.totalLabel, { fontSize: 13 }]}>Subtotal</Text>
                        <Text style={[styles.totalAmount, { fontSize: 13 }]}>{formatPrice(q.subtotal)}</Text>
                      </View>
                      {q.status === 'approved' && !!q.promotion_discount && q.promotion_discount > 0 && (
                        <View style={styles.serviceRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="pricetag-outline" size={12} color="#F97316" />
                            <Text style={{ fontSize: 12, color: '#F97316', fontWeight: '600' }}>{q.promotion_title ?? 'Promotion'}</Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#F97316' }}>-{formatPrice(q.promotion_discount)}</Text>
                        </View>
                      )}
                      {q.status === 'approved' && !!q.loyalty_discount && q.loyalty_discount > 0 && (
                        <View style={styles.serviceRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="star-outline" size={12} color="#F59E0B" />
                            <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '600' }}>Loyalty Points ({q.loyalty_points_used} pts)</Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>-{formatPrice(q.loyalty_discount)}</Text>
                        </View>
                      )}
                      {q.status === 'approved' && (
                        <View style={[styles.serviceRow, { marginTop: 4 }]}>
                          <Text style={[styles.totalLabel, { fontSize: 13, fontWeight: '800' }]}>Quotation Total</Text>
                          <Text style={[styles.totalAmount, { fontSize: 14 }]}>{formatPrice(q.final_amount ?? q.subtotal)}</Text>
                        </View>
                      )}
                      {q.status === 'approved' && !!q.original_discount_offset && q.original_discount_offset > 0 && (
                        <>
                          <View style={styles.serviceRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Ionicons name="gift-outline" size={12} color="#10B981" />
                              <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>Your original booking discount</Text>
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>-{formatPrice(q.original_discount_offset)}</Text>
                          </View>
                          <View style={[styles.serviceRow, { marginTop: 4 }]}>
                            <Text style={[styles.totalLabel, { fontSize: 13, fontWeight: '800' }]}>Net Added to Total</Text>
                            <Text style={[styles.totalAmount, { fontSize: 14, color: colors.success }]}>{formatPrice(q.net_contribution ?? q.final_amount ?? q.subtotal)}</Text>
                          </View>
                        </>
                      )}
                    </>
                  )}
                  {q.status === 'approved' && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, borderWidth: 1, borderColor: colors.success, borderRadius: 8, paddingVertical: 10 }}
                      onPress={() => handleDownloadQuotation(q._id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="print-outline" size={16} color={colors.success} />
                      <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13 }}>Print / Download PDF</Text>
                    </TouchableOpacity>
                  )}
                  {q.status === 'rejected' && !!q.customer_response_note && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>Your note: {q.customer_response_note}</Text>
                  )}
                </View>
              );
            })}

            {booking.quotations.some((q) => q.status === 'approved') && (() => {
              const originalDiscounts = (booking.referral_discount ?? 0) + (booking.promotion_discount ?? 0) + (booking.loyalty_discount ?? 0);
              return (
                <View style={{ backgroundColor: colors.primary + '12', borderRadius: 10, padding: 14, marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ ...Typography.body, fontWeight: '800', color: colors.text }}>Grand Total</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>{formatPrice(booking.total_price)}</Text>
                  </View>
                  {originalDiscounts > 0 && (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                      Includes your original -{formatPrice(originalDiscounts)} discount from booking{booking.loyalty_points_used ? ` (${booking.loyalty_points_used} loyalty pts)` : ''}
                    </Text>
                  )}
                </View>
              );
            })()}
          </Card>
        )}

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
              onPress={() => navigation.navigate('Payment', {
                bookingId: booking.id,
                totalPrice: booking.total_price,
                servicesTotal: booking.services_total,
                productsTotal: booking.products_total,
              })}
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
          {booking.status === 'completed' && booking.payment_status === 'paid' && (
            <TouchableOpacity style={styles.invoiceBtn} onPress={handleDownloadInvoice} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color="#2563EB" />
              <Text style={styles.invoiceBtnText}>Download Invoice (PDF)</Text>
              <Ionicons name="download-outline" size={16} color="#2563EB" />
            </TouchableOpacity>
          )}
          {canEditServices && (
            <Button
              title="Edit Services"
              onPress={openServiceEditModal}
              variant="outline"
              fullWidth
              size="lg"
              style={styles.actionBtn}
            />
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalHint}>Current: {formatDate(booking.scheduled_date)} at {formatTime(booking.scheduled_time)}</Text>

            <Text style={styles.fieldLabel}>New Date</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => setCalOpen(o => !o)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={{ flex: 1, color: newDate ? colors.text : colors.textLight, fontSize: 15 }}>
                {newDate ? formatDate(newDate) : 'Pick a date'}
              </Text>
              <Ionicons name={calOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={15} color={colors.textSecondary} />
            </TouchableOpacity>

            {calOpen && (() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const firstDay = new Date(calYear, calMonth, 1).getDay();
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
              const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
              while (cells.length % 7 !== 0) cells.push(null);
              const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
              const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
              return (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, padding: 12, marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <TouchableOpacity onPress={() => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1)} style={{ padding: 6 }}>
                      <Ionicons name="chevron-back" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{CAL_MONTHS[calMonth]} {calYear}</Text>
                    <TouchableOpacity onPress={() => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1)} style={{ padding: 6 }}>
                      <Ionicons name="chevron-forward" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                    {CAL_DAYS.map(d => (
                      <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  {Array.from({ length: cells.length / 7 }, (_, row) => (
                    <View key={row} style={{ flexDirection: 'row' }}>
                      {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                        if (!day) return <View key={col} style={{ flex: 1, height: 34 }} />;
                        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = dateStr === newDate;
                        const isDisabled = dateStr < todayStr;
                        const isToday = dateStr === todayStr;
                        return (
                          <TouchableOpacity
                            key={col}
                            disabled={isDisabled}
                            onPress={() => { setNewDate(dateStr); setCalOpen(false); }}
                            style={{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? colors.primary : 'transparent', borderRadius: 17, opacity: isDisabled ? 0.3 : 1 }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: isSelected || isToday ? '700' : '400', color: isSelected ? '#fff' : isToday ? colors.primary : colors.text }}>
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })()}

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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Services Modal */}
      <Modal visible={showServiceEditModal} transparent animationType="slide" onRequestClose={() => setShowServiceEditModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: 36, maxHeight: '88%' }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Services</Text>
                <TouchableOpacity onPress={() => setShowServiceEditModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={{ ...Typography.caption, color: colors.textSecondary, marginBottom: 16 }}>
                Select the services you want. You can change this until the workshop accepts your booking.
              </Text>

              {workshopServices.length === 0 && (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 24 }}>Loading services…</Text>
              )}

              {workshopServices.map((svc: any) => {
                const checked = editServiceIds.has(svc._id);
                return (
                  <TouchableOpacity
                    key={svc._id}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, backgroundColor: checked ? colors.primary + '10' : colors.background, borderWidth: 1, borderColor: checked ? colors.primary : colors.border }}
                    onPress={() => toggleEditService(svc._id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={checked ? colors.primary : colors.textLight}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...Typography.body, color: colors.text, fontWeight: checked ? '700' : '400' }}>{svc.name}</Text>
                      {!!svc.description && <Text style={{ ...Typography.caption, color: colors.textSecondary }}>{svc.description}</Text>}
                      {!!svc.duration_minutes && <Text style={{ ...Typography.caption, color: colors.textSecondary }}>~{svc.duration_minutes} min</Text>}
                    </View>
                    <Text style={{ ...Typography.body, fontWeight: '700', color: checked ? colors.primary : colors.textSecondary, marginLeft: 8 }}>
                      {formatPrice(svc.price)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {editServiceIds.size > 0 && workshopServices.length > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: colors.primary + '10', borderRadius: 10, marginTop: 8, marginBottom: 12 }}>
                  <Text style={{ ...Typography.body, fontWeight: '800', color: colors.text }}>
                    {editServiceIds.size} service{editServiceIds.size !== 1 ? 's' : ''} selected
                  </Text>
                  <Text style={{ ...Typography.body, fontWeight: '800', color: colors.primary }}>
                    {formatPrice(workshopServices.filter((s: any) => editServiceIds.has(s._id)).reduce((sum: number, s: any) => sum + s.price, 0))}
                  </Text>
                </View>
              )}

              <Button
                title={savingServiceEdit ? 'Saving…' : 'Save Changes'}
                onPress={handleSaveServiceEdit}
                fullWidth
                size="lg"
                loading={savingServiceEdit}
                disabled={editServiceIds.size === 0}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reject Quotation Modal */}
      <Modal visible={!!rejectModalQid} transparent animationType="slide" onRequestClose={() => setRejectModalQid(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: 36, maxHeight: '88%' }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Reject Quotation</Text>
                <TouchableOpacity onPress={() => setRejectModalQid(null)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Reason */}
              <Text style={{ ...Typography.caption, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 }}>
                Reason for rejection (optional)
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: colors.background, minHeight: 80, textAlignVertical: 'top', marginBottom: 20, ...Typography.body }}
                placeholder="e.g. Price too high for engine tune-up, please revise"
                placeholderTextColor={colors.textLight}
                multiline
                value={rejectReason}
                onChangeText={setRejectReason}
              />

              {/* Service readjustment */}
              {workshopServices.length > 0 && (
                <>
                  <Text style={{ ...Typography.caption, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                    Adjust your service selection
                  </Text>
                  <Text style={{ ...Typography.caption, color: colors.textSecondary, marginBottom: 12 }}>
                    Select the services you'd like to keep or add — the workshop will see your updated request.
                  </Text>
                  {workshopServices.map((svc: any) => {
                    const checked = selectedServiceIds.has(svc._id);
                    return (
                      <TouchableOpacity
                        key={svc._id}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, backgroundColor: checked ? colors.primary + '10' : colors.background, borderWidth: 1, borderColor: checked ? colors.primary : colors.border }}
                        onPress={() => toggleService(svc._id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={checked ? colors.primary : colors.textLight}
                          style={{ marginRight: 10 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...Typography.body, color: colors.text, fontWeight: checked ? '700' : '400' }}>{svc.name}</Text>
                          {!!svc.description && <Text style={{ ...Typography.caption, color: colors.textSecondary }}>{svc.description}</Text>}
                        </View>
                        <Text style={{ ...Typography.body, fontWeight: '700', color: checked ? colors.primary : colors.textSecondary }}>
                          {formatPrice(svc.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {selectedServiceIds.size > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: colors.background, borderRadius: 10, marginTop: 4, marginBottom: 8 }}>
                      <Text style={{ ...Typography.body, fontWeight: '700', color: colors.text }}>New Total</Text>
                      <Text style={{ ...Typography.body, fontWeight: '800', color: colors.primary }}>
                        {formatPrice(workshopServices.filter((s: any) => selectedServiceIds.has(s._id)).reduce((sum: number, s: any) => sum + s.price, 0))}
                      </Text>
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity
                style={{ backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8, opacity: submittingReject ? 0.6 : 1 }}
                onPress={handleSubmitReject}
                disabled={submittingReject}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                  {submittingReject ? 'Submitting…' : 'Reject Quotation'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
