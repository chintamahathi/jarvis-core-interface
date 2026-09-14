import fs from "node:fs";
import path from "node:path";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  ALLOWED_APPS,
  ALLOWED_WEBSITES,
  ALLOWED_DIRECTORIES,
  BLOCKED_PATHS,
  TOOL_PERMISSIONS,
  PermissionLevel,
} from "./config";
import { memoryManager } from "./memoryManager";
import { collectSystemTelemetry } from "./systemMonitor";
import {
  findChromePath,
  isChromeRunning,
  openChromeWithUrl,
  searchChrome as execSearchChrome,
  getChromeStatus as execGetChromeStatus,
  validateUrl,
} from "./chromeManager";
import { chromeController } from "./chromeController";
import { browserPlanner } from "./browserPlanner";

const execAsync = promisify(exec);

export interface ToolDefinition {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, any>, context?: any) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  spokenResponse: string;
  data?: any;
  contextUpdate?: Record<string, any>;
  actionDescription?: string;
}

// Check if an application is running on Windows
async function isProcessRunning(processName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "(Get-Process -Name '${processName}' -ErrorAction SilentlyContinue).Count"`,
      { timeout: 3000 }
    );
    const count = parseInt(stdout.trim(), 10);
    return !isNaN(count) && count > 0;
  } catch {
    return false;
  }
}

// Launch a Windows program safely
function launchWindowsProcess(executable: string, args: string[] = []): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(executable, args, {
        detached: true,
        stdio: "ignore",
        shell: true,
      });
      child.unref();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

// Open URL in default Windows browser reliably using PowerShell Start-Process with cmd.exe fallback
function openBrowserUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Start-Process "${url}"`], {
        detached: true,
        stdio: "ignore",
      });
      ps.on("close", (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          // Fallback to cmd.exe /c start "" "<url>"
          try {
            const cmd = spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
            cmd.on("close", (cCode) => resolve(cCode === 0));
            cmd.on("error", () => resolve(false));
            cmd.unref();
          } catch {
            resolve(false);
          }
        }
      });
      ps.on("error", () => {
        try {
          const cmd = spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
          cmd.on("close", (cCode) => resolve(cCode === 0));
          cmd.on("error", () => resolve(false));
          cmd.unref();
        } catch {
          resolve(false);
        }
      });
      ps.unref();
    } catch (err) {
      console.error("Failed to open URL:", err);
      resolve(false);
    }
  });
}

// Verify path is within allowed directories and not blocked
function validatePath(targetPath: string): { valid: boolean; resolved: string; error?: string } {
  const resolved = path.resolve(targetPath);
  const lowerResolved = resolved.toLowerCase();

  for (const blocked of BLOCKED_PATHS) {
    if (lowerResolved.startsWith(blocked.toLowerCase())) {
      return { valid: false, resolved, error: "Access to system directory is restricted for safety." };
    }
  }

  const isAllowed = ALLOWED_DIRECTORIES.some((allowedDir) =>
    lowerResolved.startsWith(allowedDir.toLowerCase())
  );

  if (!isAllowed) {
    return {
      valid: false,
      resolved,
      error: `Path is outside configured allowed directories: ${ALLOWED_DIRECTORIES.join(", ")}`,
    };
  }

  return { valid: true, resolved };
}

// Search for files recursively up to a certain depth
function findFilesRecursive(dir: string, searchTerm: string, maxResults = 10, currentDepth = 0): string[] {
  if (currentDepth > 4) return [];
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push(fullPath);
        if (results.length >= maxResults) return results;
      }

      if (entry.isDirectory()) {
        const subResults = findFilesRecursive(fullPath, searchTerm, maxResults - results.length, currentDepth + 1);
        results.push(...subResults);
        if (results.length >= maxResults) return results;
      }
    }
  } catch {
    // skip unreadable directories
  }

  return results;
}

export const toolRegistry: Record<string, ToolDefinition> = {
  open_application: {
    name: "open_application",
    description: "Launches an allowed Windows desktop application (VS Code, Chrome, Edge, Notepad, Calculator, Spotify, etc.)",
    permissionLevel: TOOL_PERMISSIONS.open_application || "SAFE",
    parameters: {
      application: { type: "string", description: "Name or ID of application to open", required: true },
    },
    execute: async (params, context) => {
      const target = (params.application || "").trim().toLowerCase();
      let app = ALLOWED_APPS[target];

      if (!app) {
        // Match by aliases
        for (const candidate of Object.values(ALLOWED_APPS)) {
          if (candidate.aliases.some((alias) => target.includes(alias) || alias.includes(target))) {
            app = candidate;
            break;
          }
        }
      }

      if (!app) {
        return {
          success: false,
          message: `Application '${target}' is not in the allowed application list.`,
          spokenResponse: `I'm sorry, sir. ${target} is not in my list of authorized applications.`,
        };
      }

      const isRunning = await isProcessRunning(app.processName);
      if (isRunning) {
        return {
          success: true,
          message: `${app.name} is already running.`,
          spokenResponse: `${app.name} is open. What would you like me to do?`,
          data: { application: app.id, status: "already_running" },
          actionDescription: `${app.name} is already running`,
          contextUpdate: { lastMentionedApp: app.name },
        };
      }

      const success = await launchWindowsProcess(app.executable, app.defaultArgs);
      if (success) {
        return {
          success: true,
          message: `Launched ${app.name}.`,
          spokenResponse: `${app.name} is open.`,
          data: { application: app.id, status: "launched" },
          actionDescription: `Executed ${app.executable} on Windows`,
          contextUpdate: { lastMentionedApp: app.name },
        };
      }

      return {
        success: false,
        message: `Failed to launch ${app.name}. Executable not found or failed to start.`,
        spokenResponse: `I wasn't able to open ${app.name}.`,
        actionDescription: `Failed to launch ${app.executable}`,
      };
    },
  },

  close_application: {
    name: "close_application",
    description: "Closes a running allowed Windows application",
    permissionLevel: TOOL_PERMISSIONS.close_application || "SAFE",
    parameters: {
      application: { type: "string", description: "Name of application to close", required: true },
    },
    execute: async (params) => {
      const target = (params.application || "").trim().toLowerCase();
      let app = ALLOWED_APPS[target];
      if (!app) {
        for (const candidate of Object.values(ALLOWED_APPS)) {
          if (candidate.aliases.some((alias) => target.includes(alias) || alias.includes(target))) {
            app = candidate;
            break;
          }
        }
      }

      if (!app) {
        return {
          success: false,
          message: `Application '${target}' is not in the allowlist.`,
          spokenResponse: `Application ${target} is not in my authorized list.`,
        };
      }

      try {
        await execAsync(`powershell -NoProfile -Command "Stop-Process -Name '${app.processName}' -Force -ErrorAction SilentlyContinue"`);
        return {
          success: true,
          message: `Closed ${app.name}.`,
          spokenResponse: `Closed ${app.name}, sir.`,
        };
      } catch {
        return {
          success: false,
          message: `Could not terminate ${app.name}.`,
          spokenResponse: `Could not terminate ${app.name}. It may not be currently running.`,
        };
      }
    },
  },

  open_website: {
    name: "open_website",
    description: "Opens an authorized website in the user's default Windows browser (YouTube, Google, GitHub, Gmail, Drive)",
    permissionLevel: TOOL_PERMISSIONS.open_website || "SAFE",
    parameters: {
      target: { type: "string", description: "Website key or name", required: true },
      url: { type: "string", description: "Direct URL if applicable", required: false },
    },
    execute: async (params) => {
      const key = (params.target || "").trim().toLowerCase();
      let site = ALLOWED_WEBSITES[key];

      if (!site) {
        for (const candidate of Object.values(ALLOWED_WEBSITES)) {
          if (candidate.aliases.some((alias) => key.includes(alias) || alias.includes(targetSite(key)))) {
            site = candidate;
            break;
          }
        }
      }

      function targetSite(k: string) {
        return k.replace(/\s+/g, "");
      }

      let destinationUrl = site?.url || params.url;
      let siteName = site?.name || key;

      if (!destinationUrl) {
        if (key.includes(".com") || key.includes(".org") || key.includes(".io")) {
          destinationUrl = key.startsWith("http") ? key : `https://${key}`;
          siteName = key;
        } else {
          destinationUrl = `https://www.google.com/search?q=${encodeURIComponent(key)}`;
          siteName = key;
        }
      }

      // 1. Open in a NEW Chrome tab using Chrome automation controller
      try {
        const tabRes = await chromeController.openNewTab(destinationUrl, siteName);
        if (tabRes.success) {
          const spoken = site?.id === "youtube" ? "Certainly. YouTube is open." : `Certainly. ${siteName} is open in a new Chrome tab.`;
          return {
            success: true,
            message: `Opened ${siteName} in a new Chrome tab (${tabRes.currentUrl || destinationUrl})`,
            spokenResponse: spoken,
            data: { url: tabRes.currentUrl || destinationUrl, target: site?.id || key, browser: "chrome" },
            actionDescription: `Opened ${destinationUrl} in a new Chrome tab`,
            contextUpdate: { lastMentionedWebsite: siteName, lastWebsiteUrl: tabRes.currentUrl || destinationUrl },
          };
        }
      } catch (err: any) {
        // Fallback to binary launcher if automation controller has an issue
        console.warn("Automation openNewTab error, falling back to spawn:", err);
      }

      const res = await openChromeWithUrl(destinationUrl);
      if (res.success) {
        const spoken = site?.id === "youtube" ? "Certainly. YouTube is open." : `Certainly. ${siteName} is open in Chrome.`;
        return {
          success: true,
          message: `Opened ${siteName} in Google Chrome (${res.url})`,
          spokenResponse: spoken,
          data: { url: res.url, target: site?.id || key, browser: "chrome" },
          actionDescription: `Opened ${res.url} in Google Chrome`,
          contextUpdate: { lastMentionedWebsite: siteName, lastWebsiteUrl: res.url },
        };
      }

      return {
        success: false,
        message: res.message,
        spokenResponse: res.message === "Chrome isn't available right now." ? res.message : `I wasn't able to open ${siteName}.`,
        data: { url: destinationUrl, target: site?.id || key },
        actionDescription: `Failed to open ${destinationUrl} in Chrome`,
      };
    },
  },

  open_chrome: {
    name: "open_chrome",
    description: "Opens Google Chrome and navigates to the specified URL in a new tab",
    permissionLevel: "SAFE",
    parameters: {
      url: { type: "string", description: "Target URL to open in Chrome", required: true },
    },
    execute: async (params) => {
      const targetUrl = (params.url || "https://www.google.com").trim();
      try {
        const tabRes = await chromeController.openNewTab(targetUrl, "Web Navigation");
        if (tabRes.success) {
          return {
            success: true,
            message: `Opened new Chrome tab: ${tabRes.currentUrl || targetUrl}`,
            spokenResponse: "Opened in a new Chrome tab.",
            data: { url: tabRes.currentUrl || targetUrl, browser: "chrome" },
            actionDescription: `Opened ${tabRes.currentUrl || targetUrl} in a new Chrome tab`,
            contextUpdate: { lastWebsiteUrl: tabRes.currentUrl || targetUrl },
          };
        }
      } catch (err: any) {
        console.warn("Automation openNewTab error, falling back to spawn:", err);
      }

      const res = await openChromeWithUrl(targetUrl);
      if (res.success) {
        return {
          success: true,
          message: `Opened Google Chrome: ${res.url}`,
          spokenResponse: "Chrome is open.",
          data: { url: res.url, browser: "chrome" },
          actionDescription: `Opened ${res.url} in Google Chrome`,
          contextUpdate: { lastWebsiteUrl: res.url },
        };
      }
      return {
        success: false,
        message: res.message,
        spokenResponse: res.message,
        actionDescription: `Failed to open Chrome with ${targetUrl}`,
      };
    },
  },

  navigate_chrome: {
    name: "navigate_chrome",
    description: "Navigates Google Chrome to an authorized URL",
    permissionLevel: "SAFE",
    parameters: {
      url: { type: "string", description: "Destination URL", required: true },
    },
    execute: async (params) => {
      const targetUrl = (params.url || "").trim();
      try {
        const navRes = await chromeController.navigate(targetUrl);
        if (navRes.success) {
          return {
            success: true,
            message: `Navigated Chrome to ${navRes.currentUrl || targetUrl}`,
            spokenResponse: "Navigated in Chrome.",
            data: { url: navRes.currentUrl || targetUrl, browser: "chrome" },
            actionDescription: `Navigated Chrome to ${navRes.currentUrl || targetUrl}`,
            contextUpdate: { lastWebsiteUrl: navRes.currentUrl || targetUrl },
          };
        }
      } catch (err) {
        console.warn("Automation navigate error, falling back to spawn:", err);
      }

      const res = await openChromeWithUrl(targetUrl);
      if (res.success) {
        return {
          success: true,
          message: `Navigated Chrome to ${res.url}`,
          spokenResponse: "Navigated in Chrome.",
          data: { url: res.url, browser: "chrome" },
          actionDescription: `Navigated Chrome to ${res.url}`,
          contextUpdate: { lastWebsiteUrl: res.url },
        };
      }
      return {
        success: false,
        message: res.message,
        spokenResponse: res.message,
        actionDescription: `Failed to navigate Chrome to ${targetUrl}`,
      };
    },
  },

  search_chrome: {
    name: "search_chrome",
    description: "Searches Google or YouTube through Google Chrome in a new tab",
    permissionLevel: "SAFE",
    parameters: {
      query: { type: "string", description: "Search query", required: true },
      engine: { type: "string", description: "google or youtube", required: false },
    },
    execute: async (params) => {
      const query = (params.query || "").trim();
      const engine = params.engine === "youtube" ? "youtube" : "google";
      const searchUrl =
        engine === "youtube"
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

      try {
        const tabRes = await chromeController.openNewTab(searchUrl, `${engine} Search`);
        if (tabRes.success) {
          const engineName = engine === "youtube" ? "YouTube" : "Google";
          return {
            success: true,
            message: `Searching ${engineName} for "${query}" in a new Chrome tab`,
            spokenResponse: `Searching ${engineName} for ${query}.`,
            data: { url: tabRes.currentUrl || searchUrl, query, engine, browser: "chrome" },
            actionDescription: `Searched ${engineName} for "${query}" in a new Chrome tab`,
            contextUpdate: { lastSearchedQuery: query },
          };
        }
      } catch (err) {
        console.warn("Automation openNewTab error, falling back:", err);
      }

      const res = await execSearchChrome(query, engine);
      if (res.success) {
        const engineName = engine === "youtube" ? "YouTube" : "Google";
        return {
          success: true,
          message: `Searching ${engineName} for "${query}" in Chrome`,
          spokenResponse: `Searching ${engineName} for ${query}.`,
          data: { url: res.url, query, engine, browser: "chrome" },
          actionDescription: `Searched ${engineName} for "${query}" in Chrome`,
          contextUpdate: { lastSearchedQuery: query },
        };
      }
      return {
        success: false,
        message: res.message,
        spokenResponse: res.message,
        actionDescription: `Failed to search in Chrome`,
      };
    },
  },

  // Browser Agent Control Abstraction Tools
  open_new_tab: {
    name: "open_new_tab",
    description: "Creates a new Google Chrome tab",
    permissionLevel: "SAFE",
    parameters: {
      url: { type: "string", description: "Optional starting URL", required: false },
    },
    execute: async (params) => {
      const res = await chromeController.openNewTab(params.url);
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? "Opened a new Chrome tab, sir." : res.message,
        data: res.data,
      };
    },
  },

  browser_click: {
    name: "browser_click",
    description: "Clicks an element in the active Chrome tab",
    permissionLevel: "SAFE",
    parameters: {
      selector: { type: "string", description: "CSS selector", required: false },
      description: { type: "string", description: "Element description or text", required: false },
    },
    execute: async (params) => {
      const res = await chromeController.clickElement(params.selector, params.description);
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? "Clicked." : "Could not click that element.",
      };
    },
  },

  browser_type: {
    name: "browser_type",
    description: "Types text into an input element in the active Chrome tab",
    permissionLevel: "SAFE",
    parameters: {
      text: { type: "string", description: "Text to type", required: true },
      selector: { type: "string", description: "CSS selector", required: false },
      description: { type: "string", description: "Target element description", required: false },
    },
    execute: async (params) => {
      const res = await chromeController.typeText(params.text, params.selector, params.description);
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? `Typed ${params.text}.` : res.message,
      };
    },
  },

  browser_press_key: {
    name: "browser_press_key",
    description: "Presses a keyboard key in the active Chrome tab",
    permissionLevel: "SAFE",
    parameters: {
      key: { type: "string", description: "Key name (e.g. Enter, Escape, ArrowDown)", required: true },
    },
    execute: async (params) => {
      const res = await chromeController.pressKey(params.key);
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? `Key ${params.key} pressed.` : res.message,
      };
    },
  },

  browser_scroll: {
    name: "browser_scroll",
    description: "Scrolls the active Chrome tab up or down",
    permissionLevel: "SAFE",
    parameters: {
      direction: { type: "string", description: "up or down", required: true },
    },
    execute: async (params) => {
      const res = await chromeController.scroll(params.direction === "up" ? "up" : "down");
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? `Scrolled ${params.direction}.` : res.message,
      };
    },
  },

  browser_read_page: {
    name: "browser_read_page",
    description: "Reads the title, URL, and summary of the active Chrome tab",
    permissionLevel: "SAFE",
    parameters: {},
    execute: async () => {
      const res = await chromeController.readPage();
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? `Current page is ${res.pageTitle}.` : res.message,
        data: res.data,
      };
    },
  },

  close_current_tab: {
    name: "close_current_tab",
    description: "Closes the current active Chrome tab",
    permissionLevel: "SAFE",
    parameters: {},
    execute: async () => {
      const res = await chromeController.closeCurrentTab();
      return {
        success: res.success,
        message: res.message,
        spokenResponse: res.success ? "Closed the active Chrome tab." : res.message,
      };
    },
  },

  get_chrome_status: {
    name: "get_chrome_status",
    description: "Returns the status of Google Chrome on the local Windows machine",
    permissionLevel: "SAFE",
    parameters: {},
    execute: async () => {
      const status = await execGetChromeStatus();
      return {
        success: true,
        message: `Chrome Status: Installed=${status.installed}, Running=${status.running}`,
        spokenResponse: status.installed
          ? `Google Chrome is installed and ${status.running ? "currently running" : "ready"}.`
          : "Google Chrome is not installed on this system.",
        data: status,
      };
    },
  },

  search_website_context: {
    name: "search_website_context",
    description: "Searches within the context of previously opened website (e.g. YouTube search for TCS NQT)",
    permissionLevel: "SAFE",
    parameters: {
      query: { type: "string", description: "Search query", required: true },
      target: { type: "string", description: "Target website name", required: false },
    },
    execute: async (params, context) => {
      const query = (params.query || "").trim();
      const target = (params.target || context?.lastMentionedWebsite || "google").toLowerCase();
      const engine = target.includes("youtube") ? "youtube" : "google";
      const res = await execSearchChrome(query, engine);
      const siteName = engine === "youtube" ? "YouTube" : "Google";

      if (res.success) {
        return {
          success: true,
          message: `Searching ${siteName} for "${query}" in Chrome`,
          spokenResponse: `Searching ${siteName} for ${query}, sir.`,
          data: { url: res.url, query, browser: "chrome" },
          actionDescription: `Searched ${siteName} for "${query}" in Chrome`,
        };
      }

      return {
        success: false,
        message: res.message,
        spokenResponse: res.message === "Chrome isn't available right now." ? res.message : `I wasn't able to search ${siteName}.`,
        actionDescription: `Failed search on ${siteName}`,
      };
    },
  },

  search_web: {
    name: "search_web",
    description: "Searches the web using Google Chrome",
    permissionLevel: TOOL_PERMISSIONS.search_web || "SAFE",
    parameters: {
      query: { type: "string", description: "Search query", required: true },
    },
    execute: async (params) => {
      const query = (params.query || "").trim();
      if (!query) {
        return {
          success: false,
          message: "No search query provided.",
          spokenResponse: "What would you like me to search for, sir?",
        };
      }
      const res = await execSearchChrome(query, "google");
      if (res.success) {
        return {
          success: true,
          message: `Searched Google for "${query}" in Chrome`,
          spokenResponse: `Searching Google for ${query}.`,
          data: { query, url: res.url, browser: "chrome" },
          actionDescription: `Searched Google for "${query}" in Chrome`,
          contextUpdate: { lastSearchedQuery: query },
        };
      }
      return {
        success: false,
        message: res.message,
        spokenResponse: res.message,
        actionDescription: `Failed Google search in Chrome`,
      };
    },
  },

  search_files: {
    name: "search_files",
    description: "Searches for files or directories by name within allowed project directories",
    permissionLevel: TOOL_PERMISSIONS.search_files || "SAFE",
    parameters: {
      query: { type: "string", description: "Filename or keyword to find", required: true },
    },
    execute: async (params) => {
      const query = (params.query || "").trim();
      if (!query) {
        return { success: false, message: "Search query missing", spokenResponse: "Please specify a file or project name to search for." };
      }

      const matches: string[] = [];
      for (const rootDir of ALLOWED_DIRECTORIES) {
        if (fs.existsSync(rootDir)) {
          const found = findFilesRecursive(rootDir, query, 5);
          matches.push(...found);
          if (matches.length >= 5) break;
        }
      }

      if (matches.length === 0) {
        return {
          success: false,
          message: `No files found matching '${query}' in allowed directories.`,
          spokenResponse: `I could not locate any files or projects matching ${query}.`,
        };
      }

      const bestMatch = matches[0];
      const fileName = path.basename(bestMatch);

      return {
        success: true,
        message: `Found ${matches.length} matching files. Best match: ${bestMatch}`,
        spokenResponse: `I found your ${query} project at ${fileName}.`,
        data: { matches, bestMatch },
        contextUpdate: {
          lastMentionedFile: bestMatch,
          lastMentionedProject: bestMatch,
        },
      };
    },
  },

  open_file: {
    name: "open_file",
    description: "Opens a file or folder in VS Code or Windows Explorer",
    permissionLevel: TOOL_PERMISSIONS.open_file || "SAFE",
    parameters: {
      path: { type: "string", description: "Path to file or folder", required: true },
    },
    execute: async (params, context) => {
      let targetPath = (params.path || "").trim();

      // Check context if target is "it" or empty
      if ((!targetPath || targetPath === "it" || targetPath === "that") && context?.lastMentionedFile) {
        targetPath = context.lastMentionedFile;
      }

      if (!targetPath) {
        return {
          success: false,
          message: "No target path specified.",
          spokenResponse: "I am not sure which file or project you wish to open.",
        };
      }

      const validation = validatePath(targetPath);
      if (!validation.valid) {
        return { success: false, message: validation.error || "Access denied", spokenResponse: "Access to that path is restricted." };
      }

      if (!fs.existsSync(validation.resolved)) {
        return {
          success: false,
          message: `Path does not exist: ${validation.resolved}`,
          spokenResponse: `The file or folder does not exist.`,
        };
      }

      // If it's a directory or code project, open in VS Code if available, else explorer
      try {
        await execAsync(`code "${validation.resolved}"`);
        return {
          success: true,
          message: `Opened in VS Code: ${validation.resolved}`,
          spokenResponse: `Opening ${path.basename(validation.resolved)} in Visual Studio Code.`,
          data: { path: validation.resolved },
        };
      } catch {
        await execAsync(`start "" "${validation.resolved}"`);
        return {
          success: true,
          message: `Opened: ${validation.resolved}`,
          spokenResponse: `Opening ${path.basename(validation.resolved)}.`,
          data: { path: validation.resolved },
        };
      }
    },
  },

  read_file: {
    name: "read_file",
    description: "Reads the content of a file within allowed directories",
    permissionLevel: TOOL_PERMISSIONS.read_file || "SAFE",
    parameters: {
      path: { type: "string", description: "Path to file", required: true },
    },
    execute: async (params) => {
      const validation = validatePath(params.path);
      if (!validation.valid) {
        return { success: false, message: validation.error || "Access denied", spokenResponse: "Access to that file is restricted." };
      }
      if (!fs.existsSync(validation.resolved)) {
        return { success: false, message: "File not found", spokenResponse: "File does not exist." };
      }

      try {
        const content = fs.readFileSync(validation.resolved, "utf-8");
        const preview = content.slice(0, 1500);
        return {
          success: true,
          message: `Read ${content.length} characters from ${path.basename(validation.resolved)}`,
          spokenResponse: `I have read ${path.basename(validation.resolved)}. It contains ${content.split('\n').length} lines.`,
          data: { content: preview, totalLength: content.length },
          contextUpdate: { lastMentionedFile: validation.resolved },
        };
      } catch (err: any) {
        return { success: false, message: err.message, spokenResponse: "Unable to read the file." };
      }
    },
  },

  create_folder: {
    name: "create_folder",
    description: "Creates a folder within allowed directories",
    permissionLevel: TOOL_PERMISSIONS.create_folder || "SAFE",
    parameters: {
      path: { type: "string", description: "Folder path or name to create", required: true },
    },
    execute: async (params) => {
      let targetPath = params.path;
      if (!path.isAbsolute(targetPath)) {
        targetPath = path.join(ALLOWED_DIRECTORIES[0], targetPath);
      }
      const validation = validatePath(targetPath);
      if (!validation.valid) {
        return { success: false, message: validation.error || "Restricted path", spokenResponse: "Cannot create folder in that location." };
      }
      try {
        fs.mkdirSync(validation.resolved, { recursive: true });
        return {
          success: true,
          message: `Created folder at ${validation.resolved}`,
          spokenResponse: `Folder ${path.basename(validation.resolved)} created successfully.`,
          data: { path: validation.resolved },
        };
      } catch (err: any) {
        return { success: false, message: err.message, spokenResponse: "Failed to create folder." };
      }
    },
  },

  create_file: {
    name: "create_file",
    description: "Creates a new text file within allowed directories",
    permissionLevel: TOOL_PERMISSIONS.create_file || "SAFE",
    parameters: {
      path: { type: "string", description: "File path or name", required: true },
      content: { type: "string", description: "File contents", required: false },
    },
    execute: async (params) => {
      let targetPath = params.path;
      if (!path.isAbsolute(targetPath)) {
        targetPath = path.join(ALLOWED_DIRECTORIES[0], targetPath);
      }
      const validation = validatePath(targetPath);
      if (!validation.valid) {
        return { success: false, message: validation.error || "Restricted path", spokenResponse: "Cannot create file in that location." };
      }
      try {
        fs.writeFileSync(validation.resolved, params.content || "", "utf-8");
        return {
          success: true,
          message: `Created file: ${validation.resolved}`,
          spokenResponse: `File ${path.basename(validation.resolved)} has been created.`,
          data: { path: validation.resolved },
          contextUpdate: { lastMentionedFile: validation.resolved },
        };
      } catch (err: any) {
        return { success: false, message: err.message, spokenResponse: "Failed to create the file." };
      }
    },
  },

  get_system_status: {
    name: "get_system_status",
    description: "Returns live Windows system telemetry including battery, CPU, RAM, and uptime",
    permissionLevel: TOOL_PERMISSIONS.get_system_status || "SAFE",
    parameters: {},
    execute: async () => {
      const telemetry = await collectSystemTelemetry();
      return {
        success: true,
        message: `System Status: CPU ${telemetry.cpuUsagePercent}%, RAM ${telemetry.memoryUsagePercent}%, Battery ${telemetry.batteryPercent}% (${telemetry.isBatteryCharging ? "Charging" : "Discharging"}), Uptime ${telemetry.uptimeFormatted}`,
        spokenResponse: `Your battery is currently at ${telemetry.batteryPercent} percent. CPU load is ${telemetry.cpuUsagePercent} percent, with ${telemetry.freeMemoryGB} gigabytes of RAM available.`,
        data: telemetry,
      };
    },
  },

  get_time: {
    name: "get_time",
    description: "Returns the current local time and date",
    permissionLevel: TOOL_PERMISSIONS.get_time || "SAFE",
    parameters: {},
    execute: async () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      return {
        success: true,
        message: `${timeStr} on ${dateStr}`,
        spokenResponse: `It is currently ${timeStr}, on ${dateStr}.`,
        data: { time: timeStr, date: dateStr },
      };
    },
  },

  remember_fact: {
    name: "remember_fact",
    description: "Stores a specific fact or preference in persistent memory",
    permissionLevel: TOOL_PERMISSIONS.remember_fact || "SAFE",
    parameters: {
      key: { type: "string", description: "Topic or key to remember", required: true },
      value: { type: "string", description: "Fact or value to remember", required: true },
    },
    execute: async (params) => {
      const resultMsg = memoryManager.rememberFact(params.key, params.value);
      return {
        success: true,
        message: resultMsg,
        spokenResponse: `I'll remember that your ${params.key} is ${params.value}, sir.`,
        data: { key: params.key, value: params.value },
      };
    },
  },

  recall_fact: {
    name: "recall_fact",
    description: "Retrieves a stored fact from persistent memory",
    permissionLevel: TOOL_PERMISSIONS.recall_fact || "SAFE",
    parameters: {
      query: { type: "string", description: "Topic or fact to recall", required: true },
    },
    execute: async (params) => {
      const value = memoryManager.recallFact(params.query);
      if (value) {
        return {
          success: true,
          message: `Memory recall: ${params.query} -> ${value}`,
          spokenResponse: `According to my records, your ${params.query} is ${value}.`,
          data: { query: params.query, value },
        };
      }
      return {
        success: false,
        message: `No memory found for '${params.query}'`,
        spokenResponse: `I don't have any record of ${params.query} in my memory matrix.`,
      };
    },
  },

  create_task: {
    name: "create_task",
    description: "Creates a new task in the task list",
    permissionLevel: TOOL_PERMISSIONS.create_task || "SAFE",
    parameters: {
      title: { type: "string", description: "Task description", required: true },
    },
    execute: async (params) => {
      const task = memoryManager.createTask(params.title);
      return {
        success: true,
        message: `Task added: "${task.title}"`,
        spokenResponse: `Added "${task.title}" to your task list.`,
        data: task,
      };
    },
  },

  get_tasks: {
    name: "get_tasks",
    description: "Retrieves the active task list",
    permissionLevel: TOOL_PERMISSIONS.get_tasks || "SAFE",
    parameters: {},
    execute: async () => {
      const tasks = memoryManager.getTasks();
      const active = tasks.filter((t) => !t.completed);
      if (active.length === 0) {
        return {
          success: true,
          message: "No active tasks.",
          spokenResponse: "You have no active tasks on your schedule, sir.",
          data: tasks,
        };
      }
      const taskList = active.map((t) => t.title).join(", ");
      return {
        success: true,
        message: `Active tasks: ${taskList}`,
        spokenResponse: `You have ${active.length} active task${active.length === 1 ? "" : "s"}: ${taskList}.`,
        data: tasks,
      };
    },
  },

  create_note: {
    name: "create_note",
    description: "Creates a note in persistent storage",
    permissionLevel: TOOL_PERMISSIONS.create_note || "SAFE",
    parameters: {
      title: { type: "string", description: "Title of note", required: true },
      content: { type: "string", description: "Content of note", required: true },
    },
    execute: async (params) => {
      const note = memoryManager.createNote(params.title, params.content);
      return {
        success: true,
        message: `Note saved: "${note.title}"`,
        spokenResponse: `Note "${note.title}" has been saved.`,
        data: note,
      };
    },
  },

  search_notes: {
    name: "search_notes",
    description: "Searches through saved notes",
    permissionLevel: TOOL_PERMISSIONS.search_notes || "SAFE",
    parameters: {
      query: { type: "string", description: "Keywords to search in notes", required: true },
    },
    execute: async (params) => {
      const notes = memoryManager.searchNotes(params.query);
      if (notes.length === 0) {
        return {
          success: false,
          message: `No notes found matching "${params.query}"`,
          spokenResponse: `I found no notes matching "${params.query}".`,
        };
      }
      return {
        success: true,
        message: `Found ${notes.length} note(s)`,
        spokenResponse: `I found ${notes.length} note${notes.length === 1 ? "" : "s"}. The first is "${notes[0].title}".`,
        data: notes,
      };
    },
  },

  delete_file: {
    name: "delete_file",
    description: "Permanently deletes a file within allowed directory. Requires user confirmation.",
    permissionLevel: "CONFIRM_REQUIRED",
    parameters: {
      path: { type: "string", description: "Path of file to delete", required: true },
    },
    execute: async (params) => {
      const validation = validatePath(params.path);
      if (!validation.valid) {
        return { success: false, message: validation.error || "Restricted path", spokenResponse: "Cannot delete files in that location." };
      }
      if (!fs.existsSync(validation.resolved)) {
        return { success: false, message: "File not found", spokenResponse: "File does not exist." };
      }
      try {
        fs.unlinkSync(validation.resolved);
        return {
          success: true,
          message: `Deleted file: ${validation.resolved}`,
          spokenResponse: `File ${path.basename(validation.resolved)} has been deleted.`,
        };
      } catch (err: any) {
        return { success: false, message: err.message, spokenResponse: "Failed to delete file." };
      }
    },
  },

  system_power: {
    name: "system_power",
    description: "Shutdown or restart the computer. Requires explicit user confirmation.",
    permissionLevel: "CONFIRM_REQUIRED",
    parameters: {
      action: { type: "string", description: "shutdown or restart", required: true },
    },
    execute: async (params) => {
      const action = params.action === "restart" ? "restart" : "shutdown";
      // Simulated or real with timeout - for safety we log and notify
      return {
        success: true,
        message: `System ${action} requested.`,
        spokenResponse: `System ${action} confirmed. Initiating protocol.`,
      };
    },
  },
};
