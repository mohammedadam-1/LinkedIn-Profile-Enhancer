import { chromium } from "playwright";
import conf from "../conf/conf.js";
import chromeStarter from "./chromeStarter.js";

class BrowserService {
    async init() {
        await chromeStarter.ensureChrome();
        this.browser = await chromium.connectOverCDP(conf.browserCdpUrl);
        this.context = this.browser.contexts()[0];
        if (!this.context) {
            throw new Error("No browser context is available. Sign in to LinkedIn in the Chrome profile first.");
        }
    }

    async getPage() {
        if (!this.context) throw new Error("Browser not initialized.");
        if (!this.page || this.page.isClosed()) this.page = await this.context.newPage();
        return this.page;
    }

    async closeBrowser() {
        const browser = this.browser;
        this.context = null;
        this.page = null;
        this.browser = null;

        if (browser) await browser.close()
    }
}

export default new BrowserService();
