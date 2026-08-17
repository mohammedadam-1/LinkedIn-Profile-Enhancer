import callLLM from "../llm/call_llm.js";
import conf from "../conf/conf.js";

class PostManager {
    splitPost(text) {
        return text.split(/(?=\d+(?:m|h|d|w|mo|yr)\s*(?:•|â€¢))/);
    }

    async managePost(postData) {
        const posts = [];
        const summaries = [];
        const candidates = postData.slice(1, 6);

        for (const [index, post] of candidates.entries()) {
            const [header, ...content] = post.split(/(?:•|â€¢)/);
            const cleanHeader = header.trim();
            const cleanBody = content.join(" • ")
                .replace(/\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*\s+(?:•|â€¢)\s+\d(?:st|nd|rd|th)\+?.*$/s, "")
                .replace(/\d[\d,]*\s*reactions?$/, "")
                .trim();
            if (!cleanHeader || !cleanBody) continue;

            const rawText = `${cleanHeader} - ${cleanBody}`;
            summaries.push(await callLLM.getLLMResponse(rawText));
            posts.push(rawText);

            if (conf.llmRequestDelayMs && index < candidates.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, conf.llmRequestDelayMs));
            }
        }

        return [posts, summaries];
    }
}

export default new PostManager();
