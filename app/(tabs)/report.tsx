import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { onValue, ref } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileIconButton } from "@/components/profile-icon-button";
import { Fonts } from "@/constants/theme";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";

type MoodKey = "tired" | "energized" | "loving" | "calm" | "bright";
type MoodLog = { mood?: MoodKey; updatedAt?: number };
type TodoItem = { done?: boolean; dueAt?: number; createdAt?: number };
type CycleLog = { energy?: number; updatedAt?: number };
type CycleData = { lastPeriodStart?: string; updatedAt?: number };
type DetectionData = { lastSelfCheck?: string; updatedAt?: number };
type ScanResult = {
  type?: "risk-form" | "xray";
  predictionLabel?: string;
  probability?: number;
  score?: number;
  class?: number;
  createdAt?: number;
};

function monthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profileAvatarUri, profileName } = useAuth();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [moodLogs, setMoodLogs] = useState<Record<string, MoodLog> | null>(
    null,
  );
  const [todos, setTodos] = useState<Record<string, TodoItem> | null>(null);
  const [cycleLogs, setCycleLogs] = useState<Record<string, CycleLog> | null>(
    null,
  );
  const [cycleData, setCycleData] = useState<CycleData | null>(null);
  const [detectionData, setDetectionData] = useState<DetectionData | null>(
    null,
  );
  const [scanResults, setScanResults] = useState<Record<
    string,
    ScanResult
  > | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubMood = onValue(ref(db, `users/${user.uid}/moodLogs`), (snap) =>
      setMoodLogs((snap.val() as Record<string, MoodLog> | null) ?? null),
    );
    const unsubTodos = onValue(ref(db, `users/${user.uid}/todos`), (snap) =>
      setTodos((snap.val() as Record<string, TodoItem> | null) ?? null),
    );
    const unsubCycleLogs = onValue(
      ref(db, `users/${user.uid}/cycleLogs`),
      (snap) =>
        setCycleLogs((snap.val() as Record<string, CycleLog> | null) ?? null),
    );
    const unsubCycle = onValue(ref(db, `users/${user.uid}/cycle`), (snap) =>
      setCycleData((snap.val() as CycleData | null) ?? null),
    );
    const unsubDetection = onValue(
      ref(db, `users/${user.uid}/detection`),
      (snap) => setDetectionData((snap.val() as DetectionData | null) ?? null),
    );
    const unsubScans = onValue(
      ref(db, `users/${user.uid}/scanResults`),
      (snap) =>
        setScanResults(
          (snap.val() as Record<string, ScanResult> | null) ?? null,
        ),
    );
    return () => {
      unsubMood();
      unsubTodos();
      unsubCycleLogs();
      unsubCycle();
      unsubDetection();
      unsubScans();
    };
  }, [user]);

  const report = useMemo(() => {
    const key = monthKey(monthDate);
    const moodCounts: Record<MoodKey, number> = {
      tired: 0,
      energized: 0,
      loving: 0,
      calm: 0,
      bright: 0,
    };
    let moodEntries = 0;
    Object.entries(moodLogs ?? {}).forEach(([ymd, row]) => {
      if (!ymd.startsWith(key) || !row?.mood) return;
      moodCounts[row.mood] += 1;
      moodEntries += 1;
    });

    const moodSorted = (Object.keys(moodCounts) as MoodKey[]).sort(
      (a, b) => moodCounts[b] - moodCounts[a],
    );
    const topMood = moodEntries ? moodSorted[0] : null;

    let remindersTotal = 0;
    let remindersDone = 0;
    Object.values(todos ?? {}).forEach((item) => {
      const t = Number(item?.dueAt || item?.createdAt || 0);
      if (!t) return;
      const d = new Date(t);
      if (monthKey(d) !== key) return;
      remindersTotal += 1;
      if (item?.done) remindersDone += 1;
    });

    let energyCount = 0;
    let energySum = 0;
    Object.entries(cycleLogs ?? {}).forEach(([ymd, row]) => {
      if (!ymd.startsWith(key)) return;
      const energy = Number(row?.energy || 0);
      if (energy > 0) {
        energySum += energy;
        energyCount += 1;
      }
    });

    const avgEnergy = energyCount ? (energySum / energyCount).toFixed(1) : "--";
    const cycleUpdatedThisMonth =
      !!cycleData?.updatedAt && monthKey(new Date(cycleData.updatedAt)) === key;
    const selfCheckThisMonth =
      !!detectionData?.lastSelfCheck &&
      detectionData.lastSelfCheck.startsWith(key);

    const monthScans = Object.values(scanResults ?? {})
      .filter(
        (row) => row?.createdAt && monthKey(new Date(row.createdAt)) === key,
      )
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const riskScans = monthScans.filter((row) => row.type === "risk-form");
    const xrayScans = monthScans.filter((row) => row.type === "xray");
    const latestScan = monthScans[0] ?? null;

    return {
      moodCounts,
      moodEntries,
      topMood,
      remindersTotal,
      remindersDone,
      remindersPending: Math.max(0, remindersTotal - remindersDone),
      avgEnergy,
      cycleUpdatedThisMonth,
      selfCheckThisMonth,
      riskScansCount: riskScans.length,
      xrayScansCount: xrayScans.length,
      latestScan,
      monthScans,
    };
  }, [
    monthDate,
    moodLogs,
    todos,
    cycleLogs,
    cycleData,
    detectionData,
    scanResults,
  ]);

  async function downloadReport() {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Pink Care Monthly Health Report</h1>
          <p><strong>Month:</strong> ${formatMonthLabel(monthDate)}</p>
          <h2>Mood Summary</h2>
          <p>Entries: ${report.moodEntries}</p>
          <p>Top mood: ${report.topMood ?? "--"}</p>
          <ul>
            ${Object.entries(report.moodCounts)
              .map(([name, count]) => `<li>${name}: ${count}</li>`)
              .join("")}
          </ul>
          <h2>Reminder Activity</h2>
          <p>Total reminders: ${report.remindersTotal}</p>
          <p>Completed: ${report.remindersDone}</p>
          <p>Pending: ${report.remindersPending}</p>
          <h2>Health Tracking</h2>
          <p>Average energy score: ${report.avgEnergy}</p>
          <p>Cycle data updated this month: ${report.cycleUpdatedThisMonth ? "Yes" : "No"}</p>
          <p>Self-check marked this month: ${report.selfCheckThisMonth ? "Yes" : "No"}</p>
          <h2>Scan Results</h2>
          <p>Risk-form scans: ${report.riskScansCount}</p>
          <p>X-Ray scans: ${report.xrayScansCount}</p>
          <p>Latest scan: ${report.latestScan?.predictionLabel ?? "--"}</p>
          <h3>Recent scans</h3>
          <ul>
            ${report.monthScans
              .map((scan) => {
                const dt = scan.createdAt
                  ? new Date(scan.createdAt).toLocaleDateString()
                  : "--";
                const model = scan.type === "xray" ? "X-Ray" : "Risk form";
                const result = scan.predictionLabel ?? "--";
                const extra =
                  typeof scan.probability === "number"
                    ? ` (${(scan.probability * 100).toFixed(2)}%)`
                    : typeof scan.score === "number"
                      ? ` (score: ${scan.score})`
                      : "";
                return `<li>${dt} - ${model}: ${result}${extra}</li>`;
              })
              .join("")}
          </ul>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Download monthly health report",
        UTI: "com.adobe.pdf",
      });
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 10,
            paddingBottom: Math.max(insets.bottom, 110),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.dateLabel}>
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text style={styles.topTitle}>Monthly health report</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <ProfileIconButton
              name={profileName ?? user?.displayName}
              avatarUri={profileAvatarUri ?? user?.photoURL}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() =>
                setMonthDate(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                )
              }
              style={({ pressed }) => [
                styles.navBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.navText}>Prev</Text>
            </Pressable>
            <Text style={styles.monthText}>{formatMonthLabel(monthDate)}</Text>
            <Pressable
              onPress={() =>
                setMonthDate(
                  (prev) =>
                    new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                )
              }
              style={({ pressed }) => [
                styles.navBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.navText}>Next</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void downloadReport()}
            style={({ pressed }) => [
              styles.downloadBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.downloadBtnText}>Download Report (PDF)</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mood summary</Text>
          <Text style={styles.cardSub}>
            From “How are you feeling today?” selections.
          </Text>
          <Text style={styles.metric}>Entries: {report.moodEntries}</Text>
          <Text style={styles.metric}>Top mood: {report.topMood ?? "--"}</Text>
          <View style={styles.moodGrid}>
            {(Object.entries(report.moodCounts) as [MoodKey, number][]).map(
              ([name, count]) => (
                <View key={name} style={styles.moodPill}>
                  <Text style={styles.moodName}>{name}</Text>
                  <Text style={styles.moodCount}>{count}</Text>
                </View>
              ),
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reminder activity</Text>
          <Text style={styles.metric}>
            Total reminders: {report.remindersTotal}
          </Text>
          <Text style={styles.metric}>Completed: {report.remindersDone}</Text>
          <Text style={styles.metric}>Pending: {report.remindersPending}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health tracking</Text>
          <Text style={styles.metric}>
            Average energy score: {report.avgEnergy}
          </Text>
          <Text style={styles.metric}>
            Cycle data updated this month:{" "}
            {report.cycleUpdatedThisMonth ? "Yes" : "No"}
          </Text>
          <Text style={styles.metric}>
            Self-check marked this month:{" "}
            {report.selfCheckThisMonth ? "Yes" : "No"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scan results</Text>
          <Text style={styles.metric}>
            Risk-form scans: {report.riskScansCount}
          </Text>
          <Text style={styles.metric}>
            X-Ray scans: {report.xrayScansCount}
          </Text>
          <Text style={styles.metric}>
            Latest result: {report.latestScan?.predictionLabel ?? "--"}
          </Text>
          {typeof report.latestScan?.probability === "number" ? (
            <Text style={styles.metric}>
              Latest probability:{" "}
              {(report.latestScan.probability * 100).toFixed(3)}%
            </Text>
          ) : null}
          {typeof report.latestScan?.score === "number" ? (
            <Text style={styles.metric}>
              Latest risk score: {report.latestScan.score}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent scans history</Text>
          {report.monthScans.length ? (
            report.monthScans.slice(0, 8).map((scan, idx) => {
              const date = scan.createdAt
                ? new Date(scan.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "--";
              const model = scan.type === "xray" ? "X-Ray" : "Risk form";
              const detail =
                typeof scan.probability === "number"
                  ? `${(scan.probability * 100).toFixed(2)}%`
                  : typeof scan.score === "number"
                    ? `score ${scan.score}`
                    : "--";
              return (
                <View
                  key={`${scan.createdAt ?? idx}-${idx}`}
                  style={styles.scanRow}
                >
                  <Text style={styles.scanDate}>{date}</Text>
                  <View style={styles.scanBody}>
                    <Text style={styles.scanModel}>{model}</Text>
                    <Text style={styles.scanResult}>
                      {scan.predictionLabel ?? "--"}
                    </Text>
                  </View>
                  <Text style={styles.scanMeta}>{detail}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.cardSub}>
              No scans recorded for this month yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#060912" },
  container: { paddingHorizontal: 16, gap: 12 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  backText: { color: "#EFF4FF", fontWeight: "800", fontFamily: Fonts.sans },
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
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
    fontFamily: Fonts.serif,
  },
  card: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(17, 24, 42, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(140, 170, 255, 0.14)",
    gap: 8,
  },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthText: {
    color: "#F6F8FF",
    fontWeight: "900",
    fontSize: 15,
    fontFamily: Fonts.sans,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  navText: { color: "#EFF4FF", fontWeight: "800", fontFamily: Fonts.sans },
  downloadBtn: {
    marginTop: 8,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8A74FF",
    borderWidth: 1,
    borderColor: "#7861EF",
  },
  downloadBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontFamily: Fonts.sans,
  },
  cardTitle: {
    color: "#F6F8FF",
    fontSize: 17,
    fontWeight: "800",
    fontFamily: Fonts.serif,
  },
  cardSub: {
    color: "#9DACC8",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  metric: {
    color: "#E6ECFA",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  moodPill: {
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  moodName: {
    color: "#C9D6EE",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
    fontFamily: Fonts.sans,
  },
  moodCount: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  scanDate: {
    color: "#AFC0DD",
    fontSize: 11,
    fontWeight: "800",
    width: 54,
    fontFamily: Fonts.sans,
  },
  scanBody: { flex: 1, gap: 2 },
  scanModel: {
    color: "#DFE8F8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    fontFamily: Fonts.sans,
  },
  scanResult: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  scanMeta: {
    color: "#B6C7E3",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Fonts.sans,
  },
  pressed: { opacity: 0.75 },
});
