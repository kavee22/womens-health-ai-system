import * as Notifications from "expo-notifications";

let initialized = false;
export type ReminderRecurrence = "none" | "daily" | "monthly" | "yearly";

export function initializeNotifications() {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission() {
  initializeNotifications();

  const settings = await Notifications.getPermissionsAsync();
  if (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export function combineDateAndTime(dateYmd: string, timeHm: string) {
  const [y, m, d] = dateYmd.split("-").map((v) => Number(v));
  const [h, min] = timeHm.split(":").map((v) => Number(v));
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0);
}

export async function scheduleSingleNotification(args: {
  title: string;
  body: string;
  when: Date;
}) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;
  if (
    !Number.isFinite(args.when.getTime()) ||
    args.when.getTime() <= Date.now()
  )
    return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: args.when,
    },
  });
}

export async function scheduleRecurringNotification(args: {
  title: string;
  body: string;
  when: Date;
  recurrence: Exclude<ReminderRecurrence, "none">;
}) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;
  if (!Number.isFinite(args.when.getTime())) return null;

  const hour = args.when.getHours();
  const minute = args.when.getMinutes();
  const day = args.when.getDate();
  const month = args.when.getMonth() + 1;

  let trigger: Notifications.NotificationTriggerInput;
  if (args.recurrence === "daily") {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };
  } else if (args.recurrence === "monthly") {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day,
      hour,
      minute,
    };
  } else {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      month,
      day,
      hour,
      minute,
    };
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      sound: true,
    },
    trigger,
  });
}

export async function cancelScheduledNotification(
  notificationId?: string | null,
) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignore if already removed or unknown.
  }
}

export async function showInstantNotification(args: {
  title: string;
  body: string;
}) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;
  return Notifications.presentNotificationAsync({
    title: args.title,
    body: args.body,
    sound: true,
  });
}

export function formatDateLabel(ymd: string) {
  if (!ymd || typeof ymd !== "string" || !ymd.includes("-")) {
    return "Unknown date";
  }
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
