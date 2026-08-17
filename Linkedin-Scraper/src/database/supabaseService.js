import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import conf from "../conf/conf.js";

class SupabaseService {
    async query(operation) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const result = await operation();
            if (result.error?.code !== "PGRST205" || attempt === 2) return result;
            await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
        }
    }

    async init() {
        if (!conf.supabaseUrl || !conf.supabaseServiceRoleKey) {
            throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
        }

        this.client = createClient(conf.supabaseUrl, conf.supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }

    ensureClient() {
        if (!this.client) throw new Error("Database service has not been initialized.");
    }

    async tryAcquireRunLock() {
        this.ensureClient();
        const { error: initializationError } = await this.query(() => this.client.from("automation_locks")
            .upsert({ name: "linkedin_post_scraper" }, { onConflict: "name", ignoreDuplicates: true }));
        if (initializationError) throw initializationError;

        const lockToken = crypto.randomUUID();
        const update = {
            lock_token: lockToken,
            locked_until: new Date(Date.now() + conf.runLockMinutes * 60_000).toISOString(),
            updated_at: new Date().toISOString(),
        };
        let result = await this.query(() => this.client.from("automation_locks")
            .update(update).eq("name", "linkedin_post_scraper").is("locked_until", null).select("lock_token").maybeSingle());
        if (result.error) throw result.error;
        if (result.data) return lockToken;

        result = await this.query(() => this.client.from("automation_locks")
            .update(update).eq("name", "linkedin_post_scraper").lt("locked_until", new Date().toISOString()).select("lock_token").maybeSingle());
        if (result.error) throw result.error;
        return result.data ? lockToken : null;
    }

    async extendRunLock(lockToken) {
        const { error } = await this.query(() => this.client.from("automation_locks").update({
            locked_until: new Date(Date.now() + conf.runLockMinutes * 60_000).toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("name", "linkedin_post_scraper").eq("lock_token", lockToken));
        if (error) throw error;
    }

    async releaseRunLock(lockToken) {
        if (!lockToken) return;
        const { error } = await this.query(() => this.client.from("automation_locks").update({
            lock_token: null,
            locked_until: null,
            updated_at: new Date().toISOString(),
        }).eq("name", "linkedin_post_scraper").eq("lock_token", lockToken));
        if (error) throw error;
    }

    async getDueProfiles(limit) {
        this.ensureClient();
        const { data, error } = await this.query(() => this.client
            .from("profiles")
            .select("id, linkedin_url, display_name, refresh_interval_days, failure_count")
            .eq("status", "active")
            .lte("next_check_at", new Date().toISOString())
            .order("next_check_at", { ascending: true })
            .limit(limit));
        if (error) throw error;
        return data;
    }

    async listProfiles() {
        this.ensureClient();
        const { data, error } = await this.query(() => this.client
            .from("profiles")
            .select("id, display_name, linkedin_url, team, status, last_checked_at, failure_count, posts(count)")
            .order("created_at", { ascending: false }));
        if (error) throw error;
        return (data ?? []).map((profile) => ({
            ...profile,
            posts_count: profile.posts?.[0]?.count ?? 0,
            posts: undefined,
        }));
    }

    async createRun() {
        this.ensureClient();
        const { data, error } = await this.query(() => this.client
            .from("automation_runs")
            .insert({})
            .select("id")
            .single());
        if (error) throw error;
        return data.id;
    }

    async completeRun(runId, counters, errorMessage = null) {
        this.ensureClient();
        const { error } = await this.query(() => this.client.from("automation_runs").update({
            completed_at: new Date().toISOString(),
            status: errorMessage ? "failed" : "completed",
            profiles_processed: counters.processed,
            profiles_succeeded: counters.succeeded,
            profiles_failed: counters.failed,
            error_message: errorMessage,
        }).eq("id", runId));
        if (error) throw error;
    }

    async saveProfileResult(profile, posts) {
        this.ensureClient();
        const rows = posts.map((post) => ({
            profile_id: profile.id,
            post_fingerprint: crypto.createHash("sha256").update(post.rawText).digest("hex"),
            raw_text: post.rawText,
            summary: post.summary,
            published_at: this.toIsoDate(post.date),
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));
        if (rows.length) {
            const { error } = await this.query(() => this.client.from("posts")
                .upsert(rows, { onConflict: "profile_id,post_fingerprint" }));
            if (error) throw error;
        }
        await this.markProfileSuccess(profile);
    }

    async markProfileSuccess(profile) {
        this.ensureClient();
        const checkedAt = new Date();
        const { error } = await this.query(() => this.client.from("profiles").update({
            last_checked_at: checkedAt.toISOString(),
            last_success_at: checkedAt.toISOString(),
            next_check_at: new Date(checkedAt.getTime() + profile.refresh_interval_days * 86_400_000).toISOString(),
            last_error: null,
            failure_count: 0,
            updated_at: checkedAt.toISOString(),
        }).eq("id", profile.id));
        if (error) throw error;
    }

    async markProfileFailure(profile, errorMessage) {
        this.ensureClient();
        const failureCount = profile.failure_count + 1;
        const retryMinutes = Math.min(360, 5 * 2 ** Math.min(failureCount - 1, 6));
        const { error } = await this.query(() => this.client.from("profiles").update({
            last_error: errorMessage.slice(0, 2_000),
            failure_count: failureCount,
            next_check_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", profile.id));
        if (error) throw error;
    }

    async getProfilePosts(profileUrl) {
        this.ensureClient();
        const pathname = new URL(profileUrl).pathname;
        const segments = pathname.split("/").filter(Boolean);
        const inIndex = segments.indexOf("in");
        const slug = inIndex !== -1 ? segments[inIndex + 1] : null;
        if (!slug) return { profile: null, error: "URL must be a LinkedIn profile URL (/in/<slug>)." };

        const escaped = slug.replace(/[%_]/g, (char) => `\\${char}`);
        const { data, error } = await this.query(() => this.client
            .from("profiles")
            .select("id, display_name, team, linkedin_url, status, refresh_interval_days, last_checked_at")
            .ilike("linkedin_url", `%/in/${escaped}%`)
            .limit(10));
        if (error) throw error;

        const profile = (data ?? []).find((row) => {
            try {
                const storedSegments = new URL(row.linkedin_url).pathname.split("/").filter(Boolean);
                const storedIn = storedSegments.indexOf("in");
                return storedIn !== -1 && storedSegments[storedIn + 1] === slug;
            } catch {
                return false;
            }
        }) || null;

        if (!profile) return { profile: null, error: "No profile found for this URL." };

        const { data: posts, error: postsError } = await this.query(() => this.client
            .from("posts")
            .select("raw_text, summary, published_at, fetched_at")
            .eq("profile_id", profile.id)
            .order("published_at", { ascending: false, nullsFirst: false })
            .limit(100));
        if (postsError) throw postsError;

        return { profile, posts: posts ?? [] };
    }

    toIsoDate(value) {
        if (!value || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
        const [day, month, year] = value.split("/").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
            return null;
        }
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
}

export default new SupabaseService();
