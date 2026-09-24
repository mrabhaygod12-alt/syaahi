import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { kickWorker } from "../lib/jobs/worker";
kickWorker();
console.log("Syaahi durable worker running.");
setInterval(() => {}, 60000);
