import React, { useEffect, useRef, useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, TextInput,
  Image, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMyWorkshop, updateMyWorkshop } from '../../store/workshopSlice';
import { workshopAPI, uploadAPI } from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { PHOTO_CATEGORY_LABELS, WorkshopImage } from '../../types';

const PHOTO_CATEGORIES = Object.keys(PHOTO_CATEGORY_LABELS) as string[];

interface Props { navigation: any }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WorkshopProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { myWorkshop } = useAppSelector((s) => s.workshops);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [openHour, setOpenHour] = useState('08:00');
  const [closeHour, setCloseHour] = useState('18:00');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Photo gallery state
  const [photos, setPhotos] = useState<WorkshopImage[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('other');
  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    dispatch(fetchMyWorkshop());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'locationPick') {
        setLatitude(e.data.lat.toFixed(6));
        setLongitude(e.data.lng.toFixed(6));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (myWorkshop) {
      setName(myWorkshop.workshop_name || '');
      setAddress(myWorkshop.address || '');
      setPhone(myWorkshop.phone || '');
      setDescription(myWorkshop.description || '');
      setIsOpen(myWorkshop.is_open ?? true);
      setOpenHour(myWorkshop.open_hour || '08:00');
      setCloseHour(myWorkshop.close_hour || '18:00');
      if (myWorkshop.latitude) setLatitude(String(myWorkshop.latitude));
      if (myWorkshop.longitude) setLongitude(String(myWorkshop.longitude));
      setPhotos((myWorkshop as any).images || []);
    }
  }, [myWorkshop]);

  const handlePickPhoto = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: any) => {
    const file: File = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      const url = await uploadAPI.uploadFile(objectUrl, file.type, file.name);
      setPendingUploadUrl(url);
      setSelectedCategory('other');
      setPendingCaption('');
      setShowCatPicker(true);
    } catch (err: any) {
      showAlert('Upload failed', err.message || 'Could not upload image');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmAddPhoto = async () => {
    if (!pendingUploadUrl) return;
    const newPhoto: WorkshopImage = { url: pendingUploadUrl, category: selectedCategory, caption: pendingCaption };
    const updated = [...photos, newPhoto];
    setPhotos(updated);
    setShowCatPicker(false);
    setPendingUploadUrl(null);
    try {
      await workshopAPI.updateMyWorkshop({ images: updated });
    } catch { showAlert('Error', 'Could not save photo'); }
  };

  const handleRemovePhoto = async (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    try {
      await workshopAPI.updateMyWorkshop({ images: updated });
    } catch { showAlert('Error', 'Could not remove photo'); }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Workshop name is required';
    if (!address.trim()) e.address = 'Address is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const geocodeAddress = async () => {
    if (!address.trim()) { showAlert('Enter address first', 'Please fill in the address field before detecting location.'); return; }
    setGeocoding(true);
    try {
      const q = encodeURIComponent(address.trim());
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'BengkilLah/1.0' },
      });
      const data = await res.json();
      if (data.length > 0) {
        setLatitude(parseFloat(data[0].lat).toFixed(6));
        setLongitude(parseFloat(data[0].lon).toFixed(6));
        showAlert('Location Found', `${data[0].display_name.split(',').slice(0, 2).join(',')}`);
      } else {
        showAlert('Not Found', 'Could not find location for this address. Try a more specific address or set coordinates manually.');
      }
    } catch {
      showAlert('Error', 'Could not detect location. Check your internet connection.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    try {
      const res = await workshopAPI.updateMyWorkshop({
        workshop_name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        description: description.trim(),
        is_open: isOpen,
        open_hour: openHour,
        close_hour: closeHour,
        ...(latitude && longitude && !isNaN(lat) && !isNaN(lng) ? { latitude: lat, longitude: lng } : {}),
      });
      dispatch(updateMyWorkshop(res.data));
      showAlert('Saved', 'Workshop profile updated successfully');
      navigation.goBack();
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workshop Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Open / Closed toggle */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
              <View>
                <Text style={styles.statusTitle}>
                  Workshop is {isOpen ? 'Open' : 'Closed'}
                </Text>
                <Text style={styles.statusSub}>
                  {isOpen ? 'Customers can book your services' : 'No new bookings will be accepted'}
                </Text>
              </View>
            </View>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ false: colors.border, true: colors.success + '60' }}
              thumbColor={isOpen ? colors.success : colors.textLight}
            />
          </View>
        </Card>

        {/* Workshop details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Workshop Details</Text>
          <Input
            label="Workshop Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Hafiz Auto Workshop"
            error={errors.name}
          />
          <Input
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Full address"
            error={errors.address}
          />
          <Input
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+601X-XXXXXXXX"
            keyboardType="phone-pad"
          />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Tell customers about your workshop..."
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Location */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Workshop Location</Text>

          {/* Interactive pick-on-map */}
          {(() => {
            const lat = parseFloat(latitude) || 3.139;
            const lng = parseFloat(longitude) || 101.6869;
            const hasPin = !!latitude && !!longitude;
            const IFrame = 'iframe' as any;
            const mapHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
.hint{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(0,0,0,.65);color:#fff;font-size:11px;font-family:sans-serif;padding:4px 10px;border-radius:12px;pointer-events:none;white-space:nowrap}
</style></head>
<body>
<div class="hint">Tap map to set workshop location</div>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:true}).setView([${lat},${lng}],${hasPin ? 15 : 12});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
var pinIcon=L.divIcon({className:'',html:'<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#1E8BC3;border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',iconSize:[32,32],iconAnchor:[16,32]});
${hasPin ? `var marker=L.marker([${lat},${lng}],{icon:pinIcon,draggable:true}).addTo(map);
marker.on('dragend',function(e){var p=e.target.getLatLng();window.parent.postMessage({type:'locationPick',lat:p.lat,lng:p.lng},'*');});` : 'var marker=null;'}
map.on('click',function(e){
  if(marker){map.removeLayer(marker);}
  marker=L.marker([e.latlng.lat,e.latlng.lng],{icon:pinIcon,draggable:true}).addTo(map);
  marker.on('dragend',function(ev){var p=ev.target.getLatLng();window.parent.postMessage({type:'locationPick',lat:p.lat,lng:p.lng},'*');});
  window.parent.postMessage({type:'locationPick',lat:e.latlng.lat,lng:e.latlng.lng},'*');
});
</script></body></html>`;
            return (
              <View style={styles.mapPickerWrap}>
                <IFrame
                  srcDoc={mapHtml}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                />
              </View>
            );
          })()}

          <Text style={styles.locationHint}>
            Tap the map to pin your workshop, or use "Detect from Address" below.
          </Text>

          {/* Detect from address */}
          <TouchableOpacity
            style={[styles.geocodeBtn, geocoding && { opacity: 0.6 }]}
            onPress={geocodeAddress}
            disabled={geocoding}
            activeOpacity={0.8}
          >
            <Ionicons name="search-outline" size={16} color={colors.primary} />
            <Text style={styles.geocodeBtnText}>
              {geocoding ? 'Detecting...' : 'Detect from Address'}
            </Text>
          </TouchableOpacity>

          {/* Manual lat/lng */}
          <View style={styles.coordRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <TextInput
                style={styles.coordInput}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="e.g. 3.1390"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <TextInput
                style={styles.coordInput}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="e.g. 101.6869"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {latitude && longitude && (
            <View style={styles.coordBadge}>
              <Ionicons name="location" size={14} color={colors.success} />
              <Text style={styles.coordBadgeText}>
                {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
              </Text>
            </View>
          )}
        </Card>

        {/* Operating hours */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          <View style={styles.hoursRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Open From"
                value={openHour}
                onChangeText={setOpenHour}
                placeholder="08:00"
              />
            </View>
            <View style={styles.hoursDash}>
              <Text style={styles.hoursDashText}>—</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Close At"
                value={closeHour}
                onChangeText={setCloseHour}
                placeholder="18:00"
              />
            </View>
          </View>

          {/* Working days display */}
          <Text style={styles.daysLabel}>Working Days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day) => (
              <View key={day} style={styles.dayChip}>
                <Text style={styles.dayText}>{day.slice(0, 3)}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Stats summary */}
        {myWorkshop && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Workshop Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{myWorkshop.rating.toFixed(1)}</Text>
                <View style={styles.statStar}>
                  <Ionicons name="star" size={12} color="#FBBC04" />
                </View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{myWorkshop.total_reviews}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{myWorkshop.services?.length ?? 0}</Text>
                <Text style={styles.statLabel}>Services</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.reviewsBtn}
              onPress={() => navigation.navigate('WorkshopReviews')}
              activeOpacity={0.8}
            >
              <Ionicons name="star-outline" size={15} color={colors.primary} />
              <Text style={styles.reviewsBtnText}>View Customer Reviews</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </TouchableOpacity>
          </Card>
        )}

        {/* Photo Gallery */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Photo Gallery</Text>
          <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>
            Add categorised photos so customers can see your workshop, equipment, and team.
          </Text>

          {/* Hidden web file input */}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          )}

          {/* Existing photos grid */}
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((photo, idx) => (
                <View key={idx} style={styles.photoThumb}>
                  <Image source={{ uri: uploadAPI.getFullUrl(photo.url) }} style={styles.photoThumbImg} resizeMode="cover" />
                  <View style={styles.photoCatLabel}>
                    <Text style={styles.photoCatLabelText}>{PHOTO_CATEGORY_LABELS[photo.category] || photo.category}</Text>
                  </View>
                  <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => handleRemovePhoto(idx)}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.addPhotoBtn, uploadingPhoto && { opacity: 0.6 }]}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="camera-outline" size={18} color={colors.primary} />
            }
            <Text style={styles.addPhotoBtnText}>
              {uploadingPhoto ? 'Uploading...' : photos.length === 0 ? 'Add First Photo' : '+ Add Photo'}
            </Text>
          </TouchableOpacity>
        </Card>

        <Button
          title="Save Changes"
          onPress={handleSave}
          fullWidth
          size="lg"
          loading={saving}
          style={styles.saveBtn}
        />
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Category picker modal */}
      <Modal visible={showCatPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Photo Category</Text>
            {pendingUploadUrl && (
              <Image
                source={{ uri: uploadAPI.getFullUrl(pendingUploadUrl) }}
                style={styles.modalPreview}
                resizeMode="cover"
              />
            )}
            <View style={styles.catGrid}>
              {PHOTO_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catOption, selectedCategory === cat && styles.catOptionActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.catOptionText, selectedCategory === cat && { color: '#fff' }]}>
                    {PHOTO_CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.captionInput}
              value={pendingCaption}
              onChangeText={setPendingCaption}
              placeholder="Caption (optional)"
              placeholderTextColor={colors.textLight}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCatPicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmAddPhoto}>
                <Text style={styles.modalConfirmText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
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
  content: { padding: Spacing.lg, gap: 16 },

  statusCard: { padding: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dotOpen: { backgroundColor: colors.success },
  dotClosed: { backgroundColor: colors.danger },
  statusTitle: { ...Typography.body, fontWeight: '600', color: colors.text },
  statusSub: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },

  section: { gap: 12 },
  sectionTitle: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  hoursRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  hoursDash: { paddingBottom: 16, alignItems: 'center' },
  hoursDashText: { ...Typography.h3, color: colors.textLight },

  daysLabel: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 8 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  dayText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { ...Typography.h2, color: colors.primary },
  statStar: { marginTop: -4 },
  statLabel: { ...Typography.caption, color: colors.textSecondary },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },

  saveBtn: { marginTop: 4 },

  mapPickerWrap: {
    height: 220,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  locationHint: {
    ...Typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  geocodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    marginBottom: 12,
  },
  geocodeBtnText: { ...Typography.button, color: colors.primary, fontSize: 13 },
  coordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  coordLabel: { ...Typography.caption, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' },
  coordInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    ...Typography.bodySmall,
    color: colors.text,
  },
  coordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.success + '12',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  coordBadgeText: { ...Typography.caption, color: colors.success, fontWeight: '600' },

  reviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewsBtnText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },

  // Photo gallery
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photoThumb: { width: '31%', aspectRatio: 1, borderRadius: BorderRadius.sm, overflow: 'hidden', position: 'relative' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoCatLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 3, paddingHorizontal: 5,
  },
  photoCatLabelText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  photoDeleteBtn: { position: 'absolute', top: 4, right: 4 },
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    backgroundColor: colors.primary + '05',
  },
  addPhotoBtnText: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },

  // Category picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: 40,
  },
  modalTitle: { ...Typography.h3, color: colors.text, textAlign: 'center', marginBottom: 14 },
  modalPreview: { width: '100%', height: 140, borderRadius: BorderRadius.md, marginBottom: 14 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  catOption: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
  },
  catOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catOptionText: { ...Typography.caption, color: colors.text, fontWeight: '600' },
  captionInput: {
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 10,
    ...Typography.body, color: colors.text, marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  modalCancelText: { ...Typography.button, color: colors.textSecondary },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: BorderRadius.md,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  modalConfirmText: { ...Typography.button, color: '#fff' },
  });
}
