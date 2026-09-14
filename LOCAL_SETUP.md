# J.A.R.V.I.S. Local Agent Setup & Windows Configuration Guide

This guide provides step-by-step instructions for installing, configuring, authenticating, and testing the J.A.R.V.I.S. Local Windows Agent.

---

## 1. Prerequisites

- **Operating System**: Windows 10 / 11.
- **Browser**: Google Chrome installed in standard Windows location (`C:\Users\<user>\AppData\Local\Google\Chrome\Application\chrome.exe` or `C:\Program Files\Google\Chrome\Application\chrome.exe`).
- **Runtime**: Python 3.9+ or Bun / Node.js.

---

## 2. Python Local Windows Agent Setup

### Step 1: Open PowerShell
Navigate to your repository root:
```powershell
cd C:\Users\chint\JARVIS\jarvis-core-interface\jarvis-local-agent
```

### Step 2: Create Python Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate
```

### Step 3: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
copy .env.example .env
```
Ensure `.env` contains:
```env
BACKEND_URL=ws://localhost:8765
LOCAL_AGENT_ID=jarvis-windows-agent-01
LOCAL_AGENT_SECRET=jarvis_secret_token_12345
CHROME_PATH=
```

---

## 3. Verify Local Agent Execution (Direct Test Mode)

Before connecting to the frontend, test opening YouTube directly through the Windows agent:

```powershell
python agent/main.py --test OPEN_URL https://www.youtube.com
```

**Expected Result**:
- Console logs `[INFO] Launching Chrome target: 'https://www.youtube.com'`.
- Google Chrome launches immediately and opens YouTube.
- Console displays `✓ DIRECT AGENT TEST PASSED SUCCESSFULLY!`.

---

## 4. Run the Local Windows Agent

Launch the agent to connect to the backend server:

```powershell
python agent/main.py
```

Console Output:
```text
==================================================
  J.A.R.V.I.S. LOCAL WINDOWS AGENT (Python)       
  Status: ONLINE                                  
==================================================
[INFO] Connecting to JARVIS backend at ws://localhost:8765...
[INFO] Connected to backend WebSocket server. Authenticating...
```

---

## 5. Alternative Launcher (Bun / Node Agent)

If you prefer using the TypeScript Node/Bun agent:
```powershell
cd C:\Users\chint\JARVIS\jarvis-core-interface
bun run agent
# OR
start-agent.bat
```

---

## 6. End-to-End Testing Flow

1. Open the frontend HUD at `http://localhost:3000`.
2. Check top bar: **LOCAL AGENT: CONNECTED** (green indicator).
3. Tap the central microphone button.
4. Speak: *"JARVIS, open YouTube"*.
5. **Expected Outcome**:
   - Status changes: `LISTENING` ➡️ `PROCESSING` ➡️ `EXECUTING` ➡️ `RESPONDING` ➡️ `IDLE`.
   - Log shows: `[INFO] Intent detected: OPEN_URL`, `[INFO] Destination resolved: YouTube`.
   - Chrome opens `https://www.youtube.com`.
   - JARVIS speaks: *"YouTube is open, sir."*.

6. Speak: *"JARVIS, search Google for TCS NQT 2026"*.
   - **Expected Outcome**: Google search opens query for `TCS NQT 2026` in Chrome.

---

## 7. Troubleshooting Common Errors

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"JARVIS local agent is offline"** | Agent process is not running. | Run `python agent/main.py` inside `jarvis-local-agent` or run `bun run agent`. |
| **"Chrome path invalid / not found"** | Chrome is installed in non-standard location. | Set `CHROME_PATH=C:\path\to\chrome.exe` in `jarvis-local-agent/.env`. |
| **Microphone Permission Denied** | Browser blocked mic access. | Click lock icon in Chrome URL address bar next to `localhost:3000` and allow Microphone. |
| **URL Security Warning** | Requested URL starts with `file:`, `javascript:`, or `data:`. | Safety filter blocks unsafe schemes. Only `http:` and `https:` are permitted. |
