import Run from "./scripts/pipeline.js";

async function main() {
    const run = new Run();
    await run.runAutomation();
}

main().catch((error) => {
    console.error("Automation failed:", error);
    process.exitCode = 1;
});
