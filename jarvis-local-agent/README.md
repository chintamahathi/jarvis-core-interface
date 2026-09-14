# J.A.R.V.I.S. Python Local Windows Agent

The **J.A.R.V.I.S. Python Local Windows Agent** is a secure, lightweight desktop application for Windows that connects to your J.A.R.V.I.S. backend over WebSocket. It receives structured actions (opening Chrome, URLs, searches) and executes them on your Windows PC.

---

## 1. Quick Setup

```powershell
cd jarvis-local-agent

# (Optional) Create Python Virtual Environment
python -m venv venv
.\venv\Scripts\Activate

# Install Dependencies
pip install -r requirements.txt

# Create .env from template
copy .env.example .env
```

---

## 2. Run the Agent

```powershell
python agent.py
```

Console Output:
```text
JARVIS LOCAL AGENT
------------------
Agent ID: windows-main
Platform: Windows
Backend: http://localhost:8765
Connecting...
Connected
Authenticated
Agent ONLINE
Waiting for commands...
```

---

## 3. Direct Test Mode (No Voice Required)

Verify opening YouTube directly:
```powershell
python agent.py --test OPEN_URL https://www.youtube.com
```

---

## 4. Windows Startup Configuration (Optional)

To run the agent automatically when Windows starts:
1. Press `Win + R`, type `shell:startup`, and press **Enter**.
2. Right-click and create a shortcut pointing to:
   `pythonw.exe C:\Users\chint\JARVIS\jarvis-core-interface\jarvis-local-agent\agent.py`
