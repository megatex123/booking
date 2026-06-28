import React, { useEffect, useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { workshopAPI } from '../../services/api';
import { showAlert, showConfirm } from '../../utils/webAlert';

interface Props {
  navigation: any;
}

interface Promo {
  id: string;
  title: string;
  description: string;
  ends_at: string;
  is_active: boolean;
  is_expired: boolean;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  created_at: string;
}

const MIN_ENDS_AT = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
};

export const WorkshopPromotionsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await workshopAPI.getPromotions();
      setPromos(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setEndsAt(MIN_ENDS_AT());
    setDiscountType(null);
    setDiscountValue('');
    setShowModal(true);
  };

  const openEdit = (p: Promo) => {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description);
    setEndsAt(p.ends_at.slice(0, 16));
    setDiscountType(p.discount_type);
    setDiscountValue(p.discount_value != null ? String(p.discount_value) : '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { showAlert('Missing Info', 'Please enter a promotion title.'); return; }
    if (!endsAt) { showAlert('Missing Info', 'Please set an end date/time.'); return; }
    setSaving(true);
    try {
      const payload: any = { title: title.trim(), description: description.trim(), ends_at: endsAt };
      if (discountType) {
        payload.discount_type = discountType;
        payload.discount_value = discountValue ? parseFloat(discountValue) : null;
      } else {
        payload.discount_type = null;
        payload.discount_value = null;
      }
      if (editingId) {
        await workshopAPI.updatePromotion(editingId, payload);
      } else {
        await workshopAPI.createPromotion(payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to save promotion.');
    }
    setSaving(false);
  };

  const handleToggle = async (p: Promo) => {
    try {
      await workshopAPI.updatePromotion(p.id, { is_active: !p.is_active });
      await load();
    } catch {}
  };

  const handleDelete = (p: Promo) => {
    showConfirm('Delete Promotion', `Remove "${p.title}"?`, async () => {
      try {
        await workshopAPI.deletePromotion(p.id);
        await load();
      } catch {}
    });
  };

  const active = promos.filter((p) => p.is_active && !p.is_expired);
  const inactive = promos.filter((p) => !p.is_active || p.is_expired);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotions & Flash Deals</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Info banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="flame" size={18} color="#F97316" />
              <Text style={styles.infoText}>Active deals appear as badges on your workshop card in the Explore screen.</Text>
            </View>

            {/* Active promotions */}
            <Text style={styles.groupTitle}>Active ({active.length})</Text>
            {active.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No active promotions. Tap + to create one.</Text>
              </View>
            ) : (
              active.map((p) => <PromoCard key={p.id} promo={p} onEdit={() => openEdit(p)} onToggle={() => handleToggle(p)} onDelete={() => handleDelete(p)} />)
            )}

            {/* Past / inactive */}
            {inactive.length > 0 && (
              <>
                <Text style={[styles.groupTitle, { marginTop: 20 }]}>Past / Inactive ({inactive.length})</Text>
                {inactive.map((p) => <PromoCard key={p.id} promo={p} onEdit={() => openEdit(p)} onToggle={() => handleToggle(p)} onDelete={() => handleDelete(p)} />)}
              </>
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingId ? 'Edit Promotion' : 'New Promotion'}</Text>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Free tyre rotation with oil change"
              placeholderTextColor={colors.textLight}
              maxLength={80}
            />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="More details about the offer, T&C, etc."
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Text style={styles.fieldLabel}>Ends at (date & time) *</Text>
            <TextInput
              style={styles.input}
              value={endsAt}
              onChangeText={setEndsAt}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={colors.textLight}
            />
            <Text style={styles.fieldHint}>Format: 2025-12-31T23:59</Text>

            <Text style={styles.fieldLabel}>Discount (optional)</Text>
            <View style={styles.discountTypeRow}>
              {([null, 'percentage', 'fixed'] as const).map((t) => (
                <TouchableOpacity
                  key={String(t)}
                  style={[styles.discountTypeBtn, discountType === t && styles.discountTypeBtnActive]}
                  onPress={() => { setDiscountType(t); if (!t) setDiscountValue(''); }}
                >
                  <Text style={[styles.discountTypeBtnText, discountType === t && styles.discountTypeBtnTextActive]}>
                    {t === null ? 'None' : t === 'percentage' ? '% Off' : 'RM Off'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {discountType !== null && (
              <TextInput
                style={styles.input}
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountType === 'percentage' ? 'e.g. 15  (means 15% off)' : 'e.g. 20  (means RM20 off)'}
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? 'Save Changes' : 'Create Promotion'}</Text>}
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const PromoCard: React.FC<{ promo: Promo; onEdit: () => void; onToggle: () => void; onDelete: () => void }> = ({ promo, onEdit, onToggle, onDelete }) => {
  const { colors } = useTheme();
  const cardStyles = useMemo(() => makePromoCardStyles(colors), [colors]);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[cardStyles.card, (promo.is_expired || !promo.is_active) && cardStyles.cardDim]}>
      <View style={cardStyles.top}>
        <Ionicons name="flame" size={16} color={promo.is_active && !promo.is_expired ? '#F97316' : colors.textLight} />
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.title} numberOfLines={2}>{promo.title}</Text>
          {promo.discount_type && promo.discount_value != null && (
            <View style={cardStyles.discountBadge}>
              <Text style={cardStyles.discountBadgeText}>
                {promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `RM${promo.discount_value.toFixed(0)} OFF`}
              </Text>
            </View>
          )}
        </View>
        <Switch
          value={promo.is_active && !promo.is_expired}
          onValueChange={onToggle}
          disabled={promo.is_expired}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {promo.description ? <Text style={cardStyles.desc} numberOfLines={2}>{promo.description}</Text> : null}
      <View style={cardStyles.footer}>
        <View style={cardStyles.expiry}>
          <Ionicons name="time-outline" size={13} color={promo.is_expired ? colors.danger : colors.textSecondary} />
          <Text style={[cardStyles.expiryText, promo.is_expired && { color: colors.danger }]}>
            {promo.is_expired ? 'Expired ' : 'Ends '}{fmtDate(promo.ends_at)}
          </Text>
        </View>
        <View style={cardStyles.actions}>
          <TouchableOpacity onPress={onEdit} style={cardStyles.actionBtn}>
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={cardStyles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  content: { padding: Spacing.lg },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F9731610', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#F9731630',
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  infoText: { ...Typography.bodySmall, color: colors.text, flex: 1, lineHeight: 20 },

  groupTitle: { ...Typography.h3, color: colors.text, marginBottom: 12 },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { ...Typography.bodySmall, color: colors.textSecondary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: 32,
  },
  sheetTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.lg },
  fieldLabel: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: 14, paddingVertical: 10,
    ...Typography.body, color: colors.text, backgroundColor: colors.background,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  fieldHint: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
  discountTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  discountTypeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.sm,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  discountTypeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  discountTypeBtnText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  discountTypeBtnTextActive: { color: colors.primary },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg,
  },
  saveBtnText: { ...Typography.button, color: '#fff' },
  });
}

function makePromoCardStyles(colors: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: BorderRadius.md,
      padding: Spacing.md, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    cardDim: { opacity: 0.65 },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
    title: { ...Typography.body, fontWeight: '700', color: colors.text, flex: 1 },
    desc: { ...Typography.caption, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    expiry: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    expiryText: { ...Typography.caption, color: colors.textSecondary },
    discountBadge: {
      alignSelf: 'flex-start', marginTop: 4,
      backgroundColor: '#F97316', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    },
    discountBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    actions: { flexDirection: 'row', gap: 4 },
    actionBtn: { padding: 6 },
  });
}
