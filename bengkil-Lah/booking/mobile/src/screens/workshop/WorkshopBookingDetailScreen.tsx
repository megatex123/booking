import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, Platform, TextInput, Image, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchBookingById, updateBookingStatus } from '../../store/bookingSlice';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice, formatDate, formatTime } from '../../utils/helpers';
import { showAlert } from '../../utils/webAlert';
import { api, uploadAPI, workshopAPI, bookingAPI } from '../../services/api';

interface ProductUsedState {
  product_id: string;
  product_name: string;
  brand: string;
  unit: string;
  quantity: string;   // string for TextInput
  unit_price: number;
}

interface ServiceReportState {
  service_id: string;
  service_name: string;
  work_done: string;
  next_service_months: number | null;
  media: string[];
  uploading: boolean;
  products_used: ProductUsedState[];
}

interface Props {
  navigation: any;
  route: any;
}

const NEXT_SERVICE_OPTIONS = [
  { label: '1 month',  value: 1 },
  { label: '3 months', value: 3 },
  { label: '6 months', value: 6 },
  { label: '1 year',   value: 12 },
  { label: '2 years',  value: 24 },
];

function nextServiceLabel(months: number) {
  if (months >= 12) {
    const y = months / 12;
    return `${y} year${y > 1 ? 's' : ''}`;
  }
  return `${months} month${months > 1 ? 's' : ''}`;
}

export const WorkshopBookingDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bookingId: string = route.params?.bookingId;
  const dispatch = useAppDispatch();
  const { selectedBooking: booking, loading } = useAppSelector((s) => s.bookings);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [serviceReports, setServiceReports] = useState<ServiceReportState[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');

  // Inventory for products used picker
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [productPickerIdx, setProductPickerIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  // Bay selection state
  const [stations, setStations] = useState<any[]>([]);
  const [occupiedStationIds, setOccupiedStationIds] = useState<Set<string>>(new Set());
  const [showBaySelector, setShowBaySelector] = useState(false);
  const [assigningBay, setAssigningBay] = useState(false);

  // Mechanic assignment state
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [showMechanicSelector, setShowMechanicSelector] = useState(false);
  const [assigningMechanic, setAssigningMechanic] = useState(false);

  // Insurance claim status
  const [showClaimStatusModal, setShowClaimStatusModal] = useState(false);
  const [updatingClaimStatus, setUpdatingClaimStatus] = useState(false);

  useEffect(() => {
    dispatch(fetchBookingById(bookingId));
    workshopAPI.getProducts().then((r) => setInventoryProducts(r.data)).catch(() => {});
    api.get('/workshops/my/mechanics').then((r: any) => setMechanics(r.data.filter((m: any) => m.is_active !== false))).catch(() => {});
  }, [bookingId]);

  // Load stations whenever the booking is in_progress
  useEffect(() => {
    if (booking?.status === 'in_progress') {
      loadStations();
    }
  }, [booking?.status]);

  const loadStations = async () => {
    try {
      const [stationsRes, inProgressRes] = await Promise.all([
        workshopAPI.getStations(),
        bookingAPI.getMyBookings('in_progress'),
      ]);
      setStations(stationsRes.data.filter((s: any) => s.is_active !== false));
      const occupied = new Set<string>(
        inProgressRes.data
          .filter((b: any) => b.id !== bookingId && b.station_id)
          .map((b: any) => b.station_id as string)
      );
      setOccupiedStationIds(occupied);
    } catch {
      // silently ignore if workshop has no stations yet
    }
  };

  const handleAssignMechanic = async (mechanicId: string | null) => {
    setAssigningMechanic(true);
    try {
      await api.patch(`/bookings/${bookingId}/mechanic`, { mechanic_id: mechanicId });
      await dispatch(fetchBookingById(bookingId));
      setShowMechanicSelector(false);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Could not assign mechanic');
    } finally {
      setAssigningMechanic(false);
    }
  };

  const handleUpdateClaimStatus = async (status: string) => {
    setUpdatingClaimStatus(true);
    try {
      await bookingAPI.updateInsuranceStatus(bookingId, { claim_status: status });
      await dispatch(fetchBookingById(bookingId));
      setShowClaimStatusModal(false);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Could not update claim status');
    } finally {
      setUpdatingClaimStatus(false);
    }
  };

  const handleAssignBay = async (stationId: string | null) => {
    setAssigningBay(true);
    try {
      await bookingAPI.assignStation(bookingId, stationId);
      await dispatch(fetchBookingById(bookingId));
      setShowBaySelector(false);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Could not assign bay');
    } finally {
      setAssigningBay(false);
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

  // Initialize service reports (pre-populate default products) when form opens
  useEffect(() => {
    if (!showCompleteForm || !booking?.services) return;
    workshopAPI.getMyWorkshop().then((res) => {
      const workshopSvcs: any[] = res.data?.services || [];
      setServiceReports(
        booking.services.map((svc: any) => {
          const def = workshopSvcs.find((s: any) => s._id === svc._id);
          const defaultProds: ProductUsedState[] = (def?.default_products || []).map((dp: any) => {
            const prod = inventoryProducts.find((p: any) => p._id === dp.product_id);
            return {
              product_id: dp.product_id,
              product_name: prod?.name || dp.product_id,
              brand: prod?.brand || '',
              unit: prod?.unit || 'pcs',
              quantity: String(dp.quantity),
              unit_price: prod?.price || 0,
            };
          });
          return {
            service_id: svc._id,
            service_name: svc.name,
            work_done: '',
            next_service_months: null,
            media: [],
            uploading: false,
            products_used: defaultProds,
          };
        })
      );
    }).catch(() => {
      setServiceReports(
        booking.services.map((svc: any) => ({
          service_id: svc._id,
          service_name: svc.name,
          work_done: '',
          next_service_months: null,
          media: [],
          uploading: false,
          products_used: [],
        }))
      );
    });
  }, [showCompleteForm]);

  const doUpdate = async (status: string, note?: string, completion_notes?: string, next_service_months?: number, service_reports?: ServiceReportState[]) => {
    setUpdating(status);
    const result = await dispatch(updateBookingStatus({
      id: bookingId,
      status,
      note,
      completion_notes,
      next_service_months,
      service_reports: service_reports?.map((r) => ({
        service_id: r.service_id,
        service_name: r.service_name,
        work_done: r.work_done,
        next_service_months: r.next_service_months ?? undefined,
        media: r.media.length > 0 ? r.media : undefined,
        products_used: r.products_used.length > 0
          ? r.products_used.map((pu) => ({
              product_id: pu.product_id,
              product_name: pu.product_name,
              brand: pu.brand,
              unit: pu.unit,
              quantity: parseFloat(pu.quantity) || 0,
              unit_price: pu.unit_price,
            }))
          : undefined,
      })),
    }));
    setUpdating(null);
    if (updateBookingStatus.rejected.match(result)) {
      showAlert('Update Failed', (result.payload as string) || 'Could not update booking status');
    } else if (status === 'completed' || status === 'rejected') {
      navigation.goBack();
    } else {
      dispatch(fetchBookingById(bookingId));
    }
  };

  const confirm = (message: string, onYes: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onYes();
    } else {
      Alert.alert('', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: onYes },
      ]);
    }
  };

  const handleConfirm = () => confirm('Confirm this booking request?', () => doUpdate('confirmed'));
  const handleReject  = () => confirm('Reject this booking?', () => doUpdate('rejected'));
  const handleStart   = async () => {
    await doUpdate('in_progress');
    // Open bay selector after status transitions
    setShowBaySelector(true);
  };

  const updateServiceReport = (idx: number, field: keyof ServiceReportState, value: any) => {
    setServiceReports((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const pickMedia = async (idx: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (result.canceled || !result.assets?.length) return;

    updateServiceReport(idx, 'uploading', true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
        const ext = mime.split('/')[1]?.replace('quicktime', 'mov') || 'jpg';
        const filename = `service_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const url = await uploadAPI.uploadFile(asset.uri, mime, filename);
        urls.push(url);
      }
      setServiceReports((prev) =>
        prev.map((r, i) => i === idx ? { ...r, media: [...r.media, ...urls], uploading: false } : r)
      );
    } catch (e: any) {
      updateServiceReport(idx, 'uploading', false);
      showAlert('Upload Failed', e.message || 'Could not upload file');
    }
  };

  const removeMedia = (idx: number, mediaUrl: string) => {
    setServiceReports((prev) =>
      prev.map((r, i) => i === idx ? { ...r, media: r.media.filter((u) => u !== mediaUrl) } : r)
    );
  };

  const addProductToReport = (idx: number, prod: any) => {
    setServiceReports((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (r.products_used.find((pu) => pu.product_id === prod._id)) return r; // already added
        return {
          ...r,
          products_used: [
            ...r.products_used,
            { product_id: prod._id, product_name: prod.name, brand: prod.brand || '', unit: prod.unit, quantity: '1', unit_price: prod.price },
          ],
        };
      })
    );
    setProductPickerIdx(null);
    setProductSearch('');
  };

  const removeProductFromReport = (idx: number, productId: string) => {
    setServiceReports((prev) =>
      prev.map((r, i) => i === idx ? { ...r, products_used: r.products_used.filter((pu) => pu.product_id !== productId) } : r)
    );
  };

  const updateProductQty = (idx: number, productId: string, qty: string) => {
    setServiceReports((prev) =>
      prev.map((r, i) => i === idx
        ? { ...r, products_used: r.products_used.map((pu) => pu.product_id === productId ? { ...pu, quantity: qty } : pu) }
        : r)
    );
  };

  const currentServiceName = productPickerIdx !== null ? serviceReports[productPickerIdx]?.service_name : null;

  const filteredInventory = inventoryProducts.filter((p) => {
    const matchesCat =
      productFilter === 'all' ? true :
      productFilter === 'suggested' ? (p.service_tags || []).includes(currentServiceName || '') :
      p.category === productFilter;
    const matchesSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.brand || '').toLowerCase().includes(productSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const suggestedCount = currentServiceName
    ? inventoryProducts.filter((p) => (p.service_tags || []).includes(currentServiceName)).length
    : 0;

  const PICKER_CATEGORIES = [
    { key: 'suggested',  label: 'Suggested',   icon: 'star-outline' },
    { key: 'all',        label: 'All',         icon: 'apps-outline' },
    { key: 'lubricant',  label: 'Lubricant',   icon: 'water-outline' },
    { key: 'filter',     label: 'Filter',      icon: 'funnel-outline' },
    { key: 'brake',      label: 'Brake',       icon: 'stop-circle-outline' },
    { key: 'tyre',       label: 'Tyre',        icon: 'ellipse-outline' },
    { key: 'electrical', label: 'Electrical',  icon: 'flash-outline' },
    { key: 'body',       label: 'Body',        icon: 'car-outline' },
    { key: 'other',      label: 'Other',       icon: 'cube-outline' },
  ] as const;

  const handleCompleteSubmit = () => {
    const missing = serviceReports.filter((r) => !r.work_done.trim());
    if (missing.length > 0 && !generalNotes.trim()) {
      showAlert('Required', 'Please fill in work done for each service or add a general report');
      return;
    }
    confirm('Submit completion report and mark as done?', () =>
      doUpdate('completed', undefined, generalNotes.trim() || undefined, undefined, serviceReports)
    );
  };

  if (loading || !booking) return <Loading fullScreen message="Loading booking..." />;

  const hasServiceReports = booking.service_reports && booking.service_reports.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking #{bookingId.slice(-6).toUpperCase()}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Chat', { bookingId, customerName: booking.customer_name })}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <View style={styles.statusRow}>
            <Text style={styles.sectionTitle}>Status</Text>
            <StatusBadge status={booking.status} />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <StatusBadge status={booking.payment_status} />
          </View>
          {booking.station_id && (() => {
            const s = stations.find((st) => st._id === booking.station_id);
            return (
              <View style={styles.statusRow}>
                <Text style={styles.sectionTitle}>Bay</Text>
                <View style={styles.bayStatusChip}>
                  <Ionicons name="car-sport-outline" size={12} color={colors.primary} />
                  <Text style={styles.bayStatusName}>{s ? s.name : booking.station_id}</Text>
                </View>
              </View>
            );
          })()}
          {(booking as any).mechanic_name && (
            <View style={styles.statusRow}>
              <Text style={styles.sectionTitle}>Mechanic</Text>
              <View style={styles.bayStatusChip}>
                <Ionicons name="person-outline" size={12} color={colors.secondary} />
                <Text style={styles.bayStatusName}>{(booking as any).mechanic_name}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Insurance Claim Card */}
        {(booking as any).payment_type === 'insurance' && (booking as any).insurance_details && (
          <Card style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={16} color="#0EA5E9" />
                <Text style={[styles.sectionTitle, { color: '#0EA5E9' }]}>Insurance Claim</Text>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: '#0EA5E9' + '20', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
                onPress={() => setShowClaimStatusModal(true)}
              >
                <Text style={{ fontSize: 12, color: '#0EA5E9', fontWeight: '700' }}>
                  {(booking as any).claim_status ? ((booking as any).claim_status as string).charAt(0).toUpperCase() + ((booking as any).claim_status as string).slice(1) : 'Update Status'}
                </Text>
              </TouchableOpacity>
            </View>
            {[
              { label: 'Provider', value: ((booking as any).insurance_details?.provider as string)?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) },
              { label: 'Policy No.', value: (booking as any).insurance_details?.policy_number },
              { label: 'Incident', value: (booking as any).insurance_details?.incident_date },
            ].filter(f => f.value).map((f) => (
              <View key={f.label} style={styles.metaRow}>
                <Text style={[styles.metaText, { width: 80, color: colors.textSecondary }]}>{f.label}:</Text>
                <Text style={styles.metaText}>{f.value}</Text>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text style={styles.customerName}>{booking.customer_name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{booking.customer_phone}</Text>
          </View>
        </Card>

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

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.metaRow}>
            <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {booking.vehicle_brand} {booking.vehicle_name} · {booking.vehicle_plate}
            </Text>
          </View>
        </Card>

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
            <Text style={styles.sectionTitle}>Customer Notes</Text>
            <Text style={styles.notes}>{booking.notes}</Text>
          </Card>
        ) : null}

        {/* Bay assignment — shown when in_progress */}
        {booking.status === 'in_progress' && (
          <Card style={styles.bayCard}>
            <View style={styles.bayHeader}>
              <Ionicons name="car-sport-outline" size={16} color={colors.primary} />
              <Text style={styles.bayTitle}>Workshop Bay</Text>
              {booking.station_id && !showBaySelector && (
                <TouchableOpacity onPress={() => setShowBaySelector(true)} style={styles.changeBayBtn}>
                  <Text style={styles.changeBayText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Currently assigned bay display */}
            {booking.station_id && !showBaySelector && (() => {
              const assigned = stations.find((s) => s._id === booking.station_id);
              return (
                <View style={styles.assignedBayRow}>
                  <View style={styles.assignedBayChip}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.assignedBayName}>
                      {assigned ? assigned.name : booking.station_id}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleAssignBay(null)} disabled={assigningBay}>
                    <Text style={styles.unassignText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* No bay prompt */}
            {!booking.station_id && !showBaySelector && (
              <TouchableOpacity style={styles.selectBayPrompt} onPress={() => setShowBaySelector(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.selectBayPromptText}>Select a bay for this vehicle</Text>
              </TouchableOpacity>
            )}

            {/* Bay grid selector */}
            {showBaySelector && (
              <View style={styles.bayGrid}>
                {stations.length === 0 ? (
                  <View style={styles.noBaysWrap}>
                    <Text style={styles.noBaysText}>No bays set up. Add bays in Workshop Profile → Repair Stations.</Text>
                  </View>
                ) : (
                  stations.map((station) => {
                    const occupied = occupiedStationIds.has(station._id);
                    const isCurrent = booking.station_id === station._id;
                    return (
                      <TouchableOpacity
                        key={station._id}
                        style={[
                          styles.bayTile,
                          isCurrent && styles.bayTileCurrent,
                          occupied && styles.bayTileOccupied,
                        ]}
                        onPress={() => !occupied && handleAssignBay(station._id)}
                        disabled={occupied || assigningBay}
                        activeOpacity={occupied ? 1 : 0.7}
                      >
                        <Ionicons
                          name={occupied ? 'car' : isCurrent ? 'checkmark-circle' : 'car-outline'}
                          size={22}
                          color={isCurrent ? colors.success : occupied ? colors.textLight : colors.primary}
                        />
                        <Text style={[
                          styles.bayTileName,
                          isCurrent && styles.bayTileNameCurrent,
                          occupied && styles.bayTileNameOccupied,
                        ]} numberOfLines={2}>
                          {station.name}
                        </Text>
                        <Text style={[styles.bayTileStatus, occupied && styles.bayTileStatusOccupied]}>
                          {isCurrent ? 'This car' : occupied ? 'Occupied' : 'Available'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
                {assigningBay && (
                  <View style={styles.bayLoadingOverlay}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
                {(stations.length > 0 || booking.station_id) && (
                  <TouchableOpacity style={styles.cancelBayBtn} onPress={() => setShowBaySelector(false)}>
                    <Text style={styles.cancelBayText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Card>
        )}

        {/* Mechanic assignment — shown when confirmed or in_progress */}
        {['confirmed', 'in_progress', 'pending'].includes(booking.status) && (
          <Card style={styles.bayCard}>
            <View style={styles.bayHeader}>
              <Ionicons name="person-outline" size={16} color={colors.secondary} />
              <Text style={styles.bayTitle}>Assigned Mechanic</Text>
              {(booking as any).mechanic_id && !showMechanicSelector && (
                <TouchableOpacity onPress={() => setShowMechanicSelector(true)} style={styles.changeBayBtn}>
                  <Text style={styles.changeBayText}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {(booking as any).mechanic_id && !showMechanicSelector && (
              <View style={styles.assignedBayRow}>
                <View style={styles.assignedBayChip}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.assignedBayName}>{(booking as any).mechanic_name || (booking as any).mechanic_id}</Text>
                </View>
                <TouchableOpacity onPress={() => handleAssignMechanic(null)} disabled={assigningMechanic}>
                  <Text style={styles.unassignText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            {!(booking as any).mechanic_id && !showMechanicSelector && (
              <TouchableOpacity style={styles.selectBayPrompt} onPress={() => setShowMechanicSelector(true)}>
                <Ionicons name="person-add-outline" size={18} color={colors.secondary} />
                <Text style={[styles.selectBayPromptText, { color: colors.secondary }]}>Assign a mechanic</Text>
              </TouchableOpacity>
            )}

            {showMechanicSelector && (
              <View style={styles.bayGrid}>
                {mechanics.length === 0 ? (
                  <View style={styles.noBaysWrap}>
                    <Text style={styles.noBaysText}>No mechanics added yet. Go to Workshop Management → Mechanics.</Text>
                  </View>
                ) : (
                  mechanics.map((m) => {
                    const isCurrent = (booking as any).mechanic_id === m._id;
                    return (
                      <TouchableOpacity
                        key={m._id}
                        style={[styles.bayTile, isCurrent && styles.bayTileCurrent]}
                        onPress={() => handleAssignMechanic(m._id)}
                        disabled={assigningMechanic}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person" size={22} color={isCurrent ? colors.success : colors.secondary} />
                        <Text style={[styles.bayTileName, isCurrent && styles.bayTileNameCurrent]} numberOfLines={2}>{m.name}</Text>
                        <Text style={styles.bayTileStatus}>{m.specialty || 'Mechanic'}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
                {assigningMechanic && (
                  <View style={styles.bayLoadingOverlay}>
                    <ActivityIndicator color={colors.secondary} />
                  </View>
                )}
                <TouchableOpacity style={styles.cancelBayBtn} onPress={() => setShowMechanicSelector(false)}>
                  <Text style={styles.cancelBayText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* Completion report — read-only */}
        {booking.status === 'completed' && (hasServiceReports || booking.completion_notes) && (
          <Card style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.sectionTitle, { color: colors.success, marginBottom: 0 }]}>Service Report</Text>
            </View>

            {hasServiceReports && booking.service_reports.map((sr: any, idx: number) => (
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
                        <View key={url} style={[styles.videoThumb, { width: 72, height: 72 }]}>
                          <Ionicons name="videocam" size={20} color="#fff" />
                        </View>
                      ) : (
                        <Image key={url} source={{ uri: uploadAPI.mediaUrl(url) }} style={styles.imageThumbnail} resizeMode="cover" />
                      );
                    })}
                  </View>
                )}
                {sr.products_used && sr.products_used.length > 0 && (
                  <View style={styles.puReadSection}>
                    <Text style={styles.reportLabel}>Products Used</Text>
                    {sr.products_used.map((pu: any) => (
                      <View key={pu.product_id} style={styles.puReadRow}>
                        <Ionicons name="cube-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.puReadText}>
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
                      Next service in {nextServiceLabel(sr.next_service_months)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}

            {booking.completion_notes ? (
              <>
                <Text style={[styles.reportLabel, { marginTop: hasServiceReports ? 12 : 0 }]}>General Report</Text>
                <Text style={styles.reportText}>{booking.completion_notes}</Text>
              </>
            ) : null}

            {booking.next_service_months && !hasServiceReports && (
              <View style={[styles.nextServiceChip, { marginTop: 12 }]}>
                <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                <Text style={styles.nextServiceChipText}>
                  Next service in {nextServiceLabel(booking.next_service_months)}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Completion form */}
        {showCompleteForm && booking.status === 'in_progress' && (
          <Card style={styles.section}>
            <View style={styles.reportHeader}>
              <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 0 }]}>Completion Report</Text>
            </View>

            {/* Per-service cards */}
            {serviceReports.map((sr, idx) => (
              <View key={sr.service_id} style={styles.svcFormCard}>
                <View style={styles.svcFormHeader}>
                  <Ionicons name="construct-outline" size={14} color={colors.primary} />
                  <Text style={styles.svcFormName}>{sr.service_name}</Text>
                </View>

                <Text style={styles.formLabel}>Work Done</Text>
                <TextInput
                  value={sr.work_done}
                  onChangeText={(v) => updateServiceReport(idx, 'work_done', v)}
                  placeholder="What was done for this service..."
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>{sr.work_done.length}/500</Text>

                <Text style={[styles.formLabel, { marginTop: 10 }]}>Next Service Recommendation</Text>
                <View style={styles.optionsGrid}>
                  {NEXT_SERVICE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionChip, sr.next_service_months === opt.value && styles.optionChipActive]}
                      onPress={() => updateServiceReport(idx, 'next_service_months', sr.next_service_months === opt.value ? null : opt.value)}
                    >
                      <Text style={[styles.optionText, sr.next_service_months === opt.value && styles.optionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Products used */}
                <Text style={[styles.formLabel, { marginTop: 12 }]}>Products Used</Text>
                {sr.products_used.map((pu) => (
                  <View key={pu.product_id} style={styles.puRow}>
                    <View style={styles.puInfo}>
                      <Text style={styles.puName}>{pu.product_name}</Text>
                      {pu.brand ? <Text style={styles.puBrand}>{pu.brand}</Text> : null}
                    </View>
                    <TextInput
                      style={styles.puQtyInput}
                      value={pu.quantity}
                      onChangeText={(v) => updateProductQty(idx, pu.product_id, v)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Text style={styles.puUnit}>{pu.unit}</Text>
                    <TouchableOpacity onPress={() => removeProductFromReport(idx, pu.product_id)}>
                      <Ionicons name="close-circle" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addProductBtn} onPress={() => {
                  const svcName = serviceReports[idx]?.service_name;
                  const hasSuggested = svcName ? inventoryProducts.some((p) => (p.service_tags || []).includes(svcName)) : false;
                  setProductPickerIdx(idx);
                  setProductSearch('');
                  setProductFilter(hasSuggested ? 'suggested' : 'all');
                }}>
                  <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.addProductBtnText}>Add Product</Text>
                </TouchableOpacity>

                {/* Media upload */}
                <Text style={[styles.formLabel, { marginTop: 12 }]}>Photos / Videos</Text>
                <View style={styles.mediaRow}>
                  {sr.media.map((url) => {
                    const isVideo = url.match(/\.(mp4|mov|webm|avi)$/i);
                    return (
                      <View key={url} style={styles.mediaThumbnailWrap}>
                        {isVideo ? (
                          <View style={styles.videoThumb}>
                            <Ionicons name="videocam" size={22} color="#fff" />
                          </View>
                        ) : (
                          <Image source={{ uri: uploadAPI.mediaUrl(url) }} style={styles.imageThumbnail} resizeMode="cover" />
                        )}
                        <TouchableOpacity style={styles.removeMedia} onPress={() => removeMedia(idx, url)}>
                          <Ionicons name="close-circle" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {sr.uploading ? (
                    <View style={styles.uploadingThumb}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addMediaBtn} onPress={() => pickMedia(idx)}>
                      <Ionicons name="camera-outline" size={20} color={colors.primary} />
                      <Text style={styles.addMediaText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* General / overall notes */}
            <View style={styles.svcFormCard}>
              <View style={styles.svcFormHeader}>
                <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.svcFormName, { color: colors.textSecondary }]}>General Report</Text>
              </View>
              <TextInput
                value={generalNotes}
                onChangeText={setGeneralNotes}
                placeholder="Overall observations, recommendations, or notes for the customer..."
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={4}
                style={styles.textArea}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.charCount}>{generalNotes.length}/1000</Text>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelFormBtn} onPress={() => setShowCompleteForm(false)}>
                <Text style={styles.cancelFormText}>Cancel</Text>
              </TouchableOpacity>
              <Button
                title="Submit & Complete"
                onPress={handleCompleteSubmit}
                loading={updating === 'completed'}
                style={styles.submitBtn}
              />
            </View>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {booking.status === 'pending' && (
            <>
              <Button
                title="Confirm Booking"
                onPress={handleConfirm}
                fullWidth
                size="lg"
                loading={updating === 'confirmed'}
                style={styles.actionBtn}
              />
              <Button
                title="Reject"
                onPress={handleReject}
                variant="danger"
                fullWidth
                size="lg"
                loading={updating === 'rejected'}
              />
            </>
          )}
          {booking.status === 'confirmed' && (
            <Button
              title="Start Service"
              onPress={handleStart}
              fullWidth
              size="lg"
              loading={updating === 'in_progress'}
            />
          )}
          {booking.status === 'in_progress' && !showCompleteForm && !!booking.station_id && (
            <Button
              title="Mark as Completed"
              onPress={() => setShowCompleteForm(true)}
              fullWidth
              size="lg"
              style={{ backgroundColor: colors.success }}
            />
          )}
          {booking.status === 'completed' && (
            <TouchableOpacity style={styles.invoiceBtn} onPress={handleDownloadInvoice} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color="#2563EB" />
              <Text style={styles.invoiceBtnText}>Download Invoice (PDF)</Text>
              <Ionicons name="download-outline" size={16} color="#2563EB" />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Product picker modal */}
      {productPickerIdx !== null && (
        <Modal visible animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Product</Text>
              <TouchableOpacity onPress={() => { setProductPickerIdx(null); setProductSearch(''); setProductFilter('suggested'); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerSearchWrap}>
              <Ionicons name="search-outline" size={15} color={colors.textSecondary} />
              <TextInput
                style={styles.pickerSearchInput}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Search products..."
                placeholderTextColor={colors.textLight}
                autoFocus
              />
            </View>
            {/* Category filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerFilterScroll}
              contentContainerStyle={styles.pickerFilterList}
            >
              {PICKER_CATEGORIES.map((c) => {
                const count = c.key === 'suggested'
                  ? suggestedCount
                  : c.key === 'all'
                  ? inventoryProducts.length
                  : inventoryProducts.filter((p) => p.category === c.key).length;
                if (count === 0 && c.key !== 'all') return null;
                const active = productFilter === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.pickerChip, active && styles.pickerChipActive]}
                    onPress={() => setProductFilter(c.key)}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={13}
                      color={active ? '#fff' : colors.textSecondary}
                    />
                    <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>{c.label}</Text>
                    <View style={[styles.pickerBadge, active && styles.pickerBadgeActive]}>
                      <Text style={[styles.pickerBadgeText, active && styles.pickerBadgeTextActive]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.pickerResultCount}>{filteredInventory.length} product{filteredInventory.length !== 1 ? 's' : ''}</Text>
            <FlatList
              data={filteredInventory}
              keyExtractor={(p) => p._id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.pickerList}
              ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
              renderItem={({ item: prod }) => {
                const already = serviceReports[productPickerIdx]?.products_used.some((pu) => pu.product_id === prod._id);
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, already && { opacity: 0.45 }]}
                    onPress={() => !already && addProductToReport(productPickerIdx, prod)}
                    disabled={already}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{prod.name}</Text>
                      <Text style={styles.pickerMeta}>
                        {prod.brand ? `${prod.brand} · ` : ''}{prod.unit} · {prod.quantity} in stock · RM {prod.price.toFixed(2)}
                      </Text>
                    </View>
                    {already
                      ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      : <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    }
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ color: colors.textSecondary }}>No products found</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Insurance Claim Status Modal */}
      <Modal visible={showClaimStatusModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ ...Typography.h3, color: colors.text }}>Update Claim Status</Text>
              <TouchableOpacity onPress={() => setShowClaimStatusModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {(['submitted', 'processing', 'approved', 'rejected'] as const).map((status) => {
              const statusColors: Record<string, string> = { submitted: '#0EA5E9', processing: colors.warning, approved: colors.success, rejected: colors.danger };
              const labels: Record<string, string> = { submitted: 'Submitted', processing: 'In Processing', approved: 'Approved', rejected: 'Rejected' };
              const current = (booking as any)?.claim_status === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 10, backgroundColor: current ? statusColors[status] + '15' : colors.background, borderWidth: current ? 2 : 1, borderColor: current ? statusColors[status] : colors.border }}
                  onPress={() => handleUpdateClaimStatus(status)}
                  disabled={updatingClaimStatus || current}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColors[status], marginRight: 12 }} />
                  <Text style={{ ...Typography.body, color: current ? statusColors[status] : colors.text, fontWeight: current ? '700' : '400', flex: 1 }}>{labels[status]}</Text>
                  {current && <Ionicons name="checkmark-circle" size={20} color={statusColors[status]} />}
                  {updatingClaimStatus && !current && <ActivityIndicator size="small" color={statusColors[status]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#2563EB', borderRadius: BorderRadius.md,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
  },
  invoiceBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB', flex: 1, textAlign: 'center' },
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
  section: {},
  sectionTitle: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  bayStatusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary + '12', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  bayStatusName: { ...Typography.caption, color: colors.primary, fontWeight: '700' },
  customerName: { ...Typography.body, fontWeight: '600', color: colors.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { ...Typography.bodySmall, color: colors.textSecondary },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  serviceName: { ...Typography.bodySmall, color: colors.text },
  servicePrice: { ...Typography.bodySmall, color: colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  totalLabel: { ...Typography.body, color: colors.text, fontWeight: '600' },
  totalAmount: { ...Typography.body, color: colors.primary, fontWeight: '700' },
  notes: { ...Typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  actions: { gap: 10 },
  actionBtn: {},

  // Bay assignment
  bayCard: { gap: 10 },
  bayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bayTitle: {
    ...Typography.caption, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
  },
  changeBayBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.primary + '15', borderRadius: BorderRadius.full,
  },
  changeBayText: { ...Typography.caption, color: colors.primary, fontWeight: '600' },
  assignedBayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assignedBayChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success + '12', borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.success + '30',
  },
  assignedBayName: { ...Typography.body, fontWeight: '700', color: colors.success },
  unassignText: { ...Typography.caption, color: colors.danger, fontWeight: '600' },
  selectBayPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.primary + '50', borderStyle: 'dashed',
    borderRadius: BorderRadius.md, padding: 14,
    backgroundColor: colors.primary + '05',
  },
  selectBayPromptText: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },
  bayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, position: 'relative' },
  bayTile: {
    width: '30%', minWidth: 90,
    backgroundColor: colors.background, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    padding: 10, alignItems: 'center', gap: 4,
  },
  bayTileCurrent: { borderColor: colors.success, backgroundColor: colors.success + '08' },
  bayTileOccupied: { borderColor: colors.border, backgroundColor: colors.border + '40', opacity: 0.65 },
  bayTileName: { ...Typography.caption, fontWeight: '700', color: colors.text, textAlign: 'center' },
  bayTileNameCurrent: { color: colors.success },
  bayTileNameOccupied: { color: colors.textLight },
  bayTileStatus: { ...Typography.caption, color: colors.primary, fontSize: 10 },
  bayTileStatusOccupied: { color: colors.textLight },
  noBaysWrap: { padding: 12 },
  noBaysText: { ...Typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  bayLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface + 'cc',
  },
  cancelBayBtn: {
    width: '100%', paddingVertical: 10, alignItems: 'center',
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: colors.border,
    marginTop: 4,
  },
  cancelBayText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },

  // Read-only report
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
    marginTop: 8,
  },
  svcReportName: { ...Typography.bodySmall, fontWeight: '700', color: colors.text, marginBottom: 4 },
  nextServiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  nextServiceChipText: { ...Typography.caption, fontWeight: '600', color: colors.primary },

  // Completion form
  svcFormCard: {
    backgroundColor: colors.background,
    borderRadius: BorderRadius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    gap: 4,
  },
  svcFormHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  svcFormName: { ...Typography.bodySmall, fontWeight: '700', color: colors.primary },
  formLabel: { ...Typography.bodySmall, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 4 },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 10,
    ...Typography.bodySmall,
    color: colors.text,
    minHeight: 80,
  },
  charCount: { ...Typography.caption, color: colors.textLight, textAlign: 'right', marginTop: 3 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { ...Typography.caption, fontWeight: '600', color: colors.textSecondary },
  optionTextActive: { color: '#fff' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  mediaThumbnailWrap: { position: 'relative' },
  imageThumbnail: { width: 72, height: 72, borderRadius: BorderRadius.sm, backgroundColor: colors.border },
  videoThumb: {
    width: 72, height: 72, borderRadius: BorderRadius.sm,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  removeMedia: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: colors.surface, borderRadius: 10,
  },
  uploadingThumb: {
    width: 72, height: 72, borderRadius: BorderRadius.sm,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addMediaBtn: {
    width: 72, height: 72, borderRadius: BorderRadius.sm,
    borderWidth: 1.5, borderColor: colors.primary + '60',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary + '08', gap: 4,
  },
  addMediaText: { ...Typography.caption, color: colors.primary, fontWeight: '600' },

  // Products used in form
  puRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: colors.border, padding: 8, marginBottom: 6,
  },
  puInfo: { flex: 1 },
  puName: { ...Typography.caption, fontWeight: '600', color: colors.text },
  puBrand: { ...Typography.caption, color: colors.textSecondary, fontSize: 10 },
  puQtyInput: {
    width: 48, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 4,
    ...Typography.caption, color: colors.text, textAlign: 'center',
    backgroundColor: colors.background,
  },
  puUnit: { ...Typography.caption, color: colors.textSecondary, minWidth: 26 },
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1.5, borderColor: colors.primary + '50', borderStyle: 'dashed',
    borderRadius: BorderRadius.sm, padding: 9, backgroundColor: colors.primary + '05',
    marginTop: 4,
  },
  addProductBtnText: { ...Typography.caption, color: colors.primary, fontWeight: '600' },

  // Products used read-only
  puReadSection: { marginTop: 6, gap: 4 },
  puReadRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  puReadText: { ...Typography.caption, color: colors.textSecondary, flex: 1 },

  // Product picker modal
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  pickerTitle: { ...Typography.h3, color: colors.text },
  pickerSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  pickerSearchInput: { flex: 1, ...Typography.bodySmall, color: colors.text },
  pickerFilterScroll: { maxHeight: 48, flexGrow: 0, flexShrink: 0 },
  pickerFilterList: { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center', paddingVertical: 4, flexDirection: 'row', flexWrap: 'nowrap' },
  pickerChip: {
    flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  pickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerChipText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  pickerChipTextActive: { color: '#fff' },
  pickerBadge: {
    backgroundColor: colors.border, borderRadius: 8, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  pickerBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  pickerBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  pickerBadgeTextActive: { color: '#fff' },
  pickerResultCount: { ...Typography.caption, color: colors.textSecondary, paddingHorizontal: Spacing.lg, marginVertical: 6, flexShrink: 0 },
  pickerList: { paddingHorizontal: Spacing.md, paddingBottom: 32, paddingTop: 4 },
  pickerSeparator: { height: 8 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10,
  },
  pickerName: { ...Typography.bodySmall, fontWeight: '600', color: colors.text },
  pickerMeta: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },

  formActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelFormText: { ...Typography.button, color: colors.textSecondary },
  submitBtn: { flex: 2 },
  });
}
