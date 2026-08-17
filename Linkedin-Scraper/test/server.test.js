import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import database from "../src/database/supabaseService.js";
import app from "../src/server.js";

let server;
let baseUrl;

before(async () => {
    database.init = async () => {};
    database.listProfiles = async () => [
        { id: "p1", display_name: "Foo", linkedin_url: "https://www.linkedin.com/in/foo", posts_count: 2 },
    ];
    database.getProfilePosts = async (url) => {
        if (url.includes("unknown")) {
            return { profile: null, error: "No profile found for this URL." };
        }
        return {
            profile: { id: "p1", display_name: "Foo" },
            posts: [{ raw_text: "raw", summary: "sum", published_at: "2026-08-17" }],
        };
    };
    database.client = {
        from() {
            return {
                upsert: async () => ({ error: null }),
            };
        },
    };

    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    server.close();
});

test("GET /api/health returns ok", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
});

test("GET /api/profiles returns profiles", async () => {
    const response = await fetch(`${baseUrl}/api/profiles`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.profiles.length, 1);
    assert.equal(body.profiles[0].display_name, "Foo");
});

test("GET /api/profiles/posts requires a url", async () => {
    const response = await fetch(`${baseUrl}/api/profiles/posts`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /url query parameter/);
});

test("GET /api/profiles/posts rejects invalid urls", async () => {
    const response = await fetch(`${baseUrl}/api/profiles/posts?url=not-a-url`);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /invalid/i);
});

test("GET /api/profiles/posts returns profile posts", async () => {
    const response = await fetch(
        `${baseUrl}/api/profiles/posts?url=${encodeURIComponent("https://www.linkedin.com/in/foo")}`
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.profile.display_name, "Foo");
    assert.equal(body.posts.length, 1);
});

test("GET /api/profiles/posts returns 404 for unknown profiles", async () => {
    const response = await fetch(
        `${baseUrl}/api/profiles/posts?url=${encodeURIComponent("https://www.linkedin.com/in/unknown")}`
    );
    assert.equal(response.status, 404);
});

test("POST /api/profiles/import requires a file", async () => {
    const response = await fetch(`${baseUrl}/api/profiles/import`, { method: "POST" });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /No CSV file/);
});

test("POST /api/profiles/import rejects non-CSV files", async () => {
    const form = new FormData();
    form.append("file", new Blob(["hello"], { type: "text/plain" }), "profiles.txt");
    const response = await fetch(`${baseUrl}/api/profiles/import`, { method: "POST", body: form });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /Only CSV files/);
});

test("POST /api/profiles/import imports a valid CSV", async () => {
    const csv = "linkedin_url,display_name\nhttps://www.linkedin.com/in/foo,Foo\n";
    const form = new FormData();
    form.append("file", new Blob([csv], { type: "text/csv" }), "profiles.csv");
    const response = await fetch(`${baseUrl}/api/profiles/import`, { method: "POST", body: form });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.imported, 1);
    assert.equal(body.fileName, "profiles.csv");
});

test("POST /api/profiles/import returns validation errors from buildRecords", async () => {
    const csv = "linkedin_url,status\nhttps://www.linkedin.com/in/foo,banned\n";
    const form = new FormData();
    form.append("file", new Blob([csv], { type: "text/csv" }), "profiles.csv");
    const response = await fetch(`${baseUrl}/api/profiles/import`, { method: "POST", body: form });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /status must be active or paused/);
});

test("CORS allows the configured origin", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("CORS rejects disallowed origins", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "http://evil.example.com" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("CORS answers OPTIONS preflight for allowed origins", async () => {
    const response = await fetch(`${baseUrl}/api/profiles`, {
        method: "OPTIONS",
        headers: {
            Origin: "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.match(response.headers.get("access-control-allow-methods"), /GET/);
});