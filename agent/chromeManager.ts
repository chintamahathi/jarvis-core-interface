import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec, execSync, spawn } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ChromeStatus {
  available: boolean;
  installed: boolean;
  path: string | null;
  running: boolean;
}

/**
 * Locate the Google Chrome executable on the local Windows machine.
 */
export function findChromePath(): string | null {
  const candidatePaths = [
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // continue checking
    }
  }

  // Fallback: check if 'where chrome' resolves
  try {
    const stdout = execSync("where chrome", {
      stdio: ["pipe", "pipe", "ignore"],
      encoding: "utf-8",
    }).trim();
    const firstLine = stdout.split(/\r?\n/)[0]?.trim();
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch {
    // not in PATH
  }

  return null;
}

// Internal sync helper for where check
function execSync(cmd: string, opts: any): string {
  const { execSync: nodeExecSync } = require("node:child_process");
  return nodeExecSync(cmd, opts);
}

/**
 * Check if Google Chrome is currently running.
 */
export async function isChromeRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "(Get-Process -Name 'chrome' -ErrorAction SilentlyContinue).Count"`,
      { timeout: 3000 }
    );
    const count = parseInt(stdout.trim(), 10);
    return !isNaN(count) && count > 0;
  } catch {
    return false;
  }
}

/**
 * Validate that a URL is safe and well-formed (http or https only).
 */
export function validateUrl(rawUrl: string): { valid: boolean; url: string; error?: string } {
  let trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, url: "", error: "URL cannot be empty." };
  }

  // If starts with www. or domain, prepend https://
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    } else {
      return { valid: false, url: trimmed, error: "Invalid URL format. Must use http:// or https://" };
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, url: trimmed, error: "Only http and https protocols are authorized." };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, url: trimmed, error: "Malformed URL syntax." };
  }
}

/**
 * Core execution: Open Google Chrome with the given URL.
 * Strictly adheres to the Chrome-only policy (no silent fallback to other browsers).
 */
export async function openChromeWithUrl(targetUrl: string): Promise<{
  success: boolean;
  message: string;
  url: string;
  error?: string;
}> {
  const chromePath = findChromePath();
  if (!chromePath) {
    return {
      success: false,
      message: "Chrome isn't available right now.",
      url: targetUrl,
      error: "Google Chrome executable was not found on this Windows system.",
    };
  }

  const validation = validateUrl(targetUrl);
  if (!validation.valid) {
    return {
      success: false,
      message: `Invalid URL: ${validation.error}`,
      url: targetUrl,
      error: validation.error,
    };
  }

  const cleanUrl = validation.url;

  return new Promise((resolve) => {
    try {
      // Launch Chrome directly with the target URL as an argument
      const child = spawn(chromePath, [cleanUrl], {
        detached: true,
        stdio: "ignore",
      });

      child.on("error", (err) => {
        resolve({
          success: false,
          message: "Chrome isn't available right now.",
          url: cleanUrl,
          error: err.message,
        });
      });

      // Detach and unref to let Chrome run independently
      child.unref();

      // Short delay to ensure spawn didn't immediately error
      setTimeout(() => {
        resolve({
          success: true,
          message: `Opened Chrome with ${cleanUrl}`,
          url: cleanUrl,
        });
      }, 250);
    } catch (err: any) {
      resolve({
        success: false,
        message: "Chrome isn't available right now.",
        url: cleanUrl,
        error: err.message,
      });
    }
  });
}

/**
 * Search Google or YouTube via Google Chrome.
 */
export async function searchChrome(
  query: string,
  engine: "google" | "youtube" = "google"
): Promise<{ success: boolean; message: string; url: string; error?: string }> {
  const cleanQuery = query.trim();
  let searchUrl: string;

  if (engine === "youtube") {
    searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
  } else {
    searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
  }

  return openChromeWithUrl(searchUrl);
}

/**
 * Get the current Chrome status.
 */
export async function getChromeStatus(): Promise<ChromeStatus> {
  const chromePath = findChromePath();
  const running = await isChromeRunning();
  return {
    available: chromePath !== null,
    installed: chromePath !== null,
    path: chromePath,
    running,
  };
}

export const chromeManager = {
  findChromePath,
  isChromeRunning,
  validateUrl,
  openChromeWithUrl,
  searchChrome,
  getChromeStatus,
};

