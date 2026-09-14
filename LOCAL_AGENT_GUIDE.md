# J.A.R.V.I.S. Local Windows Agent Guide

## Overview

The **J.A.R.V.I.S. Local Windows Agent** is the local desktop bridge running on your Windows laptop. Because browser frontends (like React running in Google Chrome or Edge) are sandboxed by standard web security and cannot directly invoke Windows desktop processes, the Local Agent establishes a local WebSocket communication link between the J.A.R.V.I.S. interface and your computer.

```
JARVIS FRONTEND (HUD)
       │
       ▼ (ws://localhost:8765)
LOCAL JARVIS AGENT (Windows Process)
       │
       ▼ (Native Process / Playwright Controller)
GOOGLE CHROME (Application/chrome.exe)
       │
       ▼
REQUESTED WEBSITE / SEARCH (YouTube, Google, GitHub, etc.)
```

---

## Permissions & Access Requirements

### Do you need to grant special Windows permissions?
**No special administrator permissions or driver installs are required for everyday operation.**

- **User-Level Execution**: The agent runs as your standard user account (`C:\Users\chint\...`) and only requires standard user permissions.
- **Chrome Binary**: Uses your installed Chrome at `C:\Users\chint\AppData\Local\Google\Chrome\Application\chrome.exe` (or `C:\Program Files\Google\Chrome\Application\chrome.exe`).
- **Microphone Access**: Your web browser (Chrome/Edge) will request **Microphone Permission** for the Web Speech API once when you tap the central HUD microphone button. Click **Allow**.
- **Windows Firewall**: If Windows Defender Firewall shows a one-time prompt asking whether Node/Bun can accept local loopback connections on port 8765, click **Allow access** for Private networks (loopback `127.0.0.1`).

---

## 1. How to Install the Local Agent

The agent is located inside your repository under the `agent/` directory:

1. Open PowerShell or Command Prompt.
2. Navigate to your workspace directory:
   ```powershell
   cd C:\Users\chint\JARVIS\jarvis-core-interface
   ```
3. Ensure dependencies (`playwright-core`, `ws`, etc.) are installed:
   ```powershell
   bun install
   # OR
   npm install
   ```

---

## 2. How to Start the Local Agent

Run the dedicated startup script from your workspace:

```powershell
bun run agent
# OR
npm run agent
```

When started, you will see the console confirmation:
```text
==================================================
  J.A.R.V.I.S. LOCAL WINDOWS AGENT ONLINE         
  Address: http://localhost:8765                 
  WebSocket: ws://localhost:8765                 
==================================================
```

---

## 3. How to Connect it to the JARVIS Backend & Frontend

1. Ensure your `.env` has:
   ```env
   AGENT_PORT=8765
   AGENT_HOST=localhost
   VITE_AGENT_WS_URL=ws://localhost:8765
   ```
2. When the frontend HUD loads at `http://localhost:3000`, it automatically:
   - Queries `http://localhost:8765/health` to check if the agent is active.
   - Connects to `ws://localhost:8765`.
   - Displays the green **LOCAL AGENT: CONNECTED** indicator in the top right of the HUD.

---

## 4. How the Agent Authenticates & Secures Actions

- **Direct Loopback Protocol**: Only connections from localhost (`127.0.0.1` / `localhost`) are accepted.
- **Strict Allowed Browser Actions**:
  - `OPEN_URL`: Validates URL protocol (`http:` / `https:` only) and resolves official service addresses.
  - `SEARCH_WEB`: Safely URL-encodes search queries and opens Google in Chrome.
  - `OPEN_CHROME`: Launches Google Chrome in a new tab.
  - `NAVIGATE_CHROME`: Navigates the active Chrome tab.
- **Zero Shell Exposure**: Arbitrary PowerShell, CMD, or bash execution from AI prompts is completely rejected and disabled.
- **Zero API Key Leakage**: Backend API keys remain strictly local in environment variables and are never transmitted over the WebSocket.

---

## 5. How to Test the Connection

1. In PowerShell or Git Bash, test the HTTP health endpoint:
   ```powershell
   curl http://localhost:8765/health
   ```
   **Expected Response:**
   ```json
   {"status":"online","agent":"jarvis-local-agent","platform":"windows","version":"1.0.0"}
   ```

2. Run the automated acceptance test suite:
   ```powershell
   bun run agent/test-suite.ts
   ```
   **Expected Result:**
   ```text
   ALL CHROME-FIRST TESTS PASSED SUCCESSFULLY!
   ```

---

## 6. How to Test "Open YouTube"

### Method A: Voice
1. Tap the central microphone button in the JARVIS HUD.
2. Speak clearly:
   > *"JARVIS, open YouTube"*
3. The HUD will transition:
   `LISTENING` ➡️ `PROCESSING` ➡️ `EXECUTING` (*"Opening YouTube in new Chrome tab"*) ➡️ `RESPONDING` (*"YouTube is open, sir."*).
4. Google Chrome will immediately open to `https://www.youtube.com` in a new tab.

### Method B: Direct HUD Input
1. Type `open youtube` in the command input bar right beneath the greeting.
2. Press **Enter** or click **RUN**.

---

## 7. How to Test Google Search

### Method A: Voice
1. Tap the central microphone button.
2. Say:
   > *"Search Google for TCS NQT 2026 syllabus"*
3. J.A.R.V.I.S. opens a new Chrome tab and executes the Google search query.

### Method B: Structured Action Protocol Test
You can send structured JSON directly over WebSocket:
```json
{
  "action": "SEARCH_WEB",
  "target": "TCS NQT 2026 syllabus"
}
```
The agent returns:
```json
{
  "action": "SEARCH_WEB",
  "status": "SUCCESS",
  "target": "TCS NQT 2026 syllabus"
}
```

---

## 8. Troubleshooting Connection Failures

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Top bar shows "LOCAL AGENT: OFFLINE"** | The background agent process is not running. | Run `bun run agent` in your terminal. Check that port 8765 is not blocked. |
| **"Chrome isn't available right now"** | Chrome executable path was not found. | Ensure Chrome is installed in standard path: `AppData\Local\Google\Chrome\Application\chrome.exe`. |
| **Microphone does not respond** | Browser permission blocked. | Click the lock icon in the Chrome URL address bar next to `localhost:3000` and toggle **Microphone** to **Allow**. |
| **Port 8765 Already in Use** | An orphaned node/bun process is holding the port. | Run `Stop-Process -Name "bun","node" -Force` in PowerShell and restart with `bun run agent`. |
