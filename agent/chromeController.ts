import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { findChromePath } from "./chromeManager";

export interface BrowserSession {
  sessionId: string;
  tabId: string;
  currentUrl: string;
  pageTitle: string;
  task: string;
  status:
    | "CREATING_TAB"
    | "NAVIGATING"
    | "READING_PAGE"
    | "EXECUTING_ACTION"
    | "WAITING"
    | "COMPLETED"
    | "FAILED";
  createdAt: number;
}

export type BrowserAgentAction =
  | { action: "open_new_tab"; url?: string }
  | { action: "navigate"; url: string }
  | { action: "click"; selector?: string; description?: string }
  | { action: "type"; text: string; selector?: string; description?: string }
  | { action: "press_key"; key: string }
  | { action: "scroll"; direction: "up" | "down" }
  | { action: "wait"; seconds: number }
  | { action: "read_page" }
  | { action: "find_element"; description: string }
  | { action: "get_current_url" }
  | { action: "get_page_title" }
  | { action: "close_current_tab" };

export interface BrowserActionResult {
  success: boolean;
  action: string;
  message: string;
  data?: any;
  currentUrl?: string;
  pageTitle?: string;
  error?: string;
}

export class ChromeBrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private activeSession: BrowserSession | null = null;
  private isInitializing: boolean = false;
  private tabCounter: number = 0;

  /**
   * Ensure browser instance is running and context is ready.
   */
  public async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.browser && this.browser.isConnected()) {
        return this.browser;
      }
    }

    this.isInitializing = true;
    try {
      const chromePath = findChromePath();
      if (!chromePath) {
        throw new Error("Google Chrome executable not found on this system.");
      }

      this.browser = await chromium.launch({
        executablePath: chromePath,
        headless: false,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--start-maximized",
          "--no-first-run",
          "--no-default-browser-check",
        ],
      });

      this.context = await this.browser.newContext({
        viewport: null, // Let Chrome use native full maximized size
      });

      return this.browser;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Action: open_new_tab()
   * Always creates a fresh tab and sets it as the active session.
   */
  public async openNewTab(initialUrl?: string, taskName?: string): Promise<BrowserActionResult> {
    await this.ensureBrowser();
    if (!this.context) throw new Error("Browser context unavailable");

    this.tabCounter++;
    const tabId = `tab-${this.tabCounter}`;
    const sessionId = `jarvis-session-${Date.now()}-${this.tabCounter}`;

    const newPage = await this.context.newPage();
    this.activePage = newPage;

    this.activeSession = {
      sessionId,
      tabId,
      currentUrl: initialUrl || "about:blank",
      pageTitle: "New Tab",
      task: taskName || "Browser task",
      status: "CREATING_TAB",
      createdAt: Date.now(),
    };

    if (initialUrl) {
      return await this.navigate(initialUrl);
    }

    return {
      success: true,
      action: "open_new_tab",
      message: `Created new Chrome tab (${tabId})`,
      currentUrl: "about:blank",
      pageTitle: "New Tab",
      data: { sessionId, tabId },
    };
  }

  /**
   * Action: navigate(url)
   */
  public async navigate(rawUrl: string): Promise<BrowserActionResult> {
    if (!this.activePage) {
      const tabRes = await this.openNewTab();
      if (!tabRes.success) return tabRes;
    }

    let targetUrl = rawUrl.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    try {
      const urlObj = new URL(targetUrl);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return {
          success: false,
          action: "navigate",
          message: `Blocked unsafe protocol: ${urlObj.protocol}`,
          error: "UNSAFE_PROTOCOL",
        };
      }
    } catch {
      return {
        success: false,
        action: "navigate",
        message: `Invalid URL format: ${rawUrl}`,
        error: "INVALID_URL",
      };
    }

    if (this.activeSession) this.activeSession.status = "NAVIGATING";

    try {
      await this.activePage!.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      const title = await this.activePage!.title().catch(() => "");
      const finalUrl = this.activePage!.url();

      if (this.activeSession) {
        this.activeSession.currentUrl = finalUrl;
        this.activeSession.pageTitle = title;
        this.activeSession.status = "COMPLETED";
      }

      return {
        success: true,
        action: "navigate",
        message: `Navigated to ${targetUrl}`,
        currentUrl: finalUrl,
        pageTitle: title,
      };
    } catch (err: any) {
      if (this.activeSession) this.activeSession.status = "FAILED";
      return {
        success: false,
        action: "navigate",
        message: `Navigation failed: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Action: type(text, selector?, description?)
   */
  public async typeText(
    text: string,
    selector?: string,
    description?: string
  ): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "type", message: "No active Chrome tab open" };
    }

    try {
      if (this.activeSession) this.activeSession.status = "EXECUTING_ACTION";

      let targetSelector = selector;
      if (!targetSelector) {
        // Intelligent heuristic: find visible input or search box
        const found = await this.findSearchOrInputSelector(description);
        targetSelector = found || "input:not([type='hidden']), textarea, [contenteditable='true']";
      }

      await this.activePage.waitForSelector(targetSelector, { timeout: 7000 });
      await this.activePage.click(targetSelector);
      await this.activePage.fill(targetSelector, "");
      await this.activePage.type(targetSelector, text, { delay: 35 });

      return {
        success: true,
        action: "type",
        message: `Typed "${text}" into ${description || targetSelector}`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: "type",
        message: `Failed to type: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Action: press_key(key)
   */
  public async pressKey(key: string): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "press_key", message: "No active Chrome tab open" };
    }

    try {
      if (this.activeSession) this.activeSession.status = "EXECUTING_ACTION";
      await this.activePage.keyboard.press(key);

      // Give 1 second for page navigation or AJAX updates
      await this.activePage.waitForTimeout(1000);

      const title = await this.activePage.title().catch(() => "");
      const url = this.activePage.url();

      return {
        success: true,
        action: "press_key",
        message: `Pressed key '${key}'`,
        currentUrl: url,
        pageTitle: title,
      };
    } catch (err: any) {
      return {
        success: false,
        action: "press_key",
        message: `Failed to press key: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Action: click(selector?, description?)
   */
  public async clickElement(selector?: string, description?: string): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "click", message: "No active Chrome tab open" };
    }

    try {
      if (this.activeSession) this.activeSession.status = "EXECUTING_ACTION";

      if (selector) {
        await this.activePage.waitForSelector(selector, { timeout: 6000 });
        await this.activePage.click(selector);
      } else if (description) {
        // Try finding by text or aria-label
        const locator = this.activePage.getByRole("link", { name: description }).or(
          this.activePage.getByRole("button", { name: description })
        ).or(
          this.activePage.locator(`text="${description}"`)
        ).first();

        await locator.click({ timeout: 6000 });
      } else {
        throw new Error("Neither selector nor description provided for click");
      }

      await this.activePage.waitForTimeout(1000);
      return {
        success: true,
        action: "click",
        message: `Clicked ${description || selector}`,
        currentUrl: this.activePage.url(),
        pageTitle: await this.activePage.title().catch(() => ""),
      };
    } catch (err: any) {
      return {
        success: false,
        action: "click",
        message: `Failed to click: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Action: scroll(direction)
   */
  public async scroll(direction: "up" | "down"): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "scroll", message: "No active Chrome tab open" };
    }

    try {
      const scrollY = direction === "down" ? 600 : -600;
      await this.activePage.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), scrollY);
      return {
        success: true,
        action: "scroll",
        message: `Scrolled ${direction}`,
      };
    } catch (err: any) {
      return {
        success: false,
        action: "scroll",
        message: `Failed to scroll: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Action: wait(seconds)
   */
  public async waitSeconds(seconds: number): Promise<BrowserActionResult> {
    if (this.activeSession) this.activeSession.status = "WAITING";
    const ms = Math.min(Math.max(seconds, 0.1), 30) * 1000;
    await new Promise((r) => setTimeout(r, ms));
    return {
      success: true,
      action: "wait",
      message: `Waited ${seconds} seconds`,
    };
  }

  /**
   * Action: read_page()
   */
  public async readPage(): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "read_page", message: "No active Chrome tab open" };
    }

    try {
      if (this.activeSession) this.activeSession.status = "READING_PAGE";
      const title = await this.activePage.title();
      const url = this.activePage.url();

      const textSnippet = await this.activePage.evaluate(() => {
        // Grab main headings, paragraphs, and result titles
        const elements = document.querySelectorAll("h1, h2, h3, p, a h3");
        return Array.from(elements)
          .map((e) => (e as HTMLElement).innerText.trim())
          .filter((t) => t.length > 0)
          .slice(0, 15)
          .join(" | ");
      });

      return {
        success: true,
        action: "read_page",
        message: `Page: ${title} (${url})`,
        data: { title, url, summary: textSnippet },
        currentUrl: url,
        pageTitle: title,
      };
    } catch (err: any) {
      return {
        success: false,
        action: "read_page",
        message: `Failed to read page: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Action: find_element(description)
   */
  public async findElement(description: string): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "find_element", message: "No active Chrome tab open" };
    }

    const selector = await this.findSearchOrInputSelector(description);
    return {
      success: !!selector,
      action: "find_element",
      message: selector ? `Found element: ${selector}` : `Element not found: ${description}`,
      data: { selector, description },
    };
  }

  /**
   * Action: get_current_url()
   */
  public getCurrentUrl(): string {
    return this.activePage?.url() || "about:blank";
  }

  /**
   * Action: get_page_title()
   */
  public async getPageTitle(): Promise<string> {
    return (await this.activePage?.title().catch(() => "")) || "";
  }

  /**
   * Action: close_current_tab()
   */
  public async closeCurrentTab(): Promise<BrowserActionResult> {
    if (!this.activePage) {
      return { success: false, action: "close_current_tab", message: "No active tab to close" };
    }

    try {
      await this.activePage.close();
      this.activePage = null;
      if (this.context) {
        const pages = this.context.pages();
        this.activePage = pages.length > 0 ? pages[pages.length - 1] : null;
      }
      return {
        success: true,
        action: "close_current_tab",
        message: "Closed current Chrome tab",
      };
    } catch (err: any) {
      return {
        success: false,
        action: "close_current_tab",
        message: `Failed to close tab: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Helper to locate search or text inputs dynamically across major platforms.
   */
  private async findSearchOrInputSelector(description?: string): Promise<string | null> {
    if (!this.activePage) return null;

    const currentUrl = this.activePage.url();

    // Specific domain optimizations
    if (currentUrl.includes("youtube.com")) {
      return "input#search, input[name='search_query']";
    }
    if (currentUrl.includes("google.com")) {
      return "textarea[name='q'], input[name='q']";
    }
    if (currentUrl.includes("github.com")) {
      return "input.header-search-input, [data-target='qbsearch-input.inputButtonText'], input[name='q']";
    }

    // Generic visible input heuristic
    const hasSearch = await this.activePage.$("input[type='search'], input[name*='search'], input[placeholder*='Search' i]");
    if (hasSearch) return "input[type='search'], input[name*='search'], input[placeholder*='Search' i]";

    return "input:not([type='hidden']):not([disabled]), textarea";
  }

  /**
   * Get the active session details.
   */
  public getSession(): BrowserSession | null {
    return this.activeSession;
  }
}

export const chromeController = new ChromeBrowserController();
