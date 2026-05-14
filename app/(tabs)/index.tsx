import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onValue, ref, set } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileIconButton } from "@/components/profile-icon-button";
import { Icon } from "@/components/ui/icon";
import { Fonts, Pink } from "@/constants/theme";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";

type CycleData = {
  lastPeriodStart: string;
  cycleLengthDays: number;
  periodLengthDays: number;
  updatedAt: number;
};

type DetectionData = {
  lastSelfCheck: string;
  updatedAt: number;
};
type TodoItem = {
  done?: boolean;
  dueAt?: number;
  createdAt?: number;
  text?: string;
};

type MoodKey = "tired" | "energized" | "loving" | "calm" | "bright";
type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; text: string };

function toDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(y, m - 1, d);
}

function toYmd(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShort(date: Date) {
  const month = date.toLocaleString(undefined, { month: "short" });
  return `${month} ${date.getDate()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function daysBetween(a: Date, b: Date) {
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(diff / 86400000);
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profileAvatarUri, profileName } = useAuth();

  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [detection, setDetection] = useState<DetectionData | null>(null);
  const [todos, setTodos] = useState<Record<string, TodoItem> | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodKey>("loving");
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi, I am Ask AI. Share a symptom or cycle question.",
    },
  ]);

  useEffect(() => {
    if (!user) return;

    const cycleRef = ref(db, `users/${user.uid}/cycle`);
    const detRef = ref(db, `users/${user.uid}/detection`);
    const todoRef = ref(db, `users/${user.uid}/todos`);

    const unsub1 = onValue(cycleRef, (snap) =>
      setCycle((snap.val() as CycleData | null) ?? null),
    );
    const unsub2 = onValue(detRef, (snap) =>
      setDetection((snap.val() as DetectionData | null) ?? null),
    );
    const unsub3 = onValue(todoRef, (snap) =>
      setTodos((snap.val() as Record<string, TodoItem> | null) ?? null),
    );

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const todayKey = toYmd(new Date());
    const moodRef = ref(db, `users/${user.uid}/moodLogs/${todayKey}`);
    const unsub = onValue(moodRef, (snap) => {
      const val = snap.val() as { mood?: MoodKey } | null;
      if (val?.mood) setSelectedMood(val.mood);
    });
    return () => unsub();
  }, [user]);

  const greeting = useMemo(() => {
    const name = profileName?.trim() || user?.displayName?.trim();
    return name ? name : "Friend";
  }, [profileName, user?.displayName]);

  const today = useMemo(() => startOfDay(), []);

  const cycleSummary = useMemo(() => {
    if (!cycle?.lastPeriodStart) return null;

    const cycleLen = clamp(Number(cycle.cycleLengthDays) || 28, 20, 45);
    const periodLen = clamp(Number(cycle.periodLengthDays) || 5, 2, 10);
    const lastPeriodStart = toDate(cycle.lastPeriodStart);
    const nextPeriod = addDays(lastPeriodStart, cycleLen);
    const periodEnd = addDays(lastPeriodStart, periodLen - 1);
    const ovulationDate = addDays(lastPeriodStart, cycleLen - 14);
    const daysToOvulation = daysBetween(today, ovulationDate);
    const cycleProgress = clamp(
      daysBetween(lastPeriodStart, today) / cycleLen,
      0,
      1,
    );

    return {
      nextPeriod,
      nextPeriodShort: formatShort(nextPeriod),
      lastPeriodShort: formatShort(lastPeriodStart),
      periodEndShort: formatShort(periodEnd),
      ovulationDate,
      daysToOvulation,
      cycleProgress,
      periodRange: `${formatShort(lastPeriodStart)} - ${formatShort(periodEnd)}`,
    };
  }, [cycle, today]);

  const checkSummary = useMemo(() => {
    const last = detection?.lastSelfCheck;
    if (!last) return null;

    const lastDate = toDate(last);
    const next = addDays(lastDate, 30);
    const progress = clamp(daysBetween(lastDate, today) / 30, 0, 1);

    return {
      lastDate,
      next,
      nextShort: formatShort(next),
      lastShort: formatShort(lastDate),
      progress,
    };
  }, [detection, today]);

  const weekStrip = useMemo(() => {
    const center = today;
    const weekStart = addDays(center, -3);
    const cycleStart = cycle?.lastPeriodStart
      ? toDate(cycle.lastPeriodStart)
      : null;
    const cycleLen = cycle
      ? clamp(Number(cycle.cycleLengthDays) || 28, 20, 45)
      : 28;
    const periodLen = cycle
      ? clamp(Number(cycle.periodLengthDays) || 5, 2, 10)
      : 5;
    const periodEnd = cycleStart ? addDays(cycleStart, periodLen - 1) : null;
    const ovulationDate = cycleStart
      ? addDays(cycleStart, cycleLen - 14)
      : null;

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const isToday = toYmd(date) === toYmd(center);
      const isPeriod = Boolean(
        cycleStart && periodEnd && date >= cycleStart && date <= periodEnd,
      );
      const isOvulation = Boolean(
        ovulationDate && toYmd(date) === toYmd(ovulationDate),
      );

      return {
        date,
        isToday,
        isPeriod,
        isOvulation,
      };
    });
  }, [cycle, today]);

  const heroState = useMemo(() => {
    if (!cycleSummary) {
      return {
        label: "Sync cycle",
        value: "--",
        unit: "days",
        subtitle: "Add your cycle data for a live fertility forecast.",
      };
    }

    const days = cycleSummary.daysToOvulation;
    if (days > 0) {
      return {
        label: "Ovulation in",
        value: String(days),
        unit: days === 1 ? "day" : "days",
        subtitle: "Based on your recent cycle history.",
      };
    }

    if (days === 0) {
      return {
        label: "Ovulation",
        value: "Today",
        unit: "",
        subtitle: "This looks like a peak fertility day.",
      };
    }

    return {
      label: "Fertile window",
      value: String(Math.abs(days)),
      unit: days === -1 ? "day ago" : "days ago",
      subtitle: "You may already be inside the fertile window.",
    };
  }, [cycleSummary]);

  const scheduleText = useMemo(() => {
    if (checkSummary?.next && cycleSummary?.nextPeriod) {
      const nextCheck = checkSummary.next.getTime();
      const nextPeriod = cycleSummary.nextPeriod.getTime();
      if (nextCheck <= nextPeriod) {
        return `Self-check reminder is due on ${checkSummary.nextShort}.`;
      }

      return `Cycle reminder: next period expected ${cycleSummary.nextPeriodShort}.`;
    }

    if (checkSummary?.nextShort)
      return `Self-check reminder is due on ${checkSummary.nextShort}.`;
    if (cycleSummary?.nextPeriodShort)
      return `Cycle reminder: next period expected ${cycleSummary.nextPeriodShort}.`;
    return "Tip: save your cycle dates to unlock smarter reminders.";
  }, [checkSummary, cycleSummary]);

  const reminderSummary = useMemo(() => {
    const items = Object.values(todos ?? {});
    const pending = items.filter((item) => !item?.done).length;
    const upcoming = items
      .filter((item) => !item?.done && Number(item?.dueAt) > Date.now())
      .sort((a, b) => Number(a.dueAt || 0) - Number(b.dueAt || 0))[0];

    const upcomingLabel = upcoming?.dueAt
      ? new Date(upcoming.dueAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : null;

    return {
      pending,
      subtitle: upcomingLabel
        ? `Next reminder on ${upcomingLabel}${upcoming?.text ? `: ${upcoming.text}` : ""}`
        : scheduleText,
    };
  }, [todos, scheduleText]);

  const moodItems: {
    key: MoodKey;
    label: string;
    accent: string;
    glow: string;
  }[] = [
    {
      key: "tired",
      label: "Tired",
      accent: "#7B8BAD",
      glow: "rgba(123,139,173,0.18)",
    },
    {
      key: "energized",
      label: "Energetic",
      accent: "#49C2D6",
      glow: "rgba(73,194,214,0.18)",
    },
    {
      key: "loving",
      label: "Loving",
      accent: "#E563B9",
      glow: "rgba(229,99,185,0.22)",
    },
    {
      key: "calm",
      label: "Calm",
      accent: "#69D88C",
      glow: "rgba(105,216,140,0.18)",
    },
    {
      key: "bright",
      label: "Bright",
      accent: "#F4C14F",
      glow: "rgba(244,193,79,0.18)",
    },
  ];

  async function onSelectMood(mood: MoodKey) {
    setSelectedMood(mood);
    if (!user) return;
    const todayKey = toYmd(new Date());
    await set(ref(db, `users/${user.uid}/moodLogs/${todayKey}`), {
      mood,
      updatedAt: Date.now(),
    });
  }

  async function onSendChat() {
    const prompt = chatInput.trim();
    if (!prompt || chatLoading) return;

    const apiKey = "AIzaSyDO0dkPpPxvRszisfPPJ4dAz1xbGAFMiRk";
    if (!apiKey) {
      setChatMessages((prev) => [
        ...prev,
        { role: "user", text: prompt },
        {
          role: "assistant",
          text: "Missing API key. Add EXPO_PUBLIC_GEMINI_API_KEY in your .env and restart Expo.",
        },
      ]);
      setChatInput("");
      return;
    }

    const history = [...chatMessages, { role: "user" as const, text: prompt }];
    setChatMessages(history);
    setChatInput("");
    setChatLoading(true);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: history.map((item) => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.text }],
          })),
        }),
      });

      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string; status?: string; code?: number };
      };

      if (!response.ok) {
        const backendMessage =
          data.error?.message ?? "Unknown Gemini API error";
        const status = data.error?.status ?? `HTTP_${response.status}`;
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Gemini request failed (${status}): ${backendMessage}`,
          },
        ]);
        return;
      }

      const answer = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n")
        .trim();
      const fallback =
        data.error?.message ?? "I could not get a response right now.";

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: answer || fallback,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Network issue. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
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
          {
            paddingTop: insets.top + 10,
            paddingBottom: Math.max(insets.bottom, 122),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(450)}
          style={styles.topBar}
        >
          <View>
            <Text style={styles.dateLabel}>
              {today.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text style={styles.topTitle}>Neural cycle</Text>
          </View>
          <ProfileIconButton
            name={profileName ?? user?.displayName}
            avatarUri={profileAvatarUri ?? user?.photoURL}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(500).delay(40)}
          style={styles.hero}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroSparkOne} />
          <View style={styles.heroSparkTwo} />

          <View style={styles.weekStrip}>
            {weekStrip.map((item) => {
              const dayLabel = item.date
                .toLocaleDateString(undefined, { weekday: "narrow" })
                .toUpperCase();
              return (
                <View
                  key={toYmd(item.date)}
                  style={[
                    styles.weekDay,
                    item.isToday && styles.weekDayToday,
                    item.isPeriod && styles.weekDayPeriod,
                    item.isOvulation && styles.weekDayOvulation,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDayLabel,
                      item.isToday && styles.weekDayLabelToday,
                    ]}
                  >
                    {dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNum,
                      item.isToday && styles.weekDayNumToday,
                    ]}
                  >
                    {item.date.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.heroEyebrow}>{heroState.label}</Text>
            <View style={styles.heroCountRow}>
              <Text style={styles.heroCount}>{heroState.value}</Text>
              {heroState.unit ? (
                <Text style={styles.heroUnit}>{heroState.unit}</Text>
              ) : null}
            </View>
            <Text style={styles.heroSub}>{heroState.subtitle}</Text>
            <Pressable
              style={styles.heroButton}
              onPress={() => router.push("/(tabs)/cycle")}
            >
              <View style={styles.heroDot} />
              <Text style={styles.heroButtonText}>Mark your period</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(450).delay(90)}
          style={styles.body}
        >
          <View style={styles.greetingRow}>
            <Text style={styles.greetingHi}>Good morning,</Text>
            <Text style={styles.greetingName}>{greeting}.</Text>
          </View>
          <Text style={styles.feelingQuestion}>How are you feeling today?</Text>

          <View style={styles.moodRow}>
            {moodItems.map((item) => {
              const active = selectedMood === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => void onSelectMood(item.key)}
                  style={({ pressed }) => [
                    styles.moodButton,
                    { backgroundColor: item.accent, shadowColor: item.accent },
                    active && styles.moodButtonActive,
                    pressed && styles.moodButtonPressed,
                  ]}
                >
                  <View
                    style={[styles.moodHalo, { backgroundColor: item.glow }]}
                  />
                  <Text style={styles.moodGlyph}>{item.label.slice(0, 1)}</Text>
                  <Text style={styles.moodLabel}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.cardsRow}>
            <Animated.View
              entering={FadeInLeft.duration(450)}
              style={styles.miniCard}
            >
              <View style={styles.miniCardTop}>
                <View style={styles.cardBadge}>
                  <Icon name="calendar-heart" size={14} color="#F4D8EB" />
                  <Text style={styles.cardBadgeText}>Cycle</Text>
                </View>
                <Text style={styles.cardValue}>
                  {cycleSummary?.nextPeriodShort ?? "Apr 12"}
                </Text>
                <Text style={styles.cardSubtitle}>Next period</Text>
              </View>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyFill,
                    {
                      width: `${Math.round((cycleSummary?.cycleProgress ?? 0.42) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Pressable
                style={styles.cardAction}
                onPress={() => router.push("/(tabs)/cycle")}
              >
                <Text style={styles.cardActionText}>Track cycle</Text>
              </Pressable>
            </Animated.View>

            <Animated.View
              entering={FadeInRight.duration(450)}
              style={styles.miniCard}
            >
              <View style={styles.miniCardTop}>
                <View style={[styles.cardBadge, styles.cardBadgeAlt]}>
                  <Icon name="shield-check" size={14} color="#D5C5FF" />
                  <Text style={styles.cardBadgeText}>Self-check</Text>
                </View>
                <Text style={styles.cardValue}>
                  {checkSummary?.nextShort ?? "Apr 8"}
                </Text>
                <Text style={styles.cardSubtitle}>Reminder due</Text>
              </View>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyFill,
                    styles.energyFillAlt,
                    {
                      width: `${Math.round((checkSummary?.progress ?? 0.3) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Pressable
                style={styles.cardAction}
                onPress={() => router.push("/(tabs)/detection")}
              >
                <Text style={styles.cardActionText}>Open check</Text>
              </Pressable>
            </Animated.View>
          </View>

          <Animated.View
            entering={FadeInDown.duration(450).delay(70)}
            style={styles.wideCard}
          >
            <View style={styles.wideIcon}>
              <Icon name="chart" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.wideText}>
              <Text style={styles.wideLabel}>Today</Text>
              <Text style={styles.wideValue}>
                {reminderSummary.pending} reminders left in your timeline
              </Text>
              <Text style={styles.wideSub}>{reminderSummary.subtitle}</Text>
            </View>
            <View style={styles.wideChip}>
              <Text style={styles.wideChipText}>AI</Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(450).delay(110)}
            style={styles.quickRail}
          >
            <Pressable
              style={styles.quickItem}
              onPress={() => router.push("/(tabs)/detection")}
            >
              <Icon name="heart-pulse" size={20} color="#FFE7F5" />
              <Text style={styles.quickLabel}>Check</Text>
            </Pressable>
            <Pressable
              style={styles.quickItem}
              onPress={() => router.push("/(tabs)/cycle")}
            >
              <Icon name="calendar-heart" size={20} color="#DFFBFF" />
              <Text style={styles.quickLabel}>Cycle</Text>
            </Pressable>
            <Pressable
              style={styles.quickItem}
              onPress={() => router.push("/(tabs)/todo")}
            >
              <Icon name="notebook" size={20} color="#FFF5D8" />
              <Text style={styles.quickLabel}>Reminders</Text>
            </Pressable>
            <Pressable
              style={styles.quickItem}
              onPress={() => router.push("/modal")}
            >
              <Icon name="user" size={20} color="#ECE3FF" />
              <Text style={styles.quickLabel}>Profile</Text>
            </Pressable>
            <Pressable
              style={styles.quickItem}
              onPress={() => router.push("/(tabs)/report")}
            >
              <Icon name="chart" size={20} color="#CFF9FF" />
              <Text style={styles.quickLabel}>Report</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ScrollView>

      <Pressable style={styles.askAiFab} onPress={() => setChatVisible(true)}>
        <Icon name="chat" size={18} color="#FDF6FB" />
        <Text style={styles.askAiFabText}>Ask AI</Text>
      </Pressable>
      <Pressable
        style={styles.reportFab}
        onPress={() => router.push("/(tabs)/report")}
      >
        <Icon name="chart" size={18} color="#F2FBFF" />
        <Text style={styles.reportFabText}>Report</Text>
      </Pressable>

      <Modal
        visible={chatVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.chatBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.chatSheet}
          >
            <View style={styles.chatHeader}>
              <View style={styles.chatTitleRow}>
                <Icon name="chat" size={16} color="#F6D9EC" />
                <Text style={styles.chatTitle}>Ask AI</Text>
              </View>
              <Pressable
                onPress={() => setChatVisible(false)}
                style={styles.chatClose}
              >
                <Text style={styles.chatCloseText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((message, idx) => (
                <View
                  key={`${message.role}-${idx}`}
                  style={[
                    styles.chatBubble,
                    message.role === "user"
                      ? styles.chatBubbleUser
                      : styles.chatBubbleAssistant,
                  ]}
                >
                  <Text style={styles.chatBubbleText}>{message.text}</Text>
                </View>
              ))}
              {chatLoading ? (
                <View
                  style={[
                    styles.chatBubble,
                    styles.chatBubbleAssistant,
                    styles.chatLoadingRow,
                  ]}
                >
                  <ActivityIndicator color="#EBC8DF" size="small" />
                  <Text style={styles.chatLoadingText}>Thinking…</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                style={styles.chatInput}
                placeholder="Ask about your cycle..."
                placeholderTextColor="#8E9AB3"
                multiline
              />
              <Pressable
                onPress={onSendChat}
                style={({ pressed }) => [
                  styles.chatSendBtn,
                  pressed && styles.chatSendPressed,
                ]}
              >
                <Text style={styles.chatSendText}>Send</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#060912",
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  bgGlowOne: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(58, 227, 255, 0.14)",
  },
  bgGlowTwo: {
    position: "absolute",
    left: -110,
    top: 150,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(228, 95, 179, 0.12)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  dateLabel: {
    color: "#7F8DAA",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: Fonts.sans,
  },
  topTitle: {
    color: "#F5F8FF",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
    fontFamily: Fonts.sans,
  },
  hero: {
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "#11182A",
    borderWidth: 1,
    borderColor: "rgba(140, 170, 255, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    marginBottom: 18,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  heroSparkOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(90, 190, 255, 0.10)",
    top: -72,
    right: -58,
  },
  heroSparkTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(228, 95, 179, 0.10)",
    left: -48,
    bottom: -54,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  weekDay: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  weekDayToday: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  weekDayPeriod: {
    backgroundColor: "rgba(228, 95, 179, 0.16)",
    borderColor: "rgba(228, 95, 179, 0.22)",
  },
  weekDayOvulation: {
    backgroundColor: "rgba(73, 194, 214, 0.16)",
    borderColor: "rgba(73, 194, 214, 0.22)",
  },
  weekDayLabel: {
    color: "#93A1BA",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
    fontFamily: Fonts.sans,
  },
  weekDayLabelToday: {
    color: "#FFFFFF",
  },
  weekDayNum: {
    color: "#D5DEED",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  weekDayNumToday: {
    color: "#FFFFFF",
  },
  heroMain: {
    alignItems: "center",
  },
  heroEyebrow: {
    color: "#A3B1CF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
    fontFamily: Fonts.sans,
  },
  heroCountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  heroCount: {
    color: "#F7F9FF",
    fontSize: 62,
    lineHeight: 62,
    fontFamily: Fonts.serif,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  heroUnit: {
    color: "#9FDCEA",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    marginLeft: 8,
    fontFamily: Fonts.sans,
    textTransform: "lowercase",
  },
  heroSub: {
    color: "#B9C5DB",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
    maxWidth: 230,
    fontFamily: Fonts.sans,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Pink.primary,
  },
  heroButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "lowercase",
    fontFamily: Fonts.sans,
  },
  body: {
    paddingBottom: 10,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 4,
  },
  greetingHi: {
    color: "#8E9AB4",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  greetingName: {
    color: "#F6F8FF",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Fonts.sans,
  },
  feelingQuestion: {
    color: "#F1F4FB",
    fontSize: 28,
    lineHeight: 32,
    marginBottom: 18,
    fontFamily: Fonts.serif,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 8,
  },
  moodButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  moodButtonActive: {
    transform: [{ scale: 1.08 }],
    borderColor: "rgba(255,255,255,0.36)",
  },
  moodButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 1.03 }],
  },
  moodHalo: {
    position: "absolute",
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderRadius: 999,
  },
  moodGlyph: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    fontFamily: Fonts.sans,
  },
  moodLabel: {
    position: "absolute",
    bottom: -18,
    color: "#98A6BF",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: Fonts.sans,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
  },
  miniCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(17, 24, 42, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(140, 170, 255, 0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  miniCardTop: {
    marginBottom: 12,
  },
  cardBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 12,
  },
  cardBadgeAlt: {
    backgroundColor: "rgba(132, 96, 255, 0.14)",
  },
  cardBadgeText: {
    color: "#D9E3F6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: Fonts.sans,
  },
  cardValue: {
    color: "#F7F9FF",
    fontSize: 21,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily: Fonts.serif,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: "#8F9BB5",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  energyBar: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 2,
    marginBottom: 12,
  },
  energyFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Pink.primary,
  },
  energyFillAlt: {
    backgroundColor: "#8A74FF",
  },
  cardAction: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardActionText: {
    color: "#F3F6FF",
    fontSize: 12,
    fontWeight: "800",
    fontFamily: Fonts.sans,
  },
  wideCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  wideIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(228, 95, 179, 0.92)",
  },
  wideText: {
    flex: 1,
  },
  wideLabel: {
    color: "#9AA7C0",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 2,
    fontFamily: Fonts.sans,
  },
  wideValue: {
    color: "#F8FAFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  wideSub: {
    color: "#8C98B1",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    fontFamily: Fonts.sans,
  },
  wideChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(73, 194, 214, 0.16)",
  },
  wideChipText: {
    color: "#8AE9F7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    fontFamily: Fonts.sans,
  },
  quickRail: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  quickItem: {
    flex: 1,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(17, 24, 42, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickLabel: {
    color: "#DCE4F3",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Fonts.sans,
  },
  askAiFab: {
    position: "absolute",
    right: 16,
    bottom: 98,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(229, 99, 185, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  askAiFabText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    fontFamily: Fonts.sans,
    letterSpacing: 0.2,
  },
  reportFab: {
    position: "absolute",
    right: 16,
    bottom: 152,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(73, 194, 214, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  reportFabText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    fontFamily: Fonts.sans,
    letterSpacing: 0.2,
  },
  chatBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.65)",
    justifyContent: "flex-end",
  },
  chatSheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#0F1627",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  chatTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatTitle: {
    color: "#F8FAFF",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: Fonts.serif,
  },
  chatClose: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chatCloseText: {
    color: "#F0F4FF",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  chatList: {
    maxHeight: 360,
  },
  chatListContent: {
    gap: 8,
    paddingBottom: 10,
  },
  chatBubble: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
    maxWidth: "90%",
    borderWidth: 1,
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(229, 99, 185, 0.22)",
    borderColor: "rgba(229, 99, 185, 0.4)",
  },
  chatBubbleText: {
    color: "#EAF0FF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.sans,
  },
  chatLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatLoadingText: {
    color: "#C8D4EA",
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "#F4F7FF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  chatSendBtn: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(73, 194, 214, 0.9)",
  },
  chatSendPressed: {
    opacity: 0.85,
  },
  chatSendText: {
    color: "#081321",
    fontSize: 12,
    fontWeight: "900",
    fontFamily: Fonts.sans,
  },
});
