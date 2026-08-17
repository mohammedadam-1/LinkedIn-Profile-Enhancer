import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import conf from "../conf/conf.js";
import { logger } from "../observability/logger.js";

class ChromeStarter {
    async isRunning() {
        try {
            const response = await fetch(`${conf.browserCdpUrl}/json/version`, {
                signal: AbortSignal.timeout(2_000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async ensureChrome() {
        if (await this.isRunning()) {
            logger.info("chrome_already_running", { cdpUrl: conf.browserCdpUrl });
            return true;
        }
        return this.launchChrome();
    }

    async launchChrome() {
        const userDataDir = path.resolve(conf.chromeUserDataDir);
        fs.mkdirSync(userDataDir, { recursive: true });

        let executable;
        try {
            executable = chromium.executablePath();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error("chrome_executable_missing", { error: message });
            throw new Error(`Chrome executable not found. Run "npx playwright install chromium" first.`);
        }

        const port = new URL(conf.browserCdpUrl).port;
        const args = [
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${userDataDir}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-sandbox",
            "--disable-gpu",
            conf.chromeStartUrl,
        ];
        if (conf.chromeHeadless) args.unshift("--headless=new");

        logger.info("chrome_launching", { executable, userDataDir, headless: conf.chromeHeadless });
        const child = spawn(executable, args, { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();

        if (!(await this.waitForCdp())) {
            throw new Error(`Chrome failed to open CDP at ${conf.browserCdpUrl} within 30 seconds.`);
        }
        logger.info("chrome_ready", { cdpUrl: conf.browserCdpUrl, userDataDir });
        return true;
    }

    async waitForCdp(timeoutMs = 30_000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (await this.isRunning()) return true;
            await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
        return false;
    }
}

export default new ChromeStarter();
