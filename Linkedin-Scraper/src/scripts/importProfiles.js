import fs from "node:fs/promises";
import database from "../database/supabaseService.js";
import { parseCsv, buildRecords, importRecords } from "./csvImport.js";

const filePath = process.argv[2];
if (!filePath) throw new Error("Usage: npm run import:profiles -- path/to/profiles.csv");

const [headers, ...rows] = parseCsv(await fs.readFile(filePath, "utf8"));
const { records, dropped, invalidUrls, duplicates } = buildRecords(headers, rows);
if (dropped) console.log(`Dropped ${dropped} row(s) with a missing linkedin_url.`);
if (invalidUrls) console.log(`Dropped ${invalidUrls} row(s) with an invalid linkedin_url.`);
if (duplicates) console.log(`Dropped ${duplicates} row(s) with a duplicate linkedin_url within the file.`);

await database.init();
const imported = await importRecords(database.client, records);
console.log(`Imported ${imported} profile(s).`);
