import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import cors from "cors";
import { parseCsv, buildRecords, importRecords } from "./scripts/csvImport.js";
import database from "./database/supabaseService.js";
import chromeStarter from "./playwright/chromeStarter.js";
import { logger } from "./observability/logger.js";

const app = express();
app.use(express.json());

const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin: corsOrigins.includes("*") ? true : corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
}));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

function isCsvFile(file) {
    const name = file?.originalname || "";
    return name.toLowerCase().endsWith(".csv") || file?.mimetype === "text/csv";
}

function messageOf(error) {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object" && "message" in error) return String(error.message);
    return String(error);
}

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/profiles", async (_req, res) => {
    try {
        await database.init();
        const profiles = await database.listProfiles();
        res.json({ profiles });
    } catch (error) {
        res.status(500).json({ error: messageOf(error) });
    }
});

app.get("/api/profiles/posts", async (req, res) => {
    try {
        const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
        if (!url) {
            return res.status(400).json({ error: "url query parameter is required." });
        }

        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            return res.status(400).json({ error: "The provided URL is invalid." });
        }

        await database.init();
        const result = await database.getProfilePosts(parsed.href);
        if (!result.profile) {
            return res.status(404).json({ error: result.error });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: messageOf(error) });
    }
});

app.post("/api/profiles/import", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No CSV file uploaded." });
        }
        if (!isCsvFile(req.file)) {
            return res.status(400).json({ error: "Only CSV files are allowed." });
        }

        const csv = req.file.buffer.toString("utf8");
        const [headers, ...rows] = parseCsv(csv);
        let result;
        try {
            result = buildRecords(headers, rows);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }

        if (!result.records.length) {
            return res.status(400).json({
                error: "No valid profiles found in the CSV.",
                ...result,
            });
        }

        await database.init();
        const imported = await importRecords(database.client, result.records);
        res.json({
            imported,
            fileName: req.file.originalname,
            dropped: result.dropped,
            invalidUrls: result.invalidUrls,
            duplicates: result.duplicates,
        });
    } catch (error) {
        res.status(500).json({ error: messageOf(error) });
    }
});

app.use((error, _req, res, _next) => {
    res.status(400).json({ error: messageOf(error) });
});

export default app;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.API_PORT || 3001);
    app.listen(port, () => {
        console.log(`Profile import API listening on http://localhost:${port}`);
    });

    chromeStarter.ensureChrome().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("chrome_starter_failed", { error: message });
    });
}