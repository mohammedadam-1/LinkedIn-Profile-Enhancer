export function parseCsv(input) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        if (char === '"') {
            if (quoted && input[i + 1] === '"') { field += '"'; i += 1; }
            else quoted = !quoted;
        } else if (char === ',' && !quoted) { row.push(field.trim()); field = ""; }
        else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && input[i + 1] === '\n') i += 1;
            row.push(field.trim());
            if (row.some(Boolean)) rows.push(row);
            row = []; field = "";
        } else field += char;
    }
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
}

export function buildRecords(headers, rows) {
    const required = ["linkedin_url"];
    if (!required.every((header) => headers.includes(header))) {
        throw new Error("CSV must contain linkedin_url.");
    }

    const urlColumn = headers.indexOf("linkedin_url");
    const sanitized = [];
    for (const [index, row] of rows.entries()) {
        const url = (row[urlColumn] ?? "").replaceAll('"', "").replaceAll("'", "").trim();
        if (!url) continue;
        row[urlColumn] = url;
        sanitized.push({ row, line: index + 2 });
    }
    const dropped = rows.length - sanitized.length;

    const records = [];
    let invalidUrls = 0;
    for (const { row, line } of sanitized) {
        const record = Object.fromEntries(headers.map((header, column) => [header, row[column] || null]));
        let url;
        try {
            url = new URL(record.linkedin_url);
        } catch {
            invalidUrls += 1;
            continue;
        }
        if (url.protocol !== "https:" || url.hostname !== "www.linkedin.com") {
            invalidUrls += 1;
            continue;
        }
        const status = record.status || "active";
        if (!['active', 'paused'].includes(status)) throw new Error(`Row ${line}: status must be active or paused.`);
        const refreshIntervalDays = Number(record.refresh_interval_days || 7);
        if (!Number.isInteger(refreshIntervalDays) || refreshIntervalDays < 1 || refreshIntervalDays > 365) {
            throw new Error(`Row ${line}: refresh_interval_days must be an integer between 1 and 365.`);
        }
        records.push({
            linkedin_url: url.toString(),
            display_name: record.display_name ?? null,
            team: record.team ?? null,
            status,
            refresh_interval_days: refreshIntervalDays,
        });
    }

    const seenUrls = new Set();
    const uniqueRecords = [];
    let duplicates = 0;
    for (const record of records) {
        if (seenUrls.has(record.linkedin_url)) {
            duplicates += 1;
            continue;
        }
        seenUrls.add(record.linkedin_url);
        uniqueRecords.push(record);
    }

    return { records: uniqueRecords, dropped, invalidUrls, duplicates };
}

export async function importRecords(client, records) {
    let imported = 0;
    for (let start = 0; start < records.length; start += 100) {
        const batch = records.slice(start, start + 100);
        for (let attempt = 0; ; attempt += 1) {
            const { error } = await client.from("profiles").upsert(batch, { onConflict: "linkedin_url" });
            if (!error) break;
            if (attempt === 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
        }
        imported += batch.length;
    }
    return imported;
}
