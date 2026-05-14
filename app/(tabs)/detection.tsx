import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { onValue, push, ref, set } from 'firebase/database';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { Icon } from '@/components/ui/icon';
import { ProfileIconButton } from '@/components/profile-icon-button';
import { db } from '@/lib/firebase';
import { cancelScheduledNotification, combineDateAndTime, scheduleSingleNotification } from '@/lib/notifications';
import { useAuth } from '@/providers/AuthProvider';

type DetectionData = {
  lastSelfCheck: string;
  notes?: string;
  reminderNotificationId?: string | null;
  updatedAt: number;
};

type PredictRequest = {
  Family_History: 0 | 1;
  BMI: number;
  HRT_Usage: 0 | 1;
  Estrogen_Cosmetics: 0 | 1;
  No_or_Late_Pregnancy: 0 | 1;
  Late_Menopause: 0 | 1;
  Alcohol: 0 | 1;
};

type PredictResponse = {
  prediction: number;
  label: string;
};

type CtPredictResponse = {
  probability: number;
  prediction: string;
  class: 0 | 1;
};

type ScanLog = {
  type: 'risk-form' | 'xray';
  predictionLabel: string;
  probability?: number;
  score?: number;
  class?: number;
  createdAt: number;
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

export default function DetectionScreen() {
  const insets = useSafeAreaInsets();
  const { user, profileAvatarUri, profileName } = useAuth();
  const [lastSelfCheck, setLastSelfCheck] = useState<string>(toYmd(new Date()));
  const [saved, setSaved] = useState(false);
  const [reminderNotificationId, setReminderNotificationId] = useState<string | null>(null);

  const [bmi, setBmi] = useState('28.5');
  const [familyHistory, setFamilyHistory] = useState<0 | 1>(0);
  const [hrtUsage, setHrtUsage] = useState<0 | 1>(0);
  const [estrogenCosmetics, setEstrogenCosmetics] = useState<0 | 1>(0);
  const [noOrLatePregnancy, setNoOrLatePregnancy] = useState<0 | 1>(0);
  const [lateMenopause, setLateMenopause] = useState<0 | 1>(0);
  const [alcohol, setAlcohol] = useState<0 | 1>(0);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [ctImageUri, setCtImageUri] = useState<string | null>(null);
  const [ctLoading, setCtLoading] = useState(false);
  const [ctError, setCtError] = useState<string | null>(null);
  const [ctResult, setCtResult] = useState<CtPredictResponse | null>(null);

  useEffect(() => {
    if (!user) return;
    const detRef = ref(db, `users/${user.uid}/detection`);
    const unsub = onValue(detRef, (snap) => {
      const val = snap.val() as DetectionData | null;
      if (!val?.lastSelfCheck) return;
      setLastSelfCheck(val.lastSelfCheck);
      setReminderNotificationId(val.reminderNotificationId ?? null);
    });
    return () => unsub();
  }, [user]);

  const nextReminder = useMemo(() => addDays(lastSelfCheck, 30), [lastSelfCheck]);

  const bmiNumber = useMemo(() => {
    const n = Number(String(bmi).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }, [bmi]);

  const canPredict = useMemo(() => Number.isFinite(bmiNumber) && bmiNumber >= 10 && bmiNumber <= 60, [bmiNumber]);

  const badge = useMemo(() => {
    const label = result?.label?.toLowerCase() ?? '';
    if (label.includes('low')) return { bg: '#E8FFF1', border: '#B7F2CE', text: '#0F6B3A' };
    if (label.includes('high')) return { bg: '#FFF0F2', border: '#FFD1D6', text: '#A61B2B' };
    if (label.includes('moderate')) return { bg: '#FFF4EA', border: '#FFD6B0', text: '#8A4A00' };
    return { bg: '#F4EEFF', border: '#D4C3FF', text: '#4E358C' };
  }, [result?.label]);

  const ctBadge = useMemo(() => {
    if (!ctResult) return { bg: '#EAF4FF', border: '#BEDAFF', text: '#1E4F8D' };
    if (ctResult.class === 1) return { bg: '#FFF0F2', border: '#FFD1D6', text: '#A61B2B' };
    return { bg: '#E8FFF1', border: '#B7F2CE', text: '#0F6B3A' };
  }, [ctResult]);

  async function markDoneToday() {
    if (!user) return;
    setSaved(false);
    const today = toYmd(new Date());
    const nextDate = addDays(today, 30);
    const nextAt = combineDateAndTime(nextDate, '09:00');
    const nextNotificationId = await scheduleSingleNotification({
      title: 'Self-check reminder',
      body: 'Time for your monthly breast self-check.',
      when: nextAt,
    });
    await cancelScheduledNotification(reminderNotificationId);
    setLastSelfCheck(today);
    setReminderNotificationId(nextNotificationId);
    await set(ref(db, `users/${user.uid}/detection`), {
      lastSelfCheck: today,
      reminderNotificationId: nextNotificationId,
      updatedAt: Date.now(),
    } satisfies DetectionData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function predict() {
    setApiError(null);
    setResult(null);
    if (!canPredict) {
      setApiError('Please enter a valid BMI (10 - 60).');
      return;
    }

    const payload: PredictRequest = {
      Family_History: familyHistory,
      BMI: bmiNumber,
      HRT_Usage: hrtUsage,
      Estrogen_Cosmetics: estrogenCosmetics,
      No_or_Late_Pregnancy: noOrLatePregnancy,
      Late_Menopause: lateMenopause,
      Alcohol: alcohol,
    };

    setLoading(true);
    try {
      const res = await fetch('https://fastapi-7bho.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as PredictResponse;
      setResult(json);
      if (user) {
        await push(ref(db, `users/${user.uid}/scanResults`), {
          type: 'risk-form',
          predictionLabel: json.label,
          score: json.prediction,
          createdAt: Date.now(),
        } satisfies ScanLog);
      }
    } catch (e: any) {
      setApiError(e?.message ? String(e.message) : 'Could not reach the prediction service.');
    } finally {
      setLoading(false);
    }
  }

  async function pickCtImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to select a CT image.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets?.length) return;
    setCtImageUri(picked.assets[0].uri);
    setCtError(null);
    setCtResult(null);
  }

  async function predictCt() {
    if (!ctImageUri) {
      setCtError('Please select a CT image first.');
      return;
    }
    setCtError(null);
    setCtResult(null);
    setCtLoading(true);
    try {
      const formData = new FormData();
      const filename = ctImageUri.split('/').pop() || 'ct-image.jpg';
      const ext = filename.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      formData.append('file', {
        uri: ctImageUri,
        name: filename,
        type: `image/${ext}`,
      } as any);

      const res = await fetch('https://breast-cancer-detection-model-9zmi.onrender.com/predict', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as CtPredictResponse;
      setCtResult(json);
      if (user) {
        await push(ref(db, `users/${user.uid}/scanResults`), {
          type: 'xray',
          predictionLabel: json.prediction,
          probability: json.probability,
          class: json.class,
          createdAt: Date.now(),
        } satisfies ScanLog);
      }
    } catch (e: any) {
      setCtError(e?.message ? String(e.message) : 'Could not run X-Ray scan prediction.');
    } finally {
      setCtLoading(false);
    }
  }

  function BinaryField({
    label,
    value,
    onChange,
    hint,
  }: {
    label: string;
    value: 0 | 1;
    onChange: (v: 0 | 1) => void;
    hint?: string;
  }) {
    return (
      <View style={styles.fieldWrap}>
        <View style={styles.fieldCopy}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
        </View>
        <View style={styles.binaryRow}>
          <Pressable
            onPress={() => onChange(0)}
            style={({ pressed }) => [
              styles.binaryPill,
              value === 0 && styles.binaryPillOn,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.binaryText, value === 0 && styles.binaryTextOn]}>No</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange(1)}
            style={({ pressed }) => [
              styles.binaryPill,
              value === 1 && styles.binaryPillOn,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.binaryText, value === 1 && styles.binaryTextOn]}>Yes</Text>
          </Pressable>
        </View>
      </View>
    );
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
          { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 100) },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.dateLabel}>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.topTitle}>Detection lab</Text>
          </View>
          <View style={styles.topActions}>
            <View style={styles.topChip}>
              <Icon name="shield-check" size={14} color="#D5C5FF" />
              <Text style={styles.topChipText}>AI</Text>
            </View>
            <ProfileIconButton name={profileName ?? user?.displayName} avatarUri={profileAvatarUri ?? user?.photoURL} />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroSparkOne} />
          <View style={styles.heroSparkTwo} />
          <Text style={styles.heroEyebrow}>Breast health check</Text>
          <Text style={styles.heroTitle}>Screen smarter with monthly reminders</Text>
          <Text style={styles.heroSub}>This predictor is supportive only and not a medical diagnosis.</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>Last</Text>
              <Text style={styles.metaValue}>{lastSelfCheck}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaLabel}>Next</Text>
              <Text style={styles.metaValue}>{nextReminder}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardBadge}>
            <Icon name="heart-pulse" size={14} color="#FFE7F5" />
            <Text style={styles.cardBadgeText}>Risk form</Text>
          </View>
          <Text style={styles.sectionTitle}>AI breast cancer risk check</Text>
          <Text style={styles.textMuted}>Answer the fields below and tap predict.</Text>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>BMI</Text>
            <TextInput
              value={bmi}
              onChangeText={setBmi}
              keyboardType="decimal-pad"
              placeholder="e.g. 28.5"
              placeholderTextColor="#7783A0"
              style={styles.input}
            />
            {!canPredict && bmi.length > 0 ? <Text style={styles.errorInline}>Enter a valid BMI between 10 and 60.</Text> : null}
          </View>

          <BinaryField label="Family history" hint="Breast cancer in close relatives" value={familyHistory} onChange={setFamilyHistory} />
          <BinaryField label="HRT usage" hint="Hormone replacement therapy" value={hrtUsage} onChange={setHrtUsage} />
          <BinaryField
            label="Estrogen cosmetics"
            hint="Frequent estrogen-containing products"
            value={estrogenCosmetics}
            onChange={setEstrogenCosmetics}
          />
          <BinaryField
            label="No or late pregnancy"
            hint="No pregnancy or first pregnancy after 30"
            value={noOrLatePregnancy}
            onChange={setNoOrLatePregnancy}
          />
          <BinaryField label="Late menopause" hint="Menopause after 55" value={lateMenopause} onChange={setLateMenopause} />
          <BinaryField label="Alcohol" hint="Regular alcohol intake" value={alcohol} onChange={setAlcohol} />

          {!!apiError && <Text style={styles.error}>{apiError}</Text>}

          <Pressable
            onPress={predict}
            disabled={loading || !canPredict}
            style={({ pressed }) => [styles.primary, (pressed || loading || !canPredict) && styles.pressed]}>
            <Text style={styles.primaryText}>{loading ? 'Predicting...' : 'Predict'}</Text>
          </Pressable>
          {loading ? <ActivityIndicator color="#8A74FF" /> : null}
        </View>

        {result ? (
          <View style={[styles.resultCard, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <View style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>Prediction result</Text>
                <Text style={[styles.resultLabel, { color: badge.text }]}>{result.label}</Text>
                <Text style={styles.resultHint}>This is a model estimate. For symptoms, consult a doctor.</Text>
              </View>
              <View style={[styles.resultChip, { backgroundColor: badge.border }]}>
                <Text style={[styles.resultChipText, { color: badge.text }]}>{result.prediction}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardBadge}>
            <Icon name="shield-check" size={14} color="#D5F4FF" />
            <Text style={styles.cardBadgeText}>X-Ray model</Text>
          </View>
          <Text style={styles.sectionTitle}>X-Ray image cancer detection</Text>
          <Text style={styles.textMuted}>Upload an X-Ray image to run IDC detection model.</Text>

          <Pressable onPress={pickCtImage} style={({ pressed }) => [styles.ctImagePicker, pressed && styles.pressed]}>
            {ctImageUri ? (
              <Image source={{ uri: ctImageUri }} style={styles.ctImagePreview} />
            ) : (
              <View style={styles.ctImagePlaceholder}>
                <Icon name="camera" size={22} color="#BFD0EC" />
                <Text style={styles.ctImagePlaceholderText}>Select X-Ray image</Text>
              </View>
            )}
          </Pressable>

          {!!ctError && <Text style={styles.error}>{ctError}</Text>}

          <Pressable onPress={predictCt} disabled={ctLoading || !ctImageUri} style={({ pressed }) => [styles.primary, (pressed || ctLoading || !ctImageUri) && styles.pressed]}>
            <Text style={styles.primaryText}>{ctLoading ? 'Scanning...' : 'Predict from image'}</Text>
          </Pressable>
          {ctLoading ? <ActivityIndicator color="#8A74FF" /> : null}

          {ctResult ? (
            <View style={[styles.resultCard, { backgroundColor: ctBadge.bg, borderColor: ctBadge.border }]}>
              <View style={styles.resultRow}>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultTitle}>X-Ray prediction</Text>
                  <Text style={[styles.resultLabel, { color: ctBadge.text }]}>{ctResult.prediction}</Text>
                  <Text style={styles.resultHint}>Probability: {(ctResult.probability * 100).toFixed(3)}%</Text>
                </View>
                <View style={[styles.resultChip, { backgroundColor: ctBadge.border }]}>
                  <Text style={[styles.resultChipText, { color: ctBadge.text }]}>{ctResult.class}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardBadge}>
            <Icon name="calendar-heart" size={14} color="#F4D8EB" />
            <Text style={styles.cardBadgeText}>Reminder</Text>
          </View>
          <Text style={styles.sectionTitle}>Monthly self-check reminder</Text>
          <Text style={styles.text}>Last check: {lastSelfCheck}</Text>
          <Text style={styles.text}>Next reminder: {nextReminder}</Text>
          <Pressable onPress={markDoneToday} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>{saved ? 'Saved' : 'Mark done today'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardBadge}>
            <Icon name="notebook" size={14} color="#FFF5D8" />
            <Text style={styles.cardBadgeText}>Checklist</Text>
          </View>
          <Text style={styles.sectionTitle}>Quick checklist</Text>
          <Text style={styles.li}>- Look for changes in size or shape, and skin dimpling.</Text>
          <Text style={styles.li}>- Check nipple changes or unusual discharge.</Text>
          <Text style={styles.li}>- Feel for new lumps or thickening, including armpit area.</Text>
          <Text style={styles.li}>- If something feels unusual, speak with a doctor.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060912',
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    gap: 12,
  },
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
    top: 160,
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
    backgroundColor: 'rgba(132, 96, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(132, 96, 255, 0.28)',
  },
  topChipText: {
    color: '#E7DEFF',
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
    marginBottom: 2,
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
  heroSub: {
    color: '#B9C5DB',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontFamily: Fonts.sans,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  metaPill: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metaLabel: {
    color: '#9AA8C2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  metaValue: {
    color: '#F5F8FF',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
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
  sectionTitle: {
    color: '#F7F9FF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Fonts.serif,
  },
  textMuted: {
    color: '#8F9BB5',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  text: {
    color: '#DDE5F3',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  li: {
    color: '#DDE5F3',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldCopy: {
    gap: 2,
  },
  fieldLabel: {
    color: '#E8EEFA',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  fieldHint: {
    color: '#8F9BB5',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#F7F9FF',
    paddingHorizontal: 14,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  binaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  binaryPill: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  binaryPillOn: {
    backgroundColor: '#FF4FA3',
    borderColor: '#E7338D',
  },
  binaryText: {
    color: '#C5D0E4',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  binaryTextOn: {
    color: '#FFFFFF',
  },
  errorInline: {
    color: '#FF9CB0',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  error: {
    color: '#FF9CB0',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  primary: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4FA3',
    marginTop: 4,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontFamily: Fonts.sans,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: '#F5F8FF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  pressed: {
    opacity: 0.78,
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: -2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#3B2F5C',
    fontFamily: Fonts.sans,
  },
  resultLabel: {
    marginTop: 6,
    fontWeight: '900',
    fontSize: 20,
    fontFamily: Fonts.serif,
  },
  resultHint: {
    marginTop: 6,
    color: '#5A5072',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.sans,
  },
  resultChip: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultChipText: {
    fontWeight: '900',
    fontSize: 18,
    fontFamily: Fonts.sans,
  },
  ctImagePicker: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  ctImagePreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  ctImagePlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctImagePlaceholderText: {
    color: '#C7D4EC',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
});
