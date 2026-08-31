import browserService from "../playwright/browserService.js";
import database from "../database/supabaseService.js";
import postManager from "./postManager.js";
import conf from "../conf/conf.js";
import { logger } from "../observability/logger.js";
class Run {

    async runAutomation() {
        let runId;
        let lockToken;
        const counters = { processed: 0, succeeded: 0, failed: 0 };
        try {
            await database.init();
            lockToken = await database.tryAcquireRunLock();
            if (!lockToken) {
                logger.warn("automation_skipped", { reason: "another_run_is_active" });
                return;
            }
            runId = await database.createRun();
            const profiles = await database.getDueProfiles(conf.maxProfilesPerRun);
            logger.info("automation_started", { runId, profileCount: profiles.length });
            if (!profiles.length) {
                await database.completeRun(runId, counters);
                logger.info("automation_completed", { runId, ...counters });
                return;
            }

            await browserService.init();
            const page = await browserService.getPage();
            
            for (const profile of profiles) {
                counters.processed += 1;
                try {
                    await page.goto(profile.linkedin_url, { waitUntil: "domcontentloaded", timeout: 30_000 });
                    console.log("CURRENT URL:", page.url());
                    console.log("PAGE TITLE:", await page.title());

                    const bodyText = await page.locator("body").innerText();
                    console.log(
                        "BODY SAMPLE:",
                        bodyText.slice(0, 1500)
                    );
                    
                    const text = page.locator('section[data-testid="carousel"][role="list"]');
                    await text.waitFor({ state: "visible",timeout: 10_000 });

                    await page.screenshot({
                    path: `/app/debug/profile-${profile.id}.png`,
                    fullPage: true,
                    });

                    const postText = await text.textContent();
                    const postData = postManager.splitPost(postText || "");
                    const [rawPosts, summaries] = await postManager.managePost(postData);
                    const posts = rawPosts.map((rawText, index) => ({ rawText, ...summaries[index] }));
                    await database.saveProfileResult(profile, posts);
                    counters.succeeded += 1;
                    logger.info("profile_processed", { runId, profileId: profile.id, postsStored: posts.length });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    await database.deleteProfile(profile);
                    counters.failed += 1;
                    logger.error("profile_failed_deleted", { runId, profileId: profile.id, linkedinUrl: profile.linkedin_url, error: message });
                }
                await database.extendRunLock(lockToken);
            }
            await database.completeRun(runId, counters);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (runId) {
                try {
                    await database.completeRun(runId, counters, message);
                } catch (completionError) {
                    logger.error("run_completion_failed", { runId, error: String(completionError) });
                }
            }
            throw error;
        } finally {
            try {
                await browserService.closeBrowser();
            } catch (closeError) {
                logger.error("browser_cleanup_failed", { error: String(closeError) });
            }
            try {
                await database.releaseRunLock(lockToken);
            } catch (releaseError) {
                logger.error("run_lock_release_failed", { error: String(releaseError) });
            }
        }
    }

}

export default Run
