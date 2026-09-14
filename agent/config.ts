import path from "node:path";
import os from "node:os";

export type PermissionLevel = "SAFE" | "CONFIRM_REQUIRED" | "BLOCKED";

export interface AppDefinition {
  id: string;
  name: string;
  aliases: string[];
  processName: string; // for checking Get-Process
  executable: string;
  windowsCommand?: string;
  defaultArgs?: string[];
}

export interface WebsiteDefinition {
  id: string;
  name: string;
  aliases: string[];
  url: string;
}

export const PORT = Number(process.env.AGENT_PORT || 8765);
export const HOST = process.env.AGENT_HOST || "localhost";

export const ALLOWED_APPS: Record<string, AppDefinition> = {
  vscode: {
    id: "vscode",
    name: "Visual Studio Code",
    aliases: ["vscode", "vs code", "visual studio code", "code editor", "code"],
    processName: "Code",
    executable: "code",
    windowsCommand: "code",
  },
  chrome: {
    id: "chrome",
    name: "Google Chrome",
    aliases: ["chrome", "google chrome", "browser"],
    processName: "chrome",
    executable: "chrome",
    windowsCommand: "start chrome",
  },
  edge: {
    id: "edge",
    name: "Microsoft Edge",
    aliases: ["edge", "ms edge", "microsoft edge"],
    processName: "msedge",
    executable: "msedge",
    windowsCommand: "start msedge",
  },
  notepad: {
    id: "notepad",
    name: "Notepad",
    aliases: ["notepad", "text editor", "notes editor"],
    processName: "notepad",
    executable: "notepad",
    windowsCommand: "notepad",
  },
  calculator: {
    id: "calculator",
    name: "Calculator",
    aliases: ["calculator", "calc"],
    processName: "CalculatorApp",
    executable: "calc",
    windowsCommand: "calc",
  },
  spotify: {
    id: "spotify",
    name: "Spotify",
    aliases: ["spotify", "music"],
    processName: "Spotify",
    executable: "spotify",
    windowsCommand: "spotify",
  },
  terminal: {
    id: "terminal",
    name: "Windows Terminal",
    aliases: ["terminal", "windows terminal", "command prompt", "powershell"],
    processName: "WindowsTerminal",
    executable: "wt",
    windowsCommand: "wt",
  },
  explorer: {
    id: "explorer",
    name: "File Explorer",
    aliases: ["explorer", "file explorer", "files", "my computer"],
    processName: "explorer",
    executable: "explorer",
    windowsCommand: "explorer",
  },
};

export const ALLOWED_WEBSITES: Record<string, WebsiteDefinition> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    aliases: ["youtube", "yt", "youtube videos"],
    url: "https://www.youtube.com",
  },
  google: {
    id: "google",
    name: "Google",
    aliases: ["google", "google search"],
    url: "https://www.google.com",
  },
  github: {
    id: "github",
    name: "GitHub",
    aliases: ["github", "git hub", "repos"],
    url: "https://www.github.com",
  },
  gmail: {
    id: "gmail",
    name: "Gmail",
    aliases: ["gmail", "google mail", "email", "mail"],
    url: "https://mail.google.com",
  },
  drive: {
    id: "drive",
    name: "Google Drive",
    aliases: ["drive", "google drive", "cloud drive"],
    url: "https://drive.google.com",
  },
  calendar: {
    id: "calendar",
    name: "Google Calendar",
    aliases: ["calendar", "google calendar", "schedule"],
    url: "https://calendar.google.com",
  },
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    aliases: ["chatgpt", "chat gpt", "openai", "ai chat"],
    url: "https://chatgpt.com",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    aliases: ["linkedin", "linked in", "my network"],
    url: "https://www.linkedin.com",
  },
  discord: {
    id: "discord",
    name: "Discord",
    aliases: ["discord", "discord app", "chat servers"],
    url: "https://discord.com",
  },
  spotify_web: {
    id: "spotify_web",
    name: "Spotify Web",
    aliases: ["spotify web", "open spotify", "spotify player"],
    url: "https://open.spotify.com",
  },
  stackoverflow: {
    id: "stackoverflow",
    name: "Stack Overflow",
    aliases: ["stackoverflow", "stack overflow"],
    url: "https://stackoverflow.com",
  },
};

// Safe filesystem roots
const userHome = os.homedir();
const workspaceRoot = process.cwd();

export const ALLOWED_DIRECTORIES = [
  path.resolve(workspaceRoot),
  path.resolve(userHome, "JARVIS"),
  path.resolve(userHome, "Documents"),
  path.resolve(userHome, "Downloads"),
  path.resolve(userHome, "Desktop"),
  path.resolve(userHome, "Projects"),
];

// Block sensitive system directories
export const BLOCKED_PATHS = [
  "c:\\windows",
  "c:\\windows\\system32",
  "c:\\program files",
  "c:\\program files (x86)",
  "c:\\programdata",
];

export const TOOL_PERMISSIONS: Record<string, PermissionLevel> = {
  open_application: "SAFE",
  close_application: "SAFE",
  open_website: "SAFE",
  search_web: "SAFE",
  list_files: "SAFE",
  search_files: "SAFE",
  read_file: "SAFE",
  create_folder: "SAFE",
  create_file: "SAFE",
  open_file: "SAFE",
  get_system_status: "SAFE",
  get_time: "SAFE",
  get_tasks: "SAFE",
  create_task: "SAFE",
  create_note: "SAFE",
  search_notes: "SAFE",
  remember_fact: "SAFE",
  recall_fact: "SAFE",
  delete_file: "CONFIRM_REQUIRED",
  system_power: "CONFIRM_REQUIRED",
};
