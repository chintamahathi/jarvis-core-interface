import os
import sys
import subprocess
import urllib.parse
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import CHROME_EXECUTABLE, WEBSITE_REGISTRY
from security import validate_url_security, validate_action_security

class WindowsActionExecutor:
    def __init__(self):
        self.chrome_path = CHROME_EXECUTABLE

    def get_agent_status(self) -> Dict[str, Any]:
        exists = os.path.isfile(CHROME_EXECUTABLE) if CHROME_EXECUTABLE else False
        return {
            "status": "online",
            "platform": "Windows",
            "chrome_available": exists or CHROME_EXECUTABLE == "chrome.exe",
            "chrome_path": CHROME_EXECUTABLE,
        }

    def execute_open_url(self, target_input: str) -> Dict[str, Any]:
        target = (target_input or "").strip()

        lower_target = target.lower()
        if lower_target in WEBSITE_REGISTRY:
            target = WEBSITE_REGISTRY[lower_target]

        if not target.startswith("http://") and not target.startswith("https://"):
            target = f"https://{target}"

        valid, reason = validate_url_security(target)
        if not valid:
            return {"success": False, "error": reason, "target": target_input}

        try:
            print(f"[AGENT] Executing OPEN_URL: '{target}' via subprocess")
            subprocess.Popen([self.chrome_path, target], shell=False)
            return {
                "success": True,
                "action": "OPEN_URL",
                "target": target,
                "message": f"Chrome opened to '{target}' successfully.",
            }
        except Exception as err:
            try:
                subprocess.Popen(f'start chrome "{target}"', shell=True)
                return {
                    "success": True,
                    "action": "OPEN_URL",
                    "target": target,
                    "message": f"Chrome fallback opened to '{target}'.",
                }
            except Exception as fallback_err:
                return {
                    "success": False,
                    "error": f"Failed to launch Chrome: {fallback_err}",
                    "target": target,
                }

    def execute_search_web(self, query: str) -> Dict[str, Any]:
        clean_query = (query or "").strip()
        if not clean_query:
            return {"success": False, "error": "Search query cannot be empty."}

        encoded_query = urllib.parse.quote_plus(clean_query)
        search_url = f"https://www.google.com/search?q={encoded_query}"
        return self.execute_open_url(search_url)

    def dispatch(self, action_payload: Dict[str, Any]) -> Dict[str, Any]:
        action_type = (action_payload.get("type") or action_payload.get("action") or "").upper().strip()
        target = (action_payload.get("url") or action_payload.get("target") or action_payload.get("query") or "").strip()

        allowed, perm_level, reasoning = validate_action_security(action_type)
        if not allowed:
            return {
                "success": False,
                "status": "REJECTED",
                "permission": perm_level,
                "error": reasoning,
                "action": action_type,
            }

        if action_type in ("OPEN_URL", "NAVIGATE_CHROME", "OPEN_CHROME"):
            return self.execute_open_url(target or "https://www.google.com")

        if action_type == "SEARCH_WEB":
            return self.execute_search_web(target)

        if action_type == "GET_AGENT_STATUS":
            res = self.get_agent_status()
            res["success"] = True
            return res

        return {
            "success": False,
            "error": f"No executor implementation found for action '{action_type}'.",
            "action": action_type,
        }

executor = WindowsActionExecutor()
