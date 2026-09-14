import { chromeController, type BrowserActionResult } from "./chromeController";
import { ALLOWED_WEBSITES } from "./config";

export interface PlanStep {
  id: number;
  actionName: string;
  description: string;
  execute: (onProgress?: (msg: string) => void) => Promise<BrowserActionResult>;
}

export interface TaskPlan {
  taskDescription: string;
  targetWebsite?: string;
  steps: PlanStep[];
}

export class BrowserTaskPlanner {
  /**
   * Generates a multi-step execution plan from natural language user instructions.
   */
  public createPlan(instruction: string): TaskPlan {
    const raw = instruction.trim();
    const lower = raw.toLowerCase();

    // 1. "Open YouTube and search for [query]"
    const ytSearchMatch = lower.match(/(?:open|go to|launch)\s+youtube\s+(?:and\s+)?(?:search(?:\s+for)?|find|look up)\s+(.+)/i)
      || lower.match(/search\s+youtube\s+for\s+(.+)/i);

    if (ytSearchMatch) {
      const query = ytSearchMatch[1].replace(/[.,!?;:]+$/, "").trim();
      return {
        taskDescription: `Open YouTube and search for "${query}"`,
        targetWebsite: "YouTube",
        steps: [
          {
            id: 1,
            actionName: "OPEN_NEW_TAB",
            description: "Opening new Chrome tab",
            execute: () => chromeController.openNewTab("https://www.youtube.com", "YouTube Search"),
          },
          {
            id: 2,
            actionName: "NAVIGATING",
            description: "Navigating to YouTube",
            execute: () => chromeController.navigate("https://www.youtube.com"),
          },
          {
            id: 3,
            actionName: "FIND_SEARCH_BOX",
            description: "Locating YouTube search input",
            execute: () => chromeController.findElement("YouTube search box"),
          },
          {
            id: 4,
            actionName: "TYPE_QUERY",
            description: `Entering search query: "${query}"`,
            execute: () => chromeController.typeText(query, undefined, "YouTube search box"),
          },
          {
            id: 5,
            actionName: "SUBMIT_SEARCH",
            description: "Submitting search query",
            execute: () => chromeController.pressKey("Enter"),
          },
          {
            id: 6,
            actionName: "WAIT_FOR_RESULTS",
            description: "Waiting for video results to render",
            execute: () => chromeController.waitSeconds(2),
          },
        ],
      };
    }

    // 2. "Open Google and search for [query] and open the official result"
    const googleOfficialMatch = lower.match(/(?:open|go to)?\s*google\s*,?\s*(?:and\s+)?search\s+(?:for\s+)?(.+?)\s*(?:and\s+open\s+(?:the\s+)?official\s+result)/i);
    if (googleOfficialMatch) {
      const query = googleOfficialMatch[1].replace(/[.,!?;:]+$/, "").trim();
      return {
        taskDescription: `Search Google for "${query}" and open official result`,
        targetWebsite: "Google",
        steps: [
          {
            id: 1,
            actionName: "OPEN_NEW_TAB",
            description: "Opening new Chrome tab",
            execute: () => chromeController.openNewTab("https://www.google.com", "Google Search & Open Official Result"),
          },
          {
            id: 2,
            actionName: "NAVIGATE_GOOGLE",
            description: "Navigating to Google",
            execute: () => chromeController.navigate("https://www.google.com"),
          },
          {
            id: 3,
            actionName: "FIND_SEARCH_BOX",
            description: "Locating Google search field",
            execute: () => chromeController.findElement("Google search field"),
          },
          {
            id: 4,
            actionName: "TYPE_QUERY",
            description: `Typing query: "${query}"`,
            execute: () => chromeController.typeText(query, undefined, "Google search field"),
          },
          {
            id: 5,
            actionName: "SUBMIT_SEARCH",
            description: "Submitting search",
            execute: () => chromeController.pressKey("Enter"),
          },
          {
            id: 6,
            actionName: "WAIT_FOR_RESULTS",
            description: "Waiting for search results",
            execute: () => chromeController.waitSeconds(2),
          },
          {
            id: 7,
            actionName: "CLICK_OFFICIAL_RESULT",
            description: "Clicking the top official result",
            execute: () => chromeController.clickElement("div#search a h3, [role='main'] a h3, h3", "official search result"),
          },
          {
            id: 8,
            actionName: "VERIFY_DESTINATION",
            description: "Verifying destination loaded",
            execute: () => chromeController.readPage(),
          },
        ],
      };
    }

    // 3. "Open Google and search for [query]" or "Search for [query]"
    const googleSearchMatch = lower.match(/(?:open|go to)?\s*google\s*,?\s*(?:and\s+)?search\s+(?:for\s+)?(.+)/i)
      || lower.match(/^(?:search for|google|look up)\s+(.+)/i);

    if (googleSearchMatch && !lower.includes("youtube") && !lower.includes("github")) {
      const query = googleSearchMatch[1].replace(/[.,!?;:]+$/, "").trim();
      return {
        taskDescription: `Open Google and search for "${query}"`,
        targetWebsite: "Google",
        steps: [
          {
            id: 1,
            actionName: "OPEN_NEW_TAB",
            description: "Opening new Chrome tab",
            execute: () => chromeController.openNewTab("https://www.google.com", "Google Search"),
          },
          {
            id: 2,
            actionName: "NAVIGATE_GOOGLE",
            description: "Navigating to Google",
            execute: () => chromeController.navigate("https://www.google.com"),
          },
          {
            id: 3,
            actionName: "FIND_SEARCH_BOX",
            description: "Locating Google search field",
            execute: () => chromeController.findElement("Google search box"),
          },
          {
            id: 4,
            actionName: "TYPE_QUERY",
            description: `Typing: "${query}"`,
            execute: () => chromeController.typeText(query, undefined, "Google search box"),
          },
          {
            id: 5,
            actionName: "SUBMIT_SEARCH",
            description: "Submitting Google search",
            execute: () => chromeController.pressKey("Enter"),
          },
          {
            id: 6,
            actionName: "WAIT_FOR_RESULTS",
            description: "Waiting for results to display",
            execute: () => chromeController.waitSeconds(2),
          },
        ],
      };
    }

    // 4. "Open GitHub and find my [repo] repository"
    const githubRepoMatch = lower.match(/(?:open|go to)\s+github\s+(?:and\s+)?(?:find|search(?:\s+for)?)\s+(?:my\s+)?(.+?)(?:\s+repository|\s+repo)?$/i);
    if (githubRepoMatch) {
      const repoQuery = githubRepoMatch[1].replace(/[.,!?;:]+$/, "").trim();
      return {
        taskDescription: `Open GitHub and search for repository: "${repoQuery}"`,
        targetWebsite: "GitHub",
        steps: [
          {
            id: 1,
            actionName: "OPEN_NEW_TAB",
            description: "Opening new Chrome tab",
            execute: () => chromeController.openNewTab("https://github.com", "GitHub Repo Search"),
          },
          {
            id: 2,
            actionName: "NAVIGATE_GITHUB",
            description: "Navigating to GitHub",
            execute: () => chromeController.navigate("https://github.com"),
          },
          {
            id: 3,
            actionName: "FIND_SEARCH_INPUT",
            description: "Locating GitHub search bar",
            execute: () => chromeController.findElement("GitHub search input"),
          },
          {
            id: 4,
            actionName: "TYPE_REPO_QUERY",
            description: `Entering repository name: "${repoQuery}"`,
            execute: () => chromeController.typeText(repoQuery, undefined, "GitHub search"),
          },
          {
            id: 5,
            actionName: "SUBMIT_SEARCH",
            description: "Submitting GitHub search",
            execute: () => chromeController.pressKey("Enter"),
          },
          {
            id: 6,
            actionName: "WAIT_FOR_RESULTS",
            description: "Waiting for repository matches",
            execute: () => chromeController.waitSeconds(2),
          },
        ],
      };
    }

    // 5. Direct URL: "Open https://example.com"
    const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const directUrl = urlMatch[0];
      return {
        taskDescription: `Navigate to URL: ${directUrl}`,
        targetWebsite: directUrl,
        steps: [
          {
            id: 1,
            actionName: "OPEN_NEW_TAB",
            description: "Opening new Chrome tab",
            execute: () => chromeController.openNewTab(directUrl, "Direct Navigation"),
          },
          {
            id: 2,
            actionName: "NAVIGATE_URL",
            description: `Navigating to ${directUrl}`,
            execute: () => chromeController.navigate(directUrl),
          },
          {
            id: 3,
            actionName: "VERIFY_DESTINATION",
            description: "Verifying website loaded",
            execute: () => chromeController.readPage(),
          },
        ],
      };
    }

    // 6. Registered Website Resolution (e.g. "Open YouTube", "Go to GitHub", "Open Gmail")
    for (const [key, site] of Object.entries(ALLOWED_WEBSITES)) {
      if (site.aliases.some((alias) => lower.includes(alias))) {
        return {
          taskDescription: `Open ${site.name} in a new Chrome tab`,
          targetWebsite: site.name,
          steps: [
            {
              id: 1,
              actionName: "OPEN_NEW_TAB",
              description: "Opening new Chrome tab",
              execute: () => chromeController.openNewTab(site.url, `${site.name} Session`),
            },
            {
              id: 2,
              actionName: "NAVIGATE_SITE",
              description: `Navigating to ${site.name}`,
              execute: () => chromeController.navigate(site.url),
            },
            {
              id: 3,
              actionName: "VERIFY_DESTINATION",
              description: `Verifying ${site.name} loaded`,
              execute: () => chromeController.readPage(),
            },
          ],
        };
      }
    }

    // Fallback: General web search in new Chrome tab
    const fallbackQuery = raw
      .replace(/^(?:hey\s+)?jarvis\s*/i, "")
      .replace(/^(?:open|search|look up|find)\s*/i, "")
      .trim();

    return {
      taskDescription: `Search Google for "${fallbackQuery}" in a new Chrome tab`,
      targetWebsite: "Google",
      steps: [
        {
          id: 1,
          actionName: "OPEN_NEW_TAB",
          description: "Opening new Chrome tab",
          execute: () => chromeController.openNewTab(`https://www.google.com/search?q=${encodeURIComponent(fallbackQuery)}`, "Search Session"),
        },
        {
          id: 2,
          actionName: "VERIFY_DESTINATION",
          description: "Verifying search results",
          execute: () => chromeController.readPage(),
        },
      ],
    };
  }
}

export const browserPlanner = new BrowserTaskPlanner();
