
import Groq from "groq-sdk"
import conf from "../conf/conf.js"


class CallLLM {
    
    constructor() {
        if (!conf.groqCloudApi2) throw new Error("GROQ_CLOUD_API_KEY2 must be configured.");
        this.groq = new Groq({ apiKey: conf.groqCloudApi2, timeout: conf.llmTimeoutMs, maxRetries: 2 });
        this.model = "openai/gpt-oss-120b"
        this.temperature = 0.2
        this.systemPrompt = `Your are a linkedin Post Analyzer. Format the linkedin post date as DD/MM/YYYY and summarize the
        post into:
        Output Format: short

Main topic 
Important point 1 (if applicable)
Important point 2 (if applicable)
Important point 3 (if applicable)
Additional important points (if applicable)`
    }

    

    async getLLMResponse(userPrompt) {

        try {
            const linkedinPostSchema = {
                type: "object",
                properties: {
                    summary: {
                        type: "string"
                    },
                    date: {
                        type: "string"
                    }
                },
                required: ["summary", "date"],
                additionalProperties: false
            };



            const response = await this.groq.chat.completions.create(
                {
                    messages: [
                        {
                            role: "system",
                            content: `${this.systemPrompt}`
                        },
                        {
                            role: "user",
                            content: `${userPrompt}`
                        },
                    
                    ],
                    model: this.model,
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "linkedinPostSchema",
                            strict: true,
                            schema: linkedinPostSchema
                        }
                    },
                    temperature: this.temperature
                }
            )
            const parsed = JSON.parse(response.choices[0].message.content || "{}");
            if (typeof parsed.summary !== "string" || typeof parsed.date !== "string") {
                throw new Error("LLM returned an invalid response shape.");
            }
            return parsed;

        }catch (error) {
            throw error;
        }
        
    }
}


const callLLM = new CallLLM()
export default callLLM
