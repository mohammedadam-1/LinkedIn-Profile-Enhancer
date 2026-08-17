import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, buildRecords, importRecords } from "../src/scripts/csvImport.js";

test("parseCsv splits rows and trims fields", () => {
    const rows = parseCsv("a,b\n 1 , 2 \n");
    assert.deepEqual(rows, [["a", "b"], ["1", "2"]]);
});

test("parseCsv handles quoted fields with commas", () => {
    const rows = parseCsv('a,b\n"x,y",z');
    assert.deepEqual(rows, [["a", "b"], ["x,y", "z"]]);
});

test("parseCsv handles escaped quotes and multiline quoted fields", () => {
    const rows = parseCsv('a\n"he said ""hi""\nand left"');
    assert.deepEqual(rows, [["a"], ['he said "hi"\nand left']]);
});

test("parseCsv handles CRLF line endings and skips empty lines", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
    assert.deepEqual(rows, [["a", "b"], ["1", "2"], ["3", "4"]]);
});

test("buildRecords requires linkedin_url header", () => {
    assert.throws(() => buildRecords(["name"], [["x"]]), /must contain linkedin_url/);
});

test("buildRecords drops rows without a URL", () => {
    const result = buildRecords(["linkedin_url"], [[""], ["https://www.linkedin.com/in/foo"]]);
    assert.equal(result.dropped, 1);
    assert.equal(result.records.length, 1);
});

test("buildRecords rejects non-LinkedIn URLs", () => {
    const result = buildRecords(["linkedin_url"], [
        ["https://example.com/in/foo"],
        ["http://www.linkedin.com/in/foo"],
        ["not-a-url"],
    ]);
    assert.equal(result.invalidUrls, 3);
    assert.equal(result.records.length, 0);
});

test("buildRecords rejects invalid status", () => {
    assert.throws(
        () => buildRecords(["linkedin_url", "status"], [["https://www.linkedin.com/in/foo", "banned"]]),
        /status must be active or paused/
    );
});

test("buildRecords rejects invalid refresh_interval_days", () => {
    assert.throws(
        () => buildRecords(["linkedin_url", "refresh_interval_days"], [["https://www.linkedin.com/in/foo", "0"]]),
        /refresh_interval_days must be an integer/
    );
});

test("buildRecords strips quotes from URLs and builds records", () => {
    const result = buildRecords(["linkedin_url", "display_name"], [
        ["'https://www.linkedin.com/in/foo'", "Foo"],
    ]);
    assert.deepEqual(result.records, [{
        linkedin_url: "https://www.linkedin.com/in/foo",
        display_name: "Foo",
        team: null,
        status: "active",
        refresh_interval_days: 7,
    }]);
});

test("buildRecords de-duplicates identical URLs", () => {
    const result = buildRecords(["linkedin_url"], [
        ["https://www.linkedin.com/in/foo"],
        ["https://www.linkedin.com/in/foo"],
    ]);
    assert.equal(result.duplicates, 1);
    assert.equal(result.records.length, 1);
});

function fakeClient({ failTimes = 0, batchSizes = [] }) {
    let failures = 0;
    return {
        batchSizes,
        upsertCalls: 0,
        from() {
            return {
                upsert: async (batch) => {
                    this.upsertCalls += 1;
                    batchSizes.push(batch.length);
                    if (failures < failTimes) {
                        failures += 1;
                        return { error: new Error("transient") };
                    }
                    return { error: null };
                },
            };
        },
    };
}

test("importRecords upserts in batches of 100", async () => {
    const records = Array.from({ length: 150 }, (_, index) => ({ linkedin_url: `https://www.linkedin.com/in/u${index}` }));
    const client = fakeClient({});
    const imported = await importRecords(client, records);
    assert.equal(imported, 150);
    assert.deepEqual(client.batchSizes, [100, 50]);
});

test("importRecords retries transient failures", async () => {
    const records = [{ linkedin_url: "https://www.linkedin.com/in/u1" }];
    const client = fakeClient({ failTimes: 2 });
    const imported = await importRecords(client, records);
    assert.equal(imported, 1);
    assert.equal(client.upsertCalls, 3);
});

test("importRecords throws after three failed attempts", async () => {
    const records = [{ linkedin_url: "https://www.linkedin.com/in/u1" }];
    const client = fakeClient({ failTimes: 99 });
    await assert.rejects(() => importRecords(client, records));
    assert.equal(client.upsertCalls, 3);
});