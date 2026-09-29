/** Simulated provider frames: never connects to Gemini or records a real microphone. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

async function main() {
  const base = "http://localhost:3137";
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3137"],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        APP_ROLE: "all",
        BACKEND_URL: "",
        DATA_BACKEND: "sqlite",
        MONGODB_URI: "",
        DATA_DIR: mkdtempSync(join(tmpdir(), "syaahi-browser-")),
        NEXT_PUBLIC_APP_URL: base,
        WORKER_MODE: "external",
      },
    },
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(`${base}/interview`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, "Production server starts");
    browser = await chromium.launch({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      (window as any).testTracks = [];
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        (window as any).testTracks.push(...stream.getTracks());
        return stream;
      };
    });
    await page.route("**/api/**", (route) => {
      const token = route.request().url().endsWith("/interview/live-token");
      return route.fulfill({
        json: token
          ? { token: "test-ephemeral", model: "models/test-live" }
          : {},
      });
    });
    let scenario = "success",
      audioReceived = false,
      setupReceived = false;
    await page.routeWebSocket(/generativelanguage.googleapis.com/, (socket) => {
      socket.onMessage((message) => {
        const frame = JSON.parse(String(message));
        if (frame.setup) {
          assert.equal(frame.setup.model, "models/test-live");
          setupReceived = true;
          if (scenario === "success")
            socket.send(JSON.stringify({ setupComplete: {} }));
          if (scenario === "error")
            socket.send(
              JSON.stringify({ error: { message: "fixture error" } }),
            );
        }
        if (frame.realtimeInput?.audio) {
          audioReceived = true;
          assert.match(
            frame.realtimeInput.audio.mimeType,
            /^audio\/pcm;rate=\d+$/,
          );
        }
      });
    });
    await page.goto(`${base}/interview`);
    await page
      .getByRole("button", { name: "Start voice interview", exact: true })
      .click();
    await page
      .getByText("Connected. Speak naturally; use Stop when finished.", {
        exact: true,
      })
      .waitFor();
    for (let i = 0; i < 30 && !audioReceived; i++)
      await page.waitForTimeout(100);
    assert(setupReceived);
    assert(audioReceived);
    await page
      .getByRole("button", { name: "Stop voice practice", exact: true })
      .click();
    assert(
      await page.evaluate(() =>
        (window as any).testTracks.every(
          (track: MediaStreamTrack) => track.readyState === "ended",
        ),
      ),
    );
    scenario = "error";
    await page
      .getByRole("button", { name: "Start voice interview", exact: true })
      .click();
    await page
      .getByText("Voice provider rejected this session. Please retry.", {
        exact: true,
      })
      .waitFor();
    assert(
      await page.evaluate(() =>
        (window as any).testTracks.every(
          (track: MediaStreamTrack) => track.readyState === "ended",
        ),
      ),
    );
    scenario = "pending";
    await page
      .getByRole("button", { name: "Start voice interview", exact: true })
      .click();
    await page
      .getByText("Connecting to the interview coach…", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Stop voice practice", exact: true })
      .click();
    assert(
      await page.evaluate(() =>
        (window as any).testTracks.every(
          (track: MediaStreamTrack) => track.readyState === "ended",
        ),
      ),
    );
    await page.goto(`${base}/campus`);
    await page
      .getByRole("heading", { name: "Apply for the campus pilot" })
      .waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Campus page fits mobile width",
    );
    assert(
      (await fetch(`${base}/community`)).ok,
      "Community renders without client hydration",
    );
    const publications = await fetch(`${base}/api/publications`);
    assert.equal(publications.status, 200);
    assert.deepEqual((await publications.json()).stories, []);
    console.log(
      "PASS: constrained voice setup, microphone audio frames, Stop/error/connecting cleanup and mobile campus layout (mock provider).",
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
