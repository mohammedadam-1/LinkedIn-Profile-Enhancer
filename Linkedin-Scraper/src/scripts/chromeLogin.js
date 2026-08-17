import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import conf from "../conf/conf.js";

const userDataDir = path.resolve(conf.chromeUserDataDir);
fs.mkdirSync(userDataDir, { recursive: true });

const executable = chromium.executablePath();
const port = new URL(conf.browserCdpUrl).port;

console.log(`Opening Chrome with profile: ${userDataDir}`);
console.log("Sign in to LinkedIn in the Chrome window, then close it. The session is saved for the worker.");

const child = spawn(
    executable,
    [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--no-sandbox",
        "--disable-gpu",
        "https://www.linkedin.com/login",
    ],
    { stdio: "inherit" }
);

child.on("exit", () => process.exit(0));
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());