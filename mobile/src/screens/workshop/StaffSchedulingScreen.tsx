import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { workshopAPI, scheduleAPI } from '../../services/api';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { showAlert, showConfirm } from '../../utils/webAlert';

/* ─── Types ────────────────────────────────────────────────────────── */
interface Mechanic {
  _id: string; name: string; specialty?: string; phone?: string; is_active?: boolean;
}
interface Shift {
  id: string; mechanic_id: string; mechanic_name: string; mechanic_specialty: string;
  date: string; shift: string; shift_start: string | null; shift_end: string | null;
  status: string; notes?: string | null;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
const SHIFTS = [
  { key: 'morning',   label: 'Morning',   time: '8:00 AM – 1:00 PM',  color: '#F59E0B' },
  { key: 'afternoon', label: 'Afternoon', time: '1:00 PM – 6:00 PM',  color: '#3B82F6' },
  { key: 'evening',   label: 'Evening',   time: '6:00 PM – 10:00 PM', color: '#8B5CF6' },
  { key: 'full_day',  label: 'Full Day',  time: '8:00 AM – 6:00 PM',  color: '#10B981' },
  { key: 'off',       label: 'Day Off',   time: 'Not working',         color: '#6B7280' },
];

const STATUSES = [
  { key: 'scheduled', label: 'Scheduled', color: '#3B82F6' },
  { key: 'on_duty',   label: 'On Duty',   color: '#10B981' },
  { key: 'completed', label: 'Completed', color: '#6B7280' },
  { key: 'absent',    label: 'Absent',    color: '#EF4444' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function shiftInfo(key: string) { return SHIFTS.find((s) => s.key === key) ?? SHIFTS[0]; }
function statusInfo(key: string) { return STATUSES.find((s) => s.key === key) ?? STATUSES[0]; }

function isoDate(d: Date): string { return d.toISOString().split('T')[0]; }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay()); // Sunday
  return r;
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
interface Props { navigation: any }

export const StaffSchedulingScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Week navigation: anchor to Monday of selected week
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => isoDate(new Date()));

  // Week days array (7 days starting from weekAnchor)
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekAnchor, i);
      return { iso: isoDate(d), day: DAY_LABELS[d.getDay()], num: d.getDate(), month: MONTH_NAMES[d.getMonth()] };
    }), [weekAnchor]);

  const weekFrom = weekDays[0].iso;
  const weekTo   = weekDays[6].iso;
  const todayIso = isoDate(new Date());

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selMechId, setSelMechId] = useState('');
  const [selShift, setSelShift] = useState('full_day');
  const [selStatus, setSelStatus] = useState('scheduled');
  const [shiftNotes, setShiftNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Today on-duty panel
  const [showOnDuty, setShowOnDuty] = useState(selectedDay === todayIso);
  const [onDuty, setOnDuty] = useState<Shift[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mechRes, shiftRes] = await Promise.all([
        workshopAPI.getMechanics(),
        scheduleAPI.list({ date_from: weekFrom, date_to: weekTo }),
      ]);
      setMechanics(mechRes.data.filter((m: Mechanic) => m.is_active !== false));
      setShifts(shiftRes.data);
    } catch {}
    setLoading(false);
  }, [weekFrom, weekTo]);

  const loadOnDuty = useCallback(async () => {
    try {
      const res = await scheduleAPI.today();
      setOnDuty(res.data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (selectedDay === todayIso) loadOnDuty();
  }, [selectedDay]);

  // Group shifts by date then mechanic
  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of shifts) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [shifts]);

  const dayShifts = shiftsByDate[selectedDay] ?? [];

  // Mechanics NOT yet rostered for selected day
  const unrosteredMechanics = useMemo(() =>
    mechanics.filter((m) => !dayShifts.some((s) => s.mechanic_id === m._id)),
    [mechanics, dayShifts]);

  /* ─── Modal helpers ─── */
  const openCreate = () => {
    setEditingShift(null);
    setSelMechId(unrosteredMechanics[0]?._id ?? '');
    setSelShift('full_day');
    setSelStatus('scheduled');
    setShiftNotes('');
    setModalVisible(true);
  };

  const openEdit = (s: Shift) => {
    setEditingShift(s);
    setSelMechId(s.mechanic_id);
    setSelShift(s.shift);
    setSelStatus(s.status);
    setShiftNotes(s.notes ?? '');
    setModalVisible(true);
  };

  const closeModal = () => { setModalVisible(false); setEditingShift(null); };

  const save = async () => {
    if (!selMechId) { showAlert('Select a mechanic first.'); return; }
    setSaving(true);
    try {
      if (editingShift) {
        const res = await scheduleAPI.update(editingShift.id, { shift: selShift, status: selStatus, notes: shiftNotes });
        setShifts((prev) => prev.map((s) => s.id === editingShift.id ? res.data : s));
        if (selectedDay === todayIso) setOnDuty((prev) => prev.map((s) => s.id === editingShift.id ? res.data : s));
      } else {
        const res = await scheduleAPI.create({ mechanic_id: selMechId, date: selectedDay, shift: selShift, status: selStatus, notes: shiftNotes || undefined });
        setShifts((prev) => [...prev, res.data]);
        if (selectedDay === todayIso && selShift !== 'off') setOnDuty((prev) => [...prev, res.data]);
      }
      closeModal();
    } catch (e: any) {
      showAlert(e?.response?.data?.detail ?? 'Failed to save shift.');
    }
    setSaving(false);
  };

  const removeShift = async (id: string) => {
    const ok = await showConfirm('Remove Shift', 'Remove this roster entry?');
    if (!ok) return;
    try {
      await scheduleAPI.remove(id);
      setShifts((prev) => prev.filter((s) => s.id !== id));
      setOnDuty((prev) => prev.filter((s) => s.id !== id));
    } catch { showAlert('Failed to remove.'); }
  };

  const setStatusQuick = async (shift: Shift, status: string) => {
    try {
      const res = await scheduleAPI.update(shift.id, { status });
      setShifts((prev) => prev.map((s) => s.id === shift.id ? res.data : s));
      setOnDuty((prev) => prev.map((s) => s.id === shift.id ? res.data : s));
    } catch { showAlert('Failed to update status.'); }
  };

  /* ─── Weekly summary dots (for strip) ─── */
  function dotCount(iso: string) { return (shiftsByDate[iso] ?? []).filter((s) => s.shift !== 'off').length; }

  /* ─── Month/year label for header ─── */
  const headerMonth = (() => {
    const d = addDays(weekAnchor, 3); // mid-week
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  })();

  return (
    <SafeAreaView style={styles.container}>
      {/* ─ Header ─ */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Scheduling</Text>
        <TouchableOpacity onPress={openCreate} disabled={unrosteredMechanics.length === 0}>
          <Ionicons name="person-add-outline" size={22} color={unrosteredMechanics.length === 0 ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ─ Week navigation strip ─ */}
      <View style={[styles.weekNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekAnchor((w) => addDays(w, -7))}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={[styles.monthLabel, { color: colors.textSecondary }]}>{headerMonth}</Text>

        <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekAnchor((w) => addDays(w, 7))}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ─ Day strip ─ */}
      <View style={[styles.dayStrip, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {weekDays.map((d) => {
          const isSelected = d.iso === selectedDay;
          const isToday = d.iso === todayIso;
          const dots = dotCount(d.iso);
          return (
            <TouchableOpacity
              key={d.iso}
              style={[styles.dayCell, isSelected && { backgroundColor: colors.primary + '18' }]}
              onPress={() => { setSelectedDay(d.iso); setShowOnDuty(d.iso === todayIso); }}
            >
              <Text style={[styles.dayLbl, { color: isSelected ? colors.primary : colors.textSecondary }]}>{d.day}</Text>
              <View style={[
                styles.dayNumWrap,
                isSelected && { backgroundColor: colors.primary },
                isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.primary },
              ]}>
                <Text style={[styles.dayNum, { color: isSelected ? '#fff' : isToday ? colors.primary : colors.text }]}>{d.num}</Text>
              </View>
              {dots > 0 && (
                <View style={styles.dotsRow}>
                  {Array.from({ length: Math.min(dots, 4) }).map((_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: colors.primary }]} />
                  ))}
                </View>
              )}
              {dots === 0 && <View style={styles.dotsRow} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* ─ Today on-duty panel ─ */}
          {showOnDuty && (
            <View style={[styles.onDutyPanel, { backgroundColor: '#10B98110', borderColor: '#10B98140' }]}>
              <View style={styles.onDutyHeader}>
                <Ionicons name="radio-button-on" size={14} color="#10B981" />
                <Text style={[styles.onDutyTitle, { color: '#10B981' }]}>On Duty Today</Text>
                <Text style={[styles.onDutyCount, { color: '#10B981' }]}>{onDuty.filter((s) => s.status === 'on_duty').length} active</Text>
              </View>
              {onDuty.length === 0 ? (
                <Text style={[styles.onDutyEmpty, { color: colors.textSecondary }]}>No one clocked in yet.</Text>
              ) : (
                <View style={styles.onDutyList}>
                  {onDuty.map((s) => {
                    const st = statusInfo(s.status);
                    return (
                      <View key={s.id} style={styles.onDutyRow}>
                        <View style={[styles.onDutyAvatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.onDutyAvatarTxt, { color: colors.primary }]}>
                            {s.mechanic_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.onDutyName, { color: colors.text }]}>{s.mechanic_name}</Text>
                          <Text style={[styles.onDutySub, { color: colors.textSecondary }]}>
                            {shiftInfo(s.shift).label} · {s.shift_start}–{s.shift_end}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.statusChip, { backgroundColor: st.color + '18', borderColor: st.color + '40' }]}
                          onPress={() => {
                            const next = s.status === 'scheduled' ? 'on_duty' : s.status === 'on_duty' ? 'completed' : 'scheduled';
                            setStatusQuick(s, next);
                          }}
                        >
                          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                          <Text style={[styles.statusChipTxt, { color: st.color }]}>{st.label}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ─ Selected day roster ─ */}
          <View style={styles.rosterHeader}>
            <Text style={[styles.rosterTitle, { color: colors.text }]}>
              {selectedDay === todayIso ? "Today's Roster" : `Roster — ${weekDays.find((d) => d.iso === selectedDay)?.day} ${weekDays.find((d) => d.iso === selectedDay)?.num}`}
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary, opacity: unrosteredMechanics.length === 0 ? 0.4 : 1 }]}
              onPress={openCreate}
              disabled={unrosteredMechanics.length === 0}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {dayShifts.length === 0 ? (
            <View style={[styles.emptyDay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={36} color={colors.border} />
              <Text style={[styles.emptyDayTxt, { color: colors.textSecondary }]}>No staff rostered for this day</Text>
              <TouchableOpacity
                style={[styles.emptyAddBtn, { backgroundColor: colors.primary, opacity: unrosteredMechanics.length === 0 ? 0.4 : 1 }]}
                onPress={openCreate}
                disabled={unrosteredMechanics.length === 0}
              >
                <Ionicons name="person-add-outline" size={14} color="#fff" />
                <Text style={styles.addBtnText}>Assign Staff</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dayShifts.map((s) => {
              const sf = shiftInfo(s.shift);
              const st = statusInfo(s.status);
              return (
                <View key={s.id} style={[styles.shiftCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: sf.color, }]}>
                  <View style={styles.shiftTop}>
                    <View style={[styles.avatar, { backgroundColor: sf.color + '18' }]}>
                      <Text style={[styles.avatarTxt, { color: sf.color }]}>
                        {s.mechanic_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mechName, { color: colors.text }]}>{s.mechanic_name}</Text>
                      {s.mechanic_specialty ? (
                        <Text style={[styles.mechSpec, { color: colors.textSecondary }]}>{s.mechanic_specialty}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity style={styles.editIconBtn} onPress={() => openEdit(s)}>
                      <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editIconBtn} onPress={() => removeShift(s.id)}>
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {/* Shift badge + hours */}
                  <View style={styles.shiftMeta}>
                    <View style={[styles.shiftBadge, { backgroundColor: sf.color + '15', borderColor: sf.color + '40' }]}>
                      <Ionicons name="time-outline" size={11} color={sf.color} />
                      <Text style={[styles.shiftBadgeTxt, { color: sf.color }]}>{sf.label}</Text>
                    </View>
                    {s.shift !== 'off' && s.shift_start && (
                      <Text style={[styles.shiftHours, { color: colors.textSecondary }]}>{s.shift_start} – {s.shift_end}</Text>
                    )}
                  </View>

                  {/* Status row — tap to cycle */}
                  <View style={styles.statusRow}>
                    <TouchableOpacity
                      style={[styles.statusChip, { backgroundColor: st.color + '15', borderColor: st.color + '35' }]}
                      onPress={() => {
                        const next = s.status === 'scheduled' ? 'on_duty' : s.status === 'on_duty' ? 'completed' : s.status === 'completed' ? 'absent' : 'scheduled';
                        setStatusQuick(s, next);
                      }}
                    >
                      <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                      <Text style={[styles.statusChipTxt, { color: st.color }]}>{st.label}</Text>
                      <Ionicons name="swap-horizontal-outline" size={10} color={st.color} />
                    </TouchableOpacity>
                    {s.notes ? (
                      <Text style={[styles.noteTxt, { color: colors.textSecondary }]} numberOfLines={1}>📝 {s.notes}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          {/* ─ Unrostered mechanics for this day ─ */}
          {unrosteredMechanics.length > 0 && dayShifts.length > 0 && (
            <View style={[styles.unrosteredBox, { borderColor: colors.border }]}>
              <Text style={[styles.unrosteredTitle, { color: colors.textSecondary }]}>Not Rostered</Text>
              <View style={styles.unrosteredList}>
                {unrosteredMechanics.map((m) => (
                  <TouchableOpacity
                    key={m._id}
                    style={[styles.unrosteredChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      setEditingShift(null);
                      setSelMechId(m._id);
                      setSelShift('full_day');
                      setSelStatus('scheduled');
                      setShiftNotes('');
                      setModalVisible(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={13} color={colors.primary} />
                    <Text style={[styles.unrosteredName, { color: colors.text }]}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ─ Assignment Modal ─ */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalSheet, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingShift ? 'Edit Shift' : 'Assign Staff'}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {weekDays.find((d) => d.iso === selectedDay)?.day}{' '}
              {weekDays.find((d) => d.iso === selectedDay)?.num}{' '}
              {weekDays.find((d) => d.iso === selectedDay)?.month}
            </Text>

            {/* Mechanic picker */}
            {!editingShift && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mechanic</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {unrosteredMechanics.map((m) => (
                      <TouchableOpacity
                        key={m._id}
                        style={[styles.pickerChip,
                          selMechId === m._id
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: colors.background, borderColor: colors.border }
                        ]}
                        onPress={() => setSelMechId(m._id)}
                      >
                        <Text style={[styles.pickerChipTxt, { color: selMechId === m._id ? '#fff' : colors.text }]}>{m.name}</Text>
                        {m.specialty ? <Text style={[styles.pickerChipSub, { color: selMechId === m._id ? 'rgba(255,255,255,.7)' : colors.textSecondary }]}>{m.specialty}</Text> : null}
                      </TouchableOpacity>
                    ))}
                    {unrosteredMechanics.length === 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, alignSelf: 'center' }}>All mechanics rostered for this day.</Text>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
            {editingShift && (
              <View style={[styles.editingMechRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.editingMechName, { color: colors.text }]}>{editingShift.mechanic_name}</Text>
              </View>
            )}

            {/* Shift type */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Shift</Text>
            <View style={styles.shiftGrid}>
              {SHIFTS.map((sf) => (
                <TouchableOpacity
                  key={sf.key}
                  style={[styles.shiftOption,
                    selShift === sf.key
                      ? { backgroundColor: sf.color + '20', borderColor: sf.color }
                      : { backgroundColor: colors.background, borderColor: colors.border }
                  ]}
                  onPress={() => setSelShift(sf.key)}
                >
                  <Text style={[styles.shiftOptLabel, { color: selShift === sf.key ? sf.color : colors.text }]}>{sf.label}</Text>
                  <Text style={[styles.shiftOptTime, { color: selShift === sf.key ? sf.color + 'CC' : colors.textSecondary }]}>{sf.time}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Status */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {STATUSES.map((st) => (
                <TouchableOpacity
                  key={st.key}
                  style={[styles.statusOption,
                    selStatus === st.key
                      ? { backgroundColor: st.color, borderColor: st.color }
                      : { backgroundColor: colors.background, borderColor: colors.border }
                  ]}
                  onPress={() => setSelStatus(st.key)}
                >
                  <Text style={[styles.statusOptTxt, { color: selStatus === st.key ? '#fff' : colors.textSecondary }]}>{st.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={shiftNotes}
              onChangeText={setShiftNotes}
              placeholder="e.g. covering for Ali, specialised task..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
            />

            <View style={[styles.modalActions, { marginBottom: 28 }]}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border, flex: 1 }]} onPress={closeModal} disabled={saving}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 2 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="checkmark" size={15} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{editingShift ? 'Update Shift' : 'Assign Shift'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/* ─── Styles ─────────────────────────────────────────────────────────── */
function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...Typography.h3, color: colors.text },

    weekNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      borderBottomWidth: 1,
    },
    weekNavBtn: { padding: 4 },
    monthLabel: { ...Typography.caption, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

    dayStrip: {
      flexDirection: 'row', borderBottomWidth: 1,
    },
    dayCell: {
      flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2,
      borderRadius: 8, marginHorizontal: 1,
    },
    dayLbl: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
    dayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dayNum: { fontSize: 13, fontWeight: '700' },
    dotsRow: { flexDirection: 'row', gap: 2, marginTop: 4, height: 5, alignItems: 'center' },
    dot: { width: 4, height: 4, borderRadius: 2 },

    body: { padding: Spacing.lg },

    // On duty panel
    onDutyPanel: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
    onDutyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
    onDutyTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
    onDutyCount: { fontSize: 12, fontWeight: '600' },
    onDutyEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
    onDutyList: { gap: 8 },
    onDutyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    onDutyAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    onDutyAvatarTxt: { fontSize: 15, fontWeight: '800' },
    onDutyName: { fontSize: 13, fontWeight: '600' },
    onDutySub: { fontSize: 11, marginTop: 1 },

    // Roster
    rosterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
    rosterTitle: { ...Typography.h3 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 7 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    emptyDay: {
      alignItems: 'center', gap: 10, borderRadius: BorderRadius.lg, borderWidth: 1,
      borderStyle: 'dashed', padding: Spacing.xl,
    },
    emptyDayTxt: { fontSize: 13, textAlign: 'center' },
    emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: BorderRadius.md, paddingHorizontal: 16, paddingVertical: 9, marginTop: 4 },

    shiftCard: {
      borderRadius: BorderRadius.md, borderWidth: 1, borderLeftWidth: 4,
      padding: Spacing.md, marginBottom: Spacing.sm, gap: 8,
    },
    shiftTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { fontSize: 16, fontWeight: '800' },
    mechName: { fontSize: 14, fontWeight: '700' },
    mechSpec: { fontSize: 11, marginTop: 1 },
    editIconBtn: { padding: 6 },

    shiftMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    shiftBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
    shiftBadgeTxt: { fontSize: 11, fontWeight: '700' },
    shiftHours: { fontSize: 11 },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusChipTxt: { fontSize: 11, fontWeight: '700' },
    noteTxt: { fontSize: 11, flex: 1 },

    unrosteredBox: { borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: 'dashed', padding: Spacing.md, marginTop: Spacing.sm },
    unrosteredTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    unrosteredList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    unrosteredChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    unrosteredName: { fontSize: 12, fontWeight: '600' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '92%' as any },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
    modalTitle: { ...Typography.h3, marginBottom: 4 },
    modalSub: { ...Typography.caption, marginBottom: Spacing.lg },

    fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

    pickerChip: { borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, minWidth: 90, alignItems: 'center' },
    pickerChipTxt: { fontSize: 13, fontWeight: '700' },
    pickerChipSub: { fontSize: 10, marginTop: 2 },

    editingMechRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: BorderRadius.md, borderWidth: 1, padding: 12, marginBottom: 18 },
    editingMechName: { fontSize: 14, fontWeight: '700' },

    shiftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    shiftOption: { borderRadius: BorderRadius.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, minWidth: '45%' as any, flex: 1 },
    shiftOptLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    shiftOptTime: { fontSize: 10 },

    statusOption: { borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
    statusOptTxt: { fontSize: 12, fontWeight: '700' },

    notesInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 18 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: BorderRadius.lg },
  });
}
