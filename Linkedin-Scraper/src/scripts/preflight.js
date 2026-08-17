import conf from "../conf/conf.js";
import database from "../database/supabaseService.js";
import { logger } from "../observability/logger.js";

await database.init();
const lockToken = await database.tryAcquireRunLock();
if (!lockToken) throw new Error("Another automation run is active.");

try {
    const profiles = await database.getDueProfiles(conf.maxProfilesPerRun);
    logger.info("preflight_passed", { dueProfiles: profiles.length, maxProfilesPerRun: conf.maxProfilesPerRun });
} finally {
    await database.releaseRunLock(lockToken);
}
