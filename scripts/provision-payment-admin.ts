/** Explicit operator CLI. Reads credentials from stdin; never put a password in arguments. */
import { readFileSync, writeFileSync } from "node:fs";
async function main() {
  const envFile = process.argv[2];
  if (!envFile) throw new Error("Pass the private server env file path.");
  process.loadEnvFile(envFile);
  const input = JSON.parse(readFileSync(0, "utf8"));
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const password = String(input.password || "");
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("Invalid account details.");
  const { useMongo, mongo, mongoTransaction } =
    await import("../lib/storage/mongo");
  if (!useMongo())
    throw new Error("Select the production MongoDB configuration.");
  try {
    const { register, accountByEmail, passwordHash } =
      await import("../lib/auth/server");
    let account = await accountByEmail(email);
    const id = account
      ? String(account.id)
      : (await register("Payment administrator", email, password)).id;
    await mongoTransaction(async (d, session) => {
      const opts = { session };
      await d
        .collection<any>("users")
        .updateOne(
          { _id: id },
          { $set: { password: passwordHash(password) } },
          opts,
        );
      // Operator explicitly provisions this trusted account; no referral reward is issued here.
      await d.collection<any>("verified_accounts").updateOne(
        { _id: id },
        {
          $setOnInsert: {
            verifiedAt: new Date(),
            source: "operator-provisioned",
          },
        },
        { ...opts, upsert: true },
      );
      await d
        .collection<any>("payment_admins")
        .updateOne(
          { _id: id },
          { $set: { active: true, provisionedAt: new Date() } },
          { ...opts, upsert: true },
        );
      await d.collection<any>("sessions").deleteMany({ user: id }, opts);
    });
    const lines = readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((l) => !l.startsWith("PAYMENT_ADMIN_IDS="));
    const prior = (process.env.PAYMENT_ADMIN_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    lines.push(`PAYMENT_ADMIN_IDS=${[...new Set([...prior, id])].join(",")}`);
    writeFileSync(envFile, lines.join("\n"));
    console.log(
      "Payment administrator provisioned; password hashed, prior sessions revoked, private env updated. Account ID:",
      id,
    );
  } finally {
    await (await mongo()).client.close();
  }
}
main().catch((e) => {
  console.error("Provisioning failed:", e?.name || "Error");
  process.exitCode = 1;
});
