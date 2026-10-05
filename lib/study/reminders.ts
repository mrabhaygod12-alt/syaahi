import { collection, useMongo } from "@/lib/storage/mongo";

type Reminder = {
  enabled?: boolean;
  hour?: number;
  timezone?: string;
  lastSent?: string;
  email?: boolean;
};

function currentHour(timezone: string) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );
  } catch {
    return -1;
  }
}

async function sendReminder(email: string, event: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.syaahii.in";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": event,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Your Syaahi study reminder",
      text: `A short review session is ready. Continue your saved lessons and flashcards: ${appUrl}/dashboard\n\nYou can change study reminders in your dashboard.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok;
}

/** Runs from the external worker. Mongo is required because the worker has no local SQLite volume. */
export async function deliverStudyReminders() {
  if (!useMongo()) return { delivered: 0, skipped: "mongo-not-configured" };
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return { delivered: 0, skipped: "email-not-configured" };
  const state = await collection("study_state");
  const users = await collection("users");
  const records = await state
    .find({ _id: /:learning$/ })
    .limit(1000)
    .toArray();
  let delivered = 0;
  for (const record of records) {
    const reminder = (record.payload?.reminder || {}) as Reminder;
    const hour = Number(reminder.hour);
    const timezone =
      typeof reminder.timezone === "string" ? reminder.timezone : "UTC";
    const resolvedHour = currentHour(timezone);
    if (resolvedHour < 0) continue;
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: timezone,
    });
    if (
      !reminder.email ||
      !Number.isInteger(hour) ||
      hour !== resolvedHour ||
      reminder.lastSent === today
    )
      continue;
    const user = await users.findOne({ _id: record.owner });
    if (!user?.email) continue;
    const event = `study-reminder:${record.owner}:${today}`;
    // Claim before contacting the provider; expired claims may retry with the same provider idempotency key.
    const claimed = await state.updateOne(
      {
        _id: record._id,
        "payload.reminder.lastSent": { $ne: today },
        $or: [
          { "payload.reminder.claimUntil": { $exists: false } },
          { "payload.reminder.claimUntil": { $lt: Date.now() } },
        ],
      },
      { $set: { "payload.reminder.claimUntil": Date.now() + 60000 } },
    );
    if (!claimed.modifiedCount) continue;
    let ok = false;
    try {
      ok = await sendReminder(String(user.email), event);
    } catch {}
    if (!ok) {
      await state.updateOne(
        { _id: record._id },
        { $set: { "payload.reminder.claimUntil": 0 } },
      );
      continue;
    }
    await state.updateOne(
      { _id: record._id, "payload.reminder.lastSent": { $ne: today } },
      {
        $set: {
          "payload.reminder.lastSent": today,
          "payload.reminder.claimUntil": 0,
        },
        $push: {
          "payload.reminder.history": {
            $each: [
              {
                day: today,
                channel: "email",
                status: "delivered",
                at: new Date().toISOString(),
              },
            ],
            $slice: -30,
          },
        },
      } as any,
    );
    delivered++;
  }
  return { delivered };
}
