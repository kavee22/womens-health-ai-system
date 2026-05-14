import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { onValue, push, ref, remove, update } from 'firebase/database';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/icon';
import { ProfileIconButton } from '@/components/profile-icon-button';
import { db } from '@/lib/firebase';
import {
  cancelScheduledNotification,
  combineDateAndTime,
  formatDateLabel,
  ReminderRecurrence,
  scheduleRecurringNotification,
  scheduleSingleNotification,
} from '@/lib/notifications';
import { useAuth } from '@/providers/AuthProvider';

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  dueAt: number;
  dueDate: string;
  dueTime: string;
  recurrence?: ReminderRecurrence;
  notificationId?: string | null;
  createdAt: number;
};

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toHm(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeTodoItem(id: string, item: any): TodoItem {
  const createdAt = Number(item?.createdAt) || Date.now();
  const dueAt = Number(item?.dueAt) || createdAt + 24 * 60 * 60 * 1000;
  const dueDate = typeof item?.dueDate === 'string' && item.dueDate.includes('-') ? item.dueDate : toYmd(new Date(dueAt));
  const dueTime =
    typeof item?.dueTime === 'string' && item.dueTime.includes(':')
      ? item.dueTime
      : new Date(dueAt).toTimeString().slice(0, 5);

  return {
    id,
    text: String(item?.text ?? ''),
    done: Boolean(item?.done),
    dueAt,
    dueDate,
    dueTime,
    recurrence: (item?.recurrence as ReminderRecurrence) ?? 'none',
    notificationId: item?.notificationId ?? null,
    createdAt,
  };
}

export default function TodoScreen() {
  const insets = useSafeAreaInsets();
  const { user, profileAvatarUri, profileName } = useAuth();
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState(() => toYmd(new Date()));
  const [dueTime, setDueTime] = useState(() => {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 10);
    return toHm(next);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  useEffect(() => {
    if (!user) return;
    const todosRef = ref(db, `users/${user.uid}/todos`);
    const unsub = onValue(todosRef, (snap) => {
      const val = snap.val() as Record<string, Omit<TodoItem, 'id'>> | null;
      const list = val ? Object.entries(val).map(([id, item]) => normalizeTodoItem(id, item)) : [];
      list.sort((a, b) => a.dueAt - b.dueAt);
      setTodos(list);
    });
    return () => unsub();
  }, [user]);

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((item) => item.done).length;
    const pending = total - completed;
    const completion = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, completion };
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todos
      .filter((t) => {
        if (filter === 'active') return !t.done;
        if (filter === 'done') return t.done;
        return true;
      })
      .filter((t) => (!q ? true : t.text.toLowerCase().includes(q)));
  }, [todos, query, filter]);

  async function addTodo() {
    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setFormError('Enter reminder text first.');
      return;
    }
    const when = combineDateAndTime(dueDate, dueTime);
    if (!Number.isFinite(when.getTime())) {
      setFormError('Use valid date/time format: YYYY-MM-DD and HH:mm.');
      return;
    }
    if (when.getTime() <= Date.now()) {
      setFormError('Reminder time must be in the future.');
      return;
    }
    const notificationId =
      recurrence === 'none'
        ? await scheduleSingleNotification({
            title: 'Reminder',
            body: trimmed,
            when,
          })
        : await scheduleRecurringNotification({
            title: 'Reminder',
            body: trimmed,
            when,
            recurrence,
          });
    setFormError(null);
    setText('');
    await push(ref(db, `users/${user.uid}/todos`), {
      text: trimmed,
      done: false,
      dueDate,
      dueTime,
      recurrence,
      dueAt: when.getTime(),
      notificationId,
      createdAt: Date.now(),
    });
  }

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowDatePicker(false);
    if (!selected) return;
    setDueDate(toYmd(selected));
  }

  function onTimeChange(_: DateTimePickerEvent, selected?: Date) {
    setShowTimePicker(false);
    if (!selected) return;
    setDueTime(toHm(selected));
  }

  async function toggleTodo(item: TodoItem) {
    if (!user) return;
    const nextDone = !item.done;
    if (nextDone) {
      await cancelScheduledNotification(item.notificationId);
    } else if ((item.recurrence ?? 'none') !== 'none' || item.dueAt > Date.now()) {
      const notificationId =
        (item.recurrence ?? 'none') === 'none'
          ? await scheduleSingleNotification({
              title: 'Reminder',
              body: item.text,
              when: new Date(item.dueAt),
            })
          : await scheduleRecurringNotification({
              title: 'Reminder',
              body: item.text,
              when: new Date(item.dueAt),
              recurrence: (item.recurrence ?? 'none') as Exclude<ReminderRecurrence, 'none'>,
            });
      await update(ref(db, `users/${user.uid}/todos/${item.id}`), { notificationId });
    }
    await update(ref(db, `users/${user.uid}/todos/${item.id}`), { done: nextDone });
  }

  async function deleteTodo(item: TodoItem) {
    if (!user) return;
    await cancelScheduledNotification(item.notificationId);
    await remove(ref(db, `users/${user.uid}/todos/${item.id}`));
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.bgGlowOne} />
      <View pointerEvents="none" style={styles.bgGlowTwo} />

      <KeyboardAvoidingView
        style={styles.list}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 100) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.dateLabel}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                <Text style={styles.topTitle}>Reminder board</Text>
              </View>
              <View style={styles.topActions}>
                <View style={styles.topChip}>
                  <Icon name="notebook" size={14} color="#FFE7F5" />
                  <Text style={styles.topChipText}>Reminders</Text>
                </View>
                <ProfileIconButton name={profileName ?? user?.displayName} avatarUri={profileAvatarUri ?? user?.photoURL} />
              </View>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroSparkOne} />
              <View style={styles.heroSparkTwo} />
              <Text style={styles.heroEyebrow}>Today plan</Text>
              <Text style={styles.heroTitle}>Stay gentle, remember what matters</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.total}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.pending}</Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statCardAccent}>
                  <Text style={styles.statValueAccent}>{stats.completion}%</Text>
                  <Text style={styles.statLabelAccent}>Progress</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardBadge}>
                <Icon name="search" size={14} color="#DFFBFF" />
                <Text style={styles.cardBadgeText}>Search + filter</Text>
              </View>

              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search reminders..."
                  placeholderTextColor="#7783A0"
                  style={styles.input}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                <Pressable
                  onPress={() => setQuery('')}
                  disabled={!query.trim()}
                  style={({ pressed }) => [styles.secondaryBtn, (!query.trim()) && styles.disabled, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText}>Clear</Text>
                </Pressable>
              </View>

              <View style={styles.filtersRow}>
                <Pressable onPress={() => setFilter('all')} style={({ pressed }) => [styles.filterPill, filter === 'all' && styles.filterPillOn, pressed && styles.pressed]}>
                  <Text style={[styles.filterText, filter === 'all' && styles.filterTextOn]}>All</Text>
                </Pressable>
                <Pressable onPress={() => setFilter('active')} style={({ pressed }) => [styles.filterPill, filter === 'active' && styles.filterPillOn, pressed && styles.pressed]}>
                  <Text style={[styles.filterText, filter === 'active' && styles.filterTextOn]}>Active</Text>
                </Pressable>
                <Pressable onPress={() => setFilter('done')} style={({ pressed }) => [styles.filterPill, filter === 'done' && styles.filterPillOn, pressed && styles.pressed]}>
                  <Text style={[styles.filterText, filter === 'done' && styles.filterTextOn]}>Done</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardBadge}>
                <Icon name="edit" size={14} color="#FFF5D8" />
                <Text style={styles.cardBadgeText}>New reminder</Text>
              </View>
              <View style={styles.searchRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Add a reminder..."
                  placeholderTextColor="#7783A0"
                  style={styles.input}
                  onSubmitEditing={addTodo}
                  returnKeyType="done"
                />
                <Pressable onPress={addTodo} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.primaryBtnText}>Add</Text>
                </Pressable>
              </View>
              <View style={styles.searchRow}>
                <Pressable onPress={() => setShowDatePicker(true)} style={({ pressed }) => [styles.input, styles.pickerInput, pressed && styles.pressed]}>
                  <Text style={styles.pickerText}>{dueDate}</Text>
                </Pressable>
                <Pressable onPress={() => setShowTimePicker(true)} style={({ pressed }) => [styles.input, styles.pickerInput, pressed && styles.pressed]}>
                  <Text style={styles.pickerText}>{dueTime}</Text>
                </Pressable>
              </View>
              <View style={styles.filtersRow}>
                {(['none', 'daily', 'monthly', 'yearly'] as ReminderRecurrence[]).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setRecurrence(value)}
                    style={({ pressed }) => [styles.filterPill, recurrence === value && styles.filterPillOn, pressed && styles.pressed]}>
                    <Text style={[styles.filterText, recurrence === value && styles.filterTextOn]}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              {showDatePicker ? (
                <DateTimePicker value={combineDateAndTime(dueDate, dueTime)} mode="date" display="default" onChange={onDateChange} />
              ) : null}
              {showTimePicker ? (
                <DateTimePicker value={combineDateAndTime(dueDate, dueTime)} mode="time" display="default" onChange={onTimeChange} />
              ) : null}
              {!!formError && <Text style={styles.formError}>{formError}</Text>}
            </View>
          </View>
        }
          renderItem={({ item }) => (
          <View style={styles.todoRow}>
            <Pressable onPress={() => toggleTodo(item)} style={({ pressed }) => [styles.todo, pressed && styles.pressed]}>
              <View style={[styles.check, item.done && styles.checkOn]}>{item.done ? <View style={styles.checkInner} /> : null}</View>
              <View style={styles.todoBody}>
                <Text style={[styles.todoText, item.done && styles.todoDone]} numberOfLines={2}>
                  {item.text}
                </Text>
                <Text style={styles.todoMeta}>
                  {item.done
                    ? 'Completed'
                    : `Due ${formatDateLabel(item.dueDate)} at ${item.dueTime}${item.recurrence && item.recurrence !== 'none' ? ` · ${item.recurrence}` : ''}`}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={() => deleteTodo(item)} style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        )}
          ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{query.trim() || filter !== 'all' ? 'No matches' : 'No reminders yet'}</Text>
            <Text style={styles.emptyText}>
              {query.trim() || filter !== 'all' ? 'Try changing search or filter.' : 'Add your first reminder with date and time.'}
            </Text>
          </View>
          }
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060912' },
  list: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerWrap: { gap: 12, marginBottom: 10 },
  bgGlowOne: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(58, 227, 255, 0.14)',
  },
  bgGlowTwo: {
    position: 'absolute',
    left: -110,
    top: 170,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(228, 95, 179, 0.12)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    color: '#7F8DAA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  topTitle: {
    color: '#F5F8FF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: Fonts.sans,
  },
  topChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 79, 163, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 79, 163, 0.28)',
  },
  topChipText: {
    color: '#FFD8EC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hero: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#11182A',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.18)',
    padding: 16,
  },
  heroSparkOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(90, 190, 255, 0.10)',
    top: -70,
    right: -55,
  },
  heroSparkTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: 'rgba(228, 95, 179, 0.10)',
    left: -45,
    bottom: -48,
  },
  heroEyebrow: {
    color: '#A3B1CF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  heroTitle: {
    color: '#F7F9FF',
    fontSize: 28,
    lineHeight: 32,
    marginTop: 8,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statCardAccent: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FF4FA3',
    borderWidth: 1,
    borderColor: '#E7338D',
  },
  statValue: {
    color: '#F5F8FF',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Fonts.sans,
  },
  statLabel: {
    color: '#9AA8C2',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  statValueAccent: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Fonts.sans,
  },
  statLabelAccent: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  card: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
    gap: 10,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardBadgeText: {
    color: '#D9E3F6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#F7F9FF',
    paddingHorizontal: 14,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  pickerInput: {
    justifyContent: 'center',
  },
  pickerText: {
    color: '#F7F9FF',
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  filterPillOn: {
    backgroundColor: 'rgba(255, 79, 163, 0.22)',
    borderColor: 'rgba(255, 79, 163, 0.40)',
  },
  filterText: {
    color: '#C5D0E4',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  filterTextOn: {
    color: '#FFFFFF',
  },
  primaryBtn: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4FA3',
    borderWidth: 1,
    borderColor: '#E7338D',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Fonts.sans,
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  secondaryBtnText: {
    color: '#E2EAF8',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  disabled: { opacity: 0.45 },
  todoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  todo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FF4FA3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#FF4FA3' },
  checkInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  todoBody: { flex: 1, gap: 2 },
  todoText: {
    color: '#F5F8FF',
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  todoDone: {
    textDecorationLine: 'line-through',
    color: '#98A6BF',
  },
  todoMeta: {
    color: '#8F9BB5',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 79, 163, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 79, 163, 0.36)',
  },
  deleteBtnText: {
    color: '#FFD6EA',
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  empty: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
    marginTop: 4,
  },
  emptyTitle: {
    color: '#F5F8FF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Fonts.serif,
  },
  emptyText: {
    marginTop: 6,
    color: '#8F9BB5',
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  formError: {
    color: '#FFB3D1',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  pressed: { opacity: 0.78 },
});
