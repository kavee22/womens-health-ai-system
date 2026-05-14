import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { onValue, ref, set } from 'firebase/database';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { ProfileIconButton } from '@/components/profile-icon-button';
import { Fonts } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { cancelScheduledNotification, combineDateAndTime, scheduleSingleNotification } from '@/lib/notifications';
import { useAuth } from '@/providers/AuthProvider';

type CycleData = {
  lastPeriodStart: string; // YYYY-MM-DD
  cycleLengthDays: number;
  periodLengthDays: number;
  nextPeriodNotificationId?: string | null;
  prePeriodNotificationId?: string | null;
  updatedAt: number;
};

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

function diffDays(aYmd: string, bYmd: string) {
  const [ay, am, ad] = aYmd.split('-').map((x) => Number(x));
  const [by, bm, bd] = bYmd.split('-').map((x) => Number(x));
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function formatShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  const date = new Date(y, m - 1, d);
  const mm = date.toLocaleString(undefined, { month: 'short' });
  return `${mm} ${date.getDate()}`;
}

export default function CycleScreen() {
  const insets = useSafeAreaInsets();
  const { user, profileAvatarUri, profileName } = useAuth();

  const [lastPeriodStart, setLastPeriodStart] = useState(toYmd(new Date()));
  const [cycleLengthDays, setCycleLengthDays] = useState('28');
  const [periodLengthDays, setPeriodLengthDays] = useState('5');
  const [saved, setSaved] = useState(false);
  const [nextPeriodNotificationId, setNextPeriodNotificationId] = useState<string | null>(null);
  const [prePeriodNotificationId, setPrePeriodNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const cycleRef = ref(db, `users/${user.uid}/cycle`);
    const unsub = onValue(cycleRef, (snap) => {
      const val = snap.val() as CycleData | null;
      if (!val) return;
      setLastPeriodStart(val.lastPeriodStart || toYmd(new Date()));
      setCycleLengthDays(String(val.cycleLengthDays || 28));
      setPeriodLengthDays(String(val.periodLengthDays || 5));
      setNextPeriodNotificationId(val.nextPeriodNotificationId ?? null);
      setPrePeriodNotificationId(val.prePeriodNotificationId ?? null);
    });
    return () => unsub();
  }, [user]);

  const computed = useMemo(() => {
    const cycleLen = Math.max(20, Math.min(45, Number(cycleLengthDays) || 28));
    const periodLen = Math.max(2, Math.min(10, Number(periodLengthDays) || 5));
    const nextPeriod = addDays(lastPeriodStart, cycleLen);
    const fertileStart = addDays(lastPeriodStart, cycleLen - 18);
    const fertileEnd = addDays(lastPeriodStart, cycleLen - 11);
    const periodEnd = addDays(lastPeriodStart, periodLen - 1);
    return { cycleLen, periodLen, nextPeriod, fertileStart, fertileEnd, periodEnd };
  }, [lastPeriodStart, cycleLengthDays, periodLengthDays]);

  const today = useMemo(() => toYmd(new Date()), []);

  const todayAnalysis = useMemo(() => {
    const dayOfCycle = diffDays(lastPeriodStart, today) + 1;
    const daysUntilNextPeriod = diffDays(today, computed.nextPeriod);
    const inFertile = today >= computed.fertileStart && today <= computed.fertileEnd;
    const inPeriod = today >= lastPeriodStart && today <= computed.periodEnd;
    return { dayOfCycle, daysUntilNextPeriod, inFertile, inPeriod };
  }, [lastPeriodStart, today, computed.nextPeriod, computed.fertileStart, computed.fertileEnd, computed.periodEnd]);

  const phaseInsight = useMemo(() => {
    const cycleLen = computed.cycleLen;
    const cycleDay = Math.max(1, Math.min(cycleLen, todayAnalysis.dayOfCycle));
    const ovulationDay = Math.max(1, cycleLen - 14);

    const menstrualEnd = Math.max(1, Math.min(computed.periodLen, cycleLen));
    const follicularStart = menstrualEnd + 1;
    const follicularEnd = Math.max(follicularStart, ovulationDay - 1);
    type Phase = 'Menstrual' | 'Follicular' | 'Ovulation' | 'Luteal';

    let phase: Phase;
    if (cycleDay <= menstrualEnd) phase = 'Menstrual';
    else if (cycleDay >= follicularStart && cycleDay <= follicularEnd) phase = 'Follicular';
    else if (cycleDay === ovulationDay) phase = 'Ovulation';
    else phase = 'Luteal';

    const meta: Record<Phase, { emoji: string; energy: string; body: string; suggestion: string }> = {
      Menstrual: {
        emoji: '🩸',
        energy: 'Lower / resetting',
        body: 'Shedding lining, cramps may happen',
        suggestion: 'Rest, hydrate, gentle movement',
      },
      Follicular: {
        emoji: '🌿',
        energy: 'Increasing',
        body: 'Estrogen rising, recovery + focus',
        suggestion: 'Start new tasks, plan workouts',
      },
      Ovulation: {
        emoji: '✨',
        energy: 'Peak',
        body: 'Highest fertility, libido may rise',
        suggestion: 'Social / high-output day',
      },
      Luteal: {
        emoji: '🍂',
        energy: 'Steady → decreasing',
        body: 'Progesterone high, PMS possible',
        suggestion: 'Prioritize sleep, simplify schedule',
      },
    };

    const fertileStartDay = Math.max(1, ovulationDay - 5);
    const fertileEndDay = Math.min(cycleLen, ovulationDay + 1);

    let fertilityStatus = 'Low chance of pregnancy';
    let fertilityMessage = '';
    if (cycleDay < fertileStartDay) {
      fertilityStatus = 'Low chance of pregnancy today';
      fertilityMessage = `Fertile window starts in ${fertileStartDay - cycleDay} day(s).`;
    } else if (cycleDay >= fertileStartDay && cycleDay <= fertileEndDay) {
      fertilityStatus = 'High chance of pregnancy';
      fertilityMessage = 'You are inside your fertile window.';
    } else {
      fertilityStatus = 'Low chance of pregnancy today';
      fertilityMessage = 'Ovulation has likely passed for this cycle.';
    }

    return {
      cycleDay,
      cycleLen,
      ovulationDay,
      fertileStartDay,
      fertileEndDay,
      phase,
      ...meta[phase],
      fertilityStatus,
      fertilityMessage,
    };
  }, [computed.cycleLen, computed.periodLen, todayAnalysis.dayOfCycle]);

  async function onSave() {
    if (!user) return;
    setSaved(false);
    const nextPeriodDate = computed.nextPeriod;
    const nextAt = combineDateAndTime(nextPeriodDate, '08:30');
    const twoDaysBefore = addDays(nextPeriodDate, -2);
    const preAt = combineDateAndTime(twoDaysBefore, '08:30');
    const notificationId = await scheduleSingleNotification({
      title: 'Cycle reminder',
      body: `Your next period is expected around ${formatShort(nextPeriodDate)}.`,
      when: nextAt,
    });
    const preNotificationId = await scheduleSingleNotification({
      title: 'Cycle reminder',
      body: `Heads up: your period is expected in 2 days (${formatShort(nextPeriodDate)}).`,
      when: preAt,
    });
    await cancelScheduledNotification(nextPeriodNotificationId);
    await cancelScheduledNotification(prePeriodNotificationId);
    const data: CycleData = {
      lastPeriodStart,
      cycleLengthDays: computed.cycleLen,
      periodLengthDays: computed.periodLen,
      nextPeriodNotificationId: notificationId,
      prePeriodNotificationId: preNotificationId,
      updatedAt: Date.now(),
    };
    await set(ref(db, `users/${user.uid}/cycle`), data);
    setNextPeriodNotificationId(notificationId);
    setPrePeriodNotificationId(preNotificationId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.bgGlowOne} />
      <View pointerEvents="none" style={styles.bgGlowTwo} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 122) },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.dateLabel}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.topTitle}>Cycle insights</Text>
          </View>
          <View style={styles.topActions}>
            <View style={styles.statusTag}>
              <Icon name="calendar-heart" size={14} color="#F5D8EB" />
              <Text style={styles.statusTagText}>
                {todayAnalysis.inPeriod ? 'Period' : todayAnalysis.inFertile ? 'Fertile' : 'Normal'}
              </Text>
            </View>
            <ProfileIconButton name={profileName ?? user?.displayName} avatarUri={profileAvatarUri ?? user?.photoURL} />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroSparkOne} />
          <View style={styles.heroSparkTwo} />

          <Text style={styles.heroEyebrow}>Today</Text>
          <Text style={styles.heroTitle}>Day {todayAnalysis.dayOfCycle}</Text>
          <Text style={styles.heroSub}>
            Next period in {todayAnalysis.daysUntilNextPeriod} days · {formatShort(computed.nextPeriod)}
          </Text>

          <View style={styles.heroRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Fertile window</Text>
              <Text style={styles.heroPillValue}>
                {formatShort(computed.fertileStart)} - {formatShort(computed.fertileEnd)}
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Period length</Text>
              <Text style={styles.heroPillValue}>{computed.periodLen} days</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cycle phase</Text>
          <Text style={styles.phaseKicker}>
            {phaseInsight.emoji} {phaseInsight.phase} phase · Day {phaseInsight.cycleDay} / {phaseInsight.cycleLen}
          </Text>
          <View style={styles.phaseGrid}>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillLabel}>Energy</Text>
              <Text style={styles.phasePillValue}>{phaseInsight.energy}</Text>
            </View>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillLabel}>Body</Text>
              <Text style={styles.phasePillValue}>{phaseInsight.body}</Text>
            </View>
          </View>
          <View style={styles.phaseHintCard}>
            <Text style={styles.phaseHintLabel}>Suggestion</Text>
            <Text style={styles.phaseHintText}>{phaseInsight.suggestion}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fertility + safety insights</Text>
          <View style={styles.fertilityHero}>
            <Text style={styles.fertilityStatus}>{phaseInsight.fertilityStatus}</Text>
            <Text style={styles.fertilityMsg}>{phaseInsight.fertilityMessage}</Text>
          </View>
          <View style={styles.phaseGrid}>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillLabel}>Ovulation day</Text>
              <Text style={styles.phasePillValue}>Day {phaseInsight.ovulationDay}</Text>
            </View>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillLabel}>Fertile window</Text>
              <Text style={styles.phasePillValue}>
                Day {phaseInsight.fertileStartDay} – {phaseInsight.fertileEndDay}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cycle settings</Text>
          <Text style={styles.label}>Last period start (YYYY-MM-DD)</Text>
          <TextInput
            value={lastPeriodStart}
            onChangeText={setLastPeriodStart}
            style={styles.input}
            placeholder="2026-04-22"
            placeholderTextColor="#7E8AA3"
          />

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cycle length</Text>
              <TextInput value={cycleLengthDays} onChangeText={setCycleLengthDays} style={styles.input} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Period length</Text>
              <TextInput value={periodLengthDays} onChangeText={setPeriodLengthDays} style={styles.input} keyboardType="number-pad" />
            </View>
          </View>

          <Pressable onPress={onSave} style={({ pressed }) => [styles.save, pressed && styles.pressed]}>
            <Text style={styles.saveText}>{saved ? 'Saved' : 'Save changes'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060912' },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, gap: 14 },
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
    top: 150,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(228, 95, 179, 0.12)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    fontFamily: Fonts.serif,
    letterSpacing: -0.4,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statusTagText: {
    color: '#F4F7FF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Fonts.sans,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hero: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#11182A',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 4,
    gap: 10,
  },
  heroSparkOne: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(90, 190, 255, 0.10)',
    top: -68,
    right: -52,
  },
  heroSparkTwo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: 'rgba(228, 95, 179, 0.10)',
    left: -44,
    bottom: -50,
  },
  heroEyebrow: {
    color: '#A3B1CF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  heroTitle: {
    color: '#F7F9FF',
    fontSize: 40,
    lineHeight: 44,
    fontFamily: Fonts.serif,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  heroSub: {
    color: '#B9C5DB',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
  heroRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  heroPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    gap: 4,
  },
  heroPillLabel: { color: '#99A8C2', fontWeight: '800', fontSize: 10, fontFamily: Fonts.sans, textTransform: 'uppercase' },
  heroPillValue: { color: '#F7F9FF', fontWeight: '800', fontSize: 13, fontFamily: Fonts.sans },
  card: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    color: '#F6F8FF',
    fontFamily: Fonts.serif,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  phaseKicker: { color: '#EAF0FF', fontWeight: '900', fontFamily: Fonts.sans, marginTop: 6 },
  phaseGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  phasePill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 12,
    gap: 4,
  },
  phasePillLabel: {
    color: '#9AA8C2',
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: Fonts.sans,
  },
  phasePillValue: { color: '#F7F9FF', fontWeight: '800', fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18 },
  phaseHintCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(229, 99, 185, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(229, 99, 185, 0.22)',
    gap: 6,
  },
  phaseHintLabel: { color: '#FFD6EA', fontWeight: '900', fontFamily: Fonts.sans, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 },
  phaseHintText: { color: '#F7F9FF', fontWeight: '800', fontFamily: Fonts.sans, lineHeight: 18 },
  fertilityHero: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(73, 194, 214, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(73, 194, 214, 0.20)',
    gap: 6,
  },
  fertilityStatus: { color: '#E8FCFF', fontWeight: '900', fontFamily: Fonts.serif, fontSize: 16 },
  fertilityMsg: { color: '#CFF9FF', fontWeight: '700', fontFamily: Fonts.sans, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#9AA9C3', fontFamily: Fonts.sans, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#F1F5FF',
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  save: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E563B9',
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  saveText: { color: 'white', fontWeight: '900', fontFamily: Fonts.sans, letterSpacing: 0.2 },
  pressed: { opacity: 0.75 },
  twoCol: { flexDirection: 'row', gap: 12 },
});

