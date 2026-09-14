import { toolRegistry, ToolExecutionResult } from "./tools";
import { ALLOWED_APPS, ALLOWED_WEBSITES } from "./config";

export interface IntentResult {
  intent: string;
  parameters: Record<string, any>;
  spokenResponse?: string;
  thought?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export class JarvisBrain {
  public conversationHistory: ConversationMessage[] = [];
  public context: {
    lastMentionedFile?: string;
    lastMentionedApp?: string;
    lastMentionedWebsite?: string;
    lastSearchedQuery?: string;
    lastIntent?: string;
  } = {};

  public addMessage(role: "user" | "assistant", text: string) {
    this.conversationHistory.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
    // Keep last 15 interactions
    if (this.conversationHistory.length > 15) {
      this.conversationHistory.shift();
    }
  }

  public updateContext(updates?: Record<string, any>) {
    if (!updates) return;
    this.context = { ...this.context, ...updates };
  }

  /**
   * Main entry point to parse user prompt into an executable intent.
   * Uses Gemini/OpenAI if configured in environment, otherwise uses the built-in
   * semantic NLP intent resolver.
   */
  public async determineIntent(rawInput: string): Promise<IntentResult> {
    const input = rawInput.trim();
    if (!input) {
      return {
        intent: "none",
        parameters: {},
        spokenResponse: "I am at your service, sir. How may I assist you?",
      };
    }

    // Try Gemini API if key is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiIntent = await this.resolveIntentViaGemini(input);
        if (geminiIntent) return geminiIntent;
      } catch (err) {
        console.warn("Gemini intent call failed, falling back to local NLP parser:", err);
      }
    }

    // Fallback: Built-in local semantic parser
    return this.parseLocalIntent(input);
  }

  /**
   * Comprehensive Local Semantic NLP Intent Parser.
   * Handles natural linguistic phrasings, follow-ups, and pronoun resolution ("it").
   */
  public parseLocalIntent(rawInput: string): IntentResult {
    const cleaned = rawInput.toLowerCase().trim().replace(/[.,!?;:]+$/, "");
    const normalized = cleaned
      .replace(/^(hey |hi |hello |ok |okay |can you |please |could you )+/, "")
      .replace(/^(jarvis |j\.a\.r\.v\.i\.s\. )+/, "")
      .trim();

    // 1. Pronoun Resolution ("open it", "open that", "run it")
    if (
      normalized === "open it" ||
      normalized === "open that" ||
      normalized === "launch it" ||
      normalized === "view it"
    ) {
      if (this.context.lastMentionedFile) {
        return {
          intent: "open_file",
          parameters: { path: this.context.lastMentionedFile },
          thought: `Resolved 'it' to last mentioned file: ${this.context.lastMentionedFile}`,
        };
      }
      if (this.context.lastMentionedApp) {
        return {
          intent: "open_application",
          parameters: { application: this.context.lastMentionedApp },
          thought: `Resolved 'it' to last mentioned application: ${this.context.lastMentionedApp}`,
        };
      }
      if (this.context.lastMentionedWebsite) {
        return {
          intent: "open_website",
          parameters: { target: this.context.lastMentionedWebsite },
          thought: `Resolved 'it' to last mentioned website: ${this.context.lastMentionedWebsite}`,
        };
      }
    }

    // 2. Battery queries
    if (
      normalized.includes("battery") ||
      normalized.includes("charge") ||
      normalized.includes("power level") ||
      normalized === "what is my battery" ||
      normalized === "what's my battery"
    ) {
      return {
        intent: "get_system_status",
        parameters: { focus: "battery" },
      };
    }

    // 3. System status / Diagnostics / CPU / RAM
    if (
      normalized.includes("system status") ||
      normalized.includes("system diagnostics") ||
      normalized.includes("how is my pc") ||
      normalized.includes("cpu usage") ||
      normalized.includes("memory usage") ||
      normalized === "check system"
    ) {
      return {
        intent: "get_system_status",
        parameters: {},
      };
    }

    // 4. Time & Date
    if (
      normalized.includes("what time") ||
      normalized.includes("current time") ||
      normalized.includes("what is the time") ||
      normalized.includes("what day is today") ||
      normalized.includes("what's the date")
    ) {
      return {
        intent: "get_time",
        parameters: {},
      };
    }

    // 5. Memory: "Remember that my [key] is [value]" or "Remember [fact]"
    const rememberMatch = normalized.match(/remember (?:that )?(?:my )?(.+?) is (.+)/i);
    if (rememberMatch) {
      return {
        intent: "remember_fact",
        parameters: { key: rememberMatch[1].trim(), value: rememberMatch[2].trim() },
      };
    }
    if (normalized.startsWith("remember ")) {
      const fact = normalized.replace(/^remember /, "").trim();
      return {
        intent: "remember_fact",
        parameters: { key: "preference", value: fact },
      };
    }

    // Recall memory: "What is my [key]" or "What's my [key]"
    const recallMatch = normalized.match(/what (?:is|was) my (.+)/i);
    if (recallMatch) {
      const query = recallMatch[1].trim().replace(/\?+$/, "");
      return {
        intent: "recall_fact",
        parameters: { query },
      };
    }

    // Specific search: "Search YouTube for [query]"
    const searchYtMatch = rawInput.trim().match(/^(?:hey jarvis |jarvis )?(?:can you |please )?(?:search (?:on |in )?youtube for |search youtube for )(.+)/i);
    if (searchYtMatch) {
      const query = searchYtMatch[1].trim().replace(/[.,!?;:]+$/, "");
      return {
        intent: "search_chrome",
        parameters: { query, engine: "youtube" },
        thought: `Search YouTube for ${query}`,
      };
    }

    // Specific search: "Search for [query]" or "Search Google for [query]"
    const searchGoogleMatch = rawInput.trim().match(/^(?:hey jarvis |jarvis )?(?:can you |please )?(?:search (?:on |in )?google for |search google for |search for |search the web for )(.+)/i);
    if (searchGoogleMatch && !normalized.includes("youtube")) {
      const query = searchGoogleMatch[1].trim().replace(/[.,!?;:]+$/, "");
      return {
        intent: "search_chrome",
        parameters: { query, engine: "google" },
        thought: `Search Google for ${query}`,
      };
    }

    // Contextual website search: e.g. "search for TCS NQT" after opening YouTube
    const searchContextMatch = rawInput.trim().match(/^(?:hey jarvis |jarvis )?(?:can you |please )?(?:search for|search|look up|find) (.+)/i);
    if (searchContextMatch && this.context.lastMentionedWebsite && !normalized.includes("web") && !normalized.includes("google")) {
      const query = searchContextMatch[1].trim().replace(/[.,!?;:]+$/, "");
      return {
        intent: "search_website_context",
        parameters: { query, target: this.context.lastMentionedWebsite },
        thought: `Searching within context of ${this.context.lastMentionedWebsite} for: ${query}`,
      };
    }

    // Direct URL handling: "Open https://example.com" or "visit https://..."
    const directUrlMatch = rawInput.trim().match(/(?:open|navigate to|go to|visit)\s+(https?:\/\/[^\s]+)/i);
    if (directUrlMatch) {
      const targetUrl = directUrlMatch[1].trim();
      return {
        intent: "open_chrome",
        parameters: { url: targetUrl },
        thought: `Direct URL: ${targetUrl}`,
      };
    }

    // 6. Search files / projects: "Find my [project]", "search for [file]"
    const findMatch = normalized.match(/(?:find|search for|look for|locate)(?: my)? (.+?)(?: project| file)?$/i);
    if (findMatch && !normalized.startsWith("search web") && !normalized.startsWith("search google")) {
      return {
        intent: "search_files",
        parameters: { query: findMatch[1].trim() },
      };
    }

    // 7. Websites: "open youtube", "launch youtube", "take me to youtube", "can you open youtube?", "i want to watch youtube", "let's go to youtube", etc.
    let bestWebsiteMatch: { key: string; length: number } | null = null;
    for (const [key, site] of Object.entries(ALLOWED_WEBSITES)) {
      for (const alias of site.aliases) {
        if (normalized.includes(alias) || normalized.endsWith(alias)) {
          if (!bestWebsiteMatch || alias.length > bestWebsiteMatch.length) {
            bestWebsiteMatch = { key, length: alias.length };
          }
        }
      }
    }

    if (
      bestWebsiteMatch &&
      (normalized.includes("open") ||
        normalized.includes("launch") ||
        normalized.includes("take me to") ||
        normalized.includes("go to") ||
        normalized.includes("navigate") ||
        normalized.includes("watch") ||
        normalized.includes("visit") ||
        normalized.includes("show me") ||
        normalized.startsWith(bestWebsiteMatch.key) ||
        normalized.startsWith("youtube") ||
        normalized.startsWith("github") ||
        normalized.startsWith("google") ||
        normalized.startsWith("chatgpt") ||
        normalized.startsWith("gmail") ||
        normalized.startsWith("calendar"))
    ) {
      return {
        intent: "open_website",
        parameters: { target: bestWebsiteMatch.key },
      };
    }

    // 8. Applications: "open vs code", "launch notepad", "start chrome", "close chrome", "start my coding editor"
    for (const [key, app] of Object.entries(ALLOWED_APPS)) {
      const matched = app.aliases.some((alias) =>
        normalized.includes(alias) || normalized.endsWith(alias)
      );
      if (matched) {
        if (
          normalized.includes("close") ||
          normalized.includes("exit") ||
          normalized.includes("quit") ||
          normalized.includes("kill") ||
          normalized.includes("terminate")
        ) {
          return {
            intent: "close_application",
            parameters: { application: key },
          };
        }
        if (
          normalized.includes("open") ||
          normalized.includes("launch") ||
          normalized.includes("start") ||
          normalized.includes("bring up") ||
          normalized.includes("fire up") ||
          normalized.startsWith(key) ||
          normalized.includes("editor")
        ) {
          return {
            intent: "open_application",
            parameters: { application: key },
          };
        }
      }
    }

    // Generic Open Website (URL detection)
    if (normalized.includes(".com") || normalized.includes(".org") || normalized.includes("http")) {
      const words = normalized.split(/\s+/);
      const urlCandidate = words.find((w) => w.includes(".") || w.includes("http"));
      if (urlCandidate) {
        return {
          intent: "open_website",
          parameters: { target: urlCandidate },
        };
      }
    }

    // 9. Web Search: "search web for ...", "google ...", "search for ... on the web"
    if (
      normalized.startsWith("search web for") ||
      normalized.startsWith("search google for") ||
      normalized.startsWith("google ") ||
      normalized.startsWith("search for ")
    ) {
      const query = normalized
        .replace(/^(search web for|search google for|google|search for) /, "")
        .trim();
      return {
        intent: "search_web",
        parameters: { query },
      };
    }

    // 10. Tasks
    if (normalized.startsWith("create task") || normalized.startsWith("add task") || normalized.startsWith("remind me to")) {
      const title = normalized
        .replace(/^(create task|add task|remind me to) /, "")
        .trim();
      return {
        intent: "create_task",
        parameters: { title },
      };
    }
    if (normalized.includes("what are my tasks") || normalized === "show tasks" || normalized === "get tasks" || normalized === "my tasks") {
      return {
        intent: "get_tasks",
        parameters: {},
      };
    }

    // 11. Notes
    if (normalized.startsWith("create note") || normalized.startsWith("take a note") || normalized.startsWith("new note")) {
      const content = normalized
        .replace(/^(create note|take a note|new note) /, "")
        .trim();
      return {
        intent: "create_note",
        parameters: { title: "Quick Note", content },
      };
    }
    if (normalized.startsWith("search notes") || normalized.startsWith("find note")) {
      const q = normalized.replace(/^(search notes for|search notes|find note for|find note) /, "").trim();
      return {
        intent: "search_notes",
        parameters: { query: q },
      };
    }

    // 12. Conversational greetings / general persona
    if (
      normalized === "hello" ||
      normalized === "hi" ||
      normalized === "hey" ||
      normalized.includes("good morning") ||
      normalized.includes("good evening") ||
      normalized.includes("good afternoon") ||
      normalized === "jarvis" ||
      normalized === "are you there"
    ) {
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      return {
        intent: "none",
        parameters: {},
        spokenResponse: `${timeGreeting}, sir. I am online and all systems are operational. How may I help you?`,
      };
    }

    // Default: Web search fallback or polite clarification
    return {
      intent: "search_web",
      parameters: { query: rawInput },
      thought: "Unclassified intent, defaulted to web search",
    };
  }

  /**
   * Optional Gemini API integration if user configures GEMINI_API_KEY in .env
   */
  private async resolveIntentViaGemini(input: string): Promise<IntentResult | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const toolsDescription = Object.values(toolRegistry).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const systemPrompt = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the AI assistant running locally on Windows.
The user interacts via voice. Analyze their command and choose an appropriate tool or conversational response.

Active Context:
${JSON.stringify(this.context, null, 2)}

Available Tools:
${JSON.stringify(toolsDescription, null, 2)}

Allowed Applications:
${JSON.stringify(Object.keys(ALLOWED_APPS))}

Allowed Websites:
${JSON.stringify(Object.keys(ALLOWED_WEBSITES))}

Rules:
1. Return ONLY valid JSON with no markdown backticks.
2. Structure: { "intent": "<tool_name_or_none>", "parameters": { ... }, "spokenResponse": "<concise natural Jarvis response>" }
3. Responses should be crisp, elegant, and British/formal: "Opening YouTube, sir.", "Certainly, sir."
4. If pronoun like "it" is used, resolve to context.lastMentionedFile, lastMentionedApp, or lastMentionedWebsite.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\nUser: "${input}"` }] },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as any;
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    return JSON.parse(candidateText) as IntentResult;
  }
}

export const brain = new JarvisBrain();
