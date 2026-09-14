import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Backend Connection Config
BACKEND_WS_URL = os.getenv("BACKEND_URL", "ws://localhost:8765/ws/agent")
BACKEND_HTTP_URL = os.getenv("BACKEND_HTTP_URL", "http://localhost:8765")
LOCAL_AGENT_ID = os.getenv("LOCAL_AGENT_ID", "windows-main")
LOCAL_AGENT_SECRET = os.getenv("LOCAL_AGENT_SECRET", "jarvis_secret_token_12345")
HEARTBEAT_INTERVAL_SECONDS = int(os.getenv("HEARTBEAT_INTERVAL", "3"))

# Chrome Executable Path Detection on Windows
CUSTOM_CHROME_PATH = os.getenv("CHROME_PATH", "")

def find_chrome_executable() -> str:
    if CUSTOM_CHROME_PATH and os.path.isfile(CUSTOM_CHROME_PATH):
        return CUSTOM_CHROME_PATH

    local_app_data = os.getenv("LOCALAPPDATA", "")
    program_files = os.getenv("PROGRAMFILES", "C:\\Program Files")
    program_files_x86 = os.getenv("PROGRAMFILES(X86)", "C:\\Program Files (x86)")

    candidates = [
        os.path.join(local_app_data, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(program_files, "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(program_files_x86, "Google", "Chrome", "Application", "chrome.exe"),
    ]

    for path in candidates:
        if path and os.path.isfile(path):
            return path

    return "chrome.exe"  # Fallback to system PATH

CHROME_EXECUTABLE = find_chrome_executable()

# Canonical Website Registry
WEBSITE_REGISTRY = {
    "youtube": "https://www.youtube.com",
    "google": "https://www.google.com",
    "github": "https://github.com",
    "gmail": "https://mail.google.com",
    "drive": "https://drive.google.com",
    "calendar": "https://calendar.google.com",
    "chatgpt": "https://chatgpt.com",
    "linkedin": "https://www.linkedin.com",
    "discord": "https://discord.com",
    "spotify": "https://open.spotify.com",
}
