import { test } from "node:test";
import assert from "node:assert/strict";
import database from "../src/database/supabaseService.js";

test("toIsoDate converts DD/MM/YYYY to ISO date", () => {
    assert.equal(database.toIsoDate("17/08/2026"), "2026-08-17");
    assert.equal(database.toIsoDate("01/01/2020"), "2020-01-01");
});

test("toIsoDate returns null for invalid values", () => {
    assert.equal(database.toIsoDate(""), null);
    assert.equal(database.toIsoDate(null), null);
    assert.equal(database.toIsoDate("2026-08-17"), null);
    assert.equal(database.toIsoDate("17-08-2026"), null);
    assert.equal(database.toIsoDate("31/02/2026"), null);
});

function fakeClient({ profilesData, postsData }) {
    const calls = { ilikePattern: null };
    const chain = (result) => ({
        select() {
            return {
                ilike(_column, pattern) {
                    calls.ilikePattern = pattern;
                    return {
                        limit() {
                            return Promise.resolve({ data: profilesData, error: null });
                        },
                    };
                },
            };
        },
    });
    return {
        calls,
        from(table) {
            if (table === "profiles") {
                return chain({ data: profilesData, error: null });
            }
            if (table === "posts") {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    order() {
                                        return {
                                            limit() {
                                                return Promise.resolve({ data: postsData, error: null });
                                            },
                                        };
                                    },
                                };
                            },
                        };
                    },
                };
            }
            throw new Error(`unexpected table: ${table}`);
        },
    };
}

test("getProfilePosts rejects URLs without /in/<slug>", async () => {
    database.client = fakeClient({ profilesData: [], postsData: [] });
    const result = await database.getProfilePosts("https://www.linkedin.com/sales/lead/abc");
    assert.equal(result.profile, null);
    assert.match(result.error, /\/in\/<slug>/);
});

test("getProfilePosts escapes LIKE wildcards in the slug", async () => {
    const client = fakeClient({ profilesData: [], postsData: [] });
    database.client = client;
    await database.getProfilePosts("https://www.linkedin.com/in/foo%_bar/");
    assert.equal(client.calls.ilikePattern, "%/in/foo\\%\\_bar%");
});

test("getProfilePosts picks the exact slug match and returns posts", async () => {
    const profile = { id: "p1", display_name: "Foo", linkedin_url: "https://www.linkedin.com/in/foo" };
    const posts = [{ raw_text: "post 1", summary: "summary 1" }];
    database.client = fakeClient({ profilesData: [profile], postsData: posts });
    const result = await database.getProfilePosts("https://www.linkedin.com/in/foo");
    assert.equal(result.profile.id, "p1");
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].raw_text, "post 1");
});

test("getProfilePosts returns null profile when no match found", async () => {
    database.client = fakeClient({ profilesData: [], postsData: [] });
    const result = await database.getProfilePosts("https://www.linkedin.com/in/unknown");
    assert.equal(result.profile, null);
    assert.match(result.error, /No profile found/);
});

test("getProfilePosts matches exact slug over look-alike rows", async () => {
    const profilesData = [
        { id: "p1", linkedin_url: "https://www.linkedin.com/in/foobar" },
        { id: "p2", linkedin_url: "https://www.linkedin.com/in/foo" },
    ];
    database.client = fakeClient({ profilesData, postsData: [] });
    const result = await database.getProfilePosts("https://www.linkedin.com/in/foo");
    assert.equal(result.profile.id, "p2");
});