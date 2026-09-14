# J.A.R.V.I.S. — Real Voice-Controlled Windows Assistant

A real, local, voice-controlled personal assistant interface engineered for Windows.

When you speak or type commands, J.A.R.V.I.S. **actually performs the physical operating-system actions locally on your Windows laptop** — opening applications (VS Code, Chrome, Notepad, Calculator, Spotify), opening websites (YouTube, Google, GitHub, Gmail, Drive, ChatGPT), performing contextual searches, reporting real hardware telemetry (CPU, RAM, Battery, Uptime), and retaining persistent memory.

---

## The Complete Pipeline

```
[VOICE / TEXT INPUT]
        ↓
[SPEECH TO TEXT] (Browser Web Speech API or HUD Command Input)
        ↓
[COMMAND NORMALIZATION] (Handles 9+ phrasing variations)
        ↓
[INTENT DETECTION & CONTEXT RESOLUTION] (Resolves "it", target apps, websites, queries)
        ↓
[PERMISSION CHECK] (SAFE / CONFIRM_REQUIRED / BLOCKED)
        ↓
[LOCAL JARVIS AGENT] (http://localhost:8765 & ws://localhost:8765)
        ↓
[WINDOWS ACTION] (PowerShell Start-Process / Native ChildProcess)
        ↓
[EXECUTION VERIFICATION] (Verifies exit code & process launch)
        ↓
[JARVIS RESPONSE] (Spoken aloud: "Certainly. YouTube is open.")
```

> [!IMPORTANT]
> **No Fake Functionality**: J.A.R.V.I.S. will **never** claim an action was done before it actually succeeds. If the local agent is offline, J.A.R.V.I.S. alerts: *"Your local JARVIS agent is offline. Please start it before I can control your computer."* If an execution fails, J.A.R.V.I.S. alerts: *"I wasn't able to open YouTube."*

---

## Windows Startup & Operation Guide

### 1. Install Dependencies
```bash
bun install
```
*(or `npm install`)*

---

### 2. Start the Local Windows Agent

You can start the local Windows agent in either of two ways:

#### Option A: Using the Windows Batch Launcher
Double-click `start-agent.bat` in Windows Explorer or run:
```cmd
start-agent.bat
```

#### Option B: Using the Terminal
```bash
bun run agent
```
*(or `npm run agent`)*

You will see:
```
==================================================
  J.A.R.V.I.S. LOCAL WINDOWS AGENT ONLINE         
  Address: http://localhost:8765                 
  WebSocket: ws://localhost:8765                 
==================================================
```

---

### 3. Verify Health Endpoint

Open your browser or run:
```bash
curl http://localhost:8765/health
```

Expected output:
```json
{
  "status": "online",
  "agent": "jarvis-local-agent",
  "platform": "windows",
  "version": "1.0.0"
}
```

---

### 4. Start the Frontend HUD

In a separate terminal:
```bash
npm run dev
```
*(or `bun run dev`)*

Open the interface in **Google Chrome** or **Microsoft Edge** at `http://localhost:3000`.

---

### 5. Confirm Connection

Look at the top-right header:
```
LOCAL AGENT
● CONNECTED
```
If the agent is not running, it will accurately display:
```
LOCAL AGENT
● OFFLINE
```

---

### 6. Test with the Command Bar First (Text Testing)

Directly below the J.A.R.V.I.S. Greeting in the central zone, you will see the **Command Bar**:
```
> [ Type a command to test (e.g. "open youtube", "open vs code")... ] [ RUN ]
```
1. Type `open youtube` and hit **Enter** or click **RUN**.
2. Notice the HUD states transition: `PROCESSING` ➡️ `EXECUTING` ➡️ `RESPONDING` ➡️ `IDLE`.
3. YouTube **actually opens** in your default browser.
4. J.A.R.V.I.S. speaks: *"Certainly. YouTube is open."*
5. The **Developer Debug Console** shows the exact real-time pipeline telemetry:
   - **USER COMMAND**: `open youtube`
   - **TRANSCRIPT**: `open youtube`
   - **INTENT**: `open_website`
   - **TARGET**: `youtube`
   - **PERMISSION**: `SAFE`
   - **LOCAL AGENT**: `CONNECTED`
   - **ACTION**: `opening https://www.youtube.com`
   - **RESULT**: `SUCCESS`

---

### 7. Test with Voice (Microphone)

1. Click the center circular **MICROPHONE** button.
2. Grant microphone permission when prompted by Chrome/Edge.
3. The HUD indicates: **`LISTENING...`**
4. Say clearly:
   > *"JARVIS, open YouTube."*
5. Watch the state transition:
   - **`PROCESSING`** (orbitals spin)
   - **`EXECUTING`** (Windows executes `Start-Process`)
   - YouTube opens on your screen!
   - **`RESPONDING`** (J.A.R.V.I.S. speaks: *"Certainly. YouTube is open."*)
   - **`IDLE`**

---

## Supported Voice Commands & Phrasing Variations

### 🌐 Websites
All of these phrasings map directly to `open_website`:
- *"Open YouTube"*
- *"JARVIS open YouTube"*
- *"Launch YouTube"*
- *"Take me to YouTube"*
- *"Go to YouTube"*
- *"I want to watch YouTube"*
- *"Open YouTube for me"*
- *"Open GitHub"*
- *"Open Google"*
- *"Open Gmail"*
- *"Open Google Drive"*
- *"Open ChatGPT"*

### 💻 Local Windows Applications
- *"Open VS Code"* ➡️ Launches Visual Studio Code
- *"Launch Chrome"* ➡️ Launches Google Chrome (if already running: *"Chrome is open. What would you like me to do?"*)
- *"Open Notepad"* ➡️ Launches Notepad
- *"Open Calculator"* ➡️ Launches Windows Calculator
- *"Open Spotify"* ➡️ Launches Spotify

### 🔄 Conversational Follow-Ups
- **User:** *"Open YouTube"*
- **JARVIS:** *"Certainly. YouTube is open."*
- **User:** *"Search for TCS NQT"*
- **JARVIS:** *"Searching YouTube for TCS NQT, sir."* (opens YouTube search results)

- **User:** *"Open Chrome"*
- **JARVIS:** *"Chrome is open. What would you like me to do?"*
- **User:** *"Go to GitHub"*
- **JARVIS:** *"Certainly. GitHub is open."*

### 🔋 Battery & System Monitoring
- *"What's my battery?"* ➡️ Reports live percentage via Windows CIM
- *"Check system status"* ➡️ Reports CPU load, memory, and battery

---

## Developer Debug Console

The Developer Debug Console is enabled by default and displays at the bottom of the screen. You can toggle it on/off in **Settings** or by clicking **`CONSOLE: ACTIVE/HIDDEN`** in the bottom-right HUD edge markers.
