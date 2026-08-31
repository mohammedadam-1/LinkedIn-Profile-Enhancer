    import dotenv from "dotenv";

    dotenv.config({ quiet: true });

    const numberFromEnv = (name, fallback, minimum, maximum) => {
        const value = Number(process.env[name] ?? fallback);
        if (!Number.isFinite(value) || value < minimum || value > maximum) {
            throw new Error(`${name} must be a number between ${minimum} and ${maximum}.`);
        }
        return value;
    };

    const conf = {
        groqCloudApi2: process.env.GROQ_CLOUD_API_KEY2,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        maxProfilesPerRun: numberFromEnv("MAX_PROFILES_PER_RUN", 25, 1, 500),
        runLockMinutes: numberFromEnv("RUN_LOCK_MINUTES", 180, 5, 1_440),
        llmRequestDelayMs: numberFromEnv("LLM_REQUEST_DELAY_MS", 60_000, 0, 300_000),
        llmTimeoutMs: numberFromEnv("LLM_TIMEOUT_MS", 45_000, 5_000, 300_000),
        browserCdpUrl: process.env.BROWSER_CDP_URL || "http://127.0.0.1:8222",
        chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || "./.chrome-profile",
        chromeHeadless: process.env.CHROME_HEADLESS,
        chromeStartUrl: process.env.CHROME_START_URL || "about:blank",
    }


    export default conf
