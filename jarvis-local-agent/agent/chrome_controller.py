import os
import sys
import subprocess
import urllib.parse
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.config import CHROME_EXECUTABLE, WEBSITE_REGISTRY
from agent.logger import logger
from agent.permissions import validate_url_security

class ChromeController:
    def __init__(self):
        self.chrome_path = CHROME_EXECUTABLE
        logger.info(f"ChromeController initialized. Executable path: '{self.chrome_path}'")

    def get_status(self) -> Dict[str, Any]:
        exists = os.path.isfile(self.chrome_path) if self.chrome_path else False
        return {
            "available": exists or self.chrome_path == "chrome.exe",
            "executable_path": self.chrome_path,
            "browser": "Google Chrome",
            "platform": "windows",
        }

    def open_url(self, target_url: str) -> Dict[str, Any]:
        url = target_url.strip()

        # Check canonical website registry shortcuts (e.g. "youtube" -> "https://www.youtube.com")
        lower_target = url.lower()
        if lower_target in WEBSITE_REGISTRY:
            url = WEBSITE_REGISTRY[lower_target]

        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"

        valid, reason = validate_url_security(url)
        if not valid:
            logger.error(f"URL Security check failed: {reason}")
            return {"success": False, "error": reason, "target": target_url}

        try:
            logger.info(f"Launching Chrome target: '{url}' via subprocess")
            subprocess.Popen([self.chrome_path, url], shell=False)
            return {
                "success": True,
                "action": "OPEN_URL",
                "target": url,
                "message": f"Successfully launched Chrome with target URL '{url}'",
            }
        except Exception as err:
            logger.error(f"Failed to launch Chrome executable: {err}")
            # Fallback to Windows start command
            try:
                subprocess.Popen(f'start chrome "{url}"', shell=True)
                return {
                    "success": True,
                    "action": "OPEN_URL",
                    "target": url,
                    "message": f"Successfully launched Chrome fallback with target URL '{url}'",
                }
            except Exception as fallback_err:
                return {
                    "success": False,
                    "error": f"Failed to open Chrome: {fallback_err}",
                    "target": url,
                }

    def search_web(self, query: str) -> Dict[str, Any]:
        clean_query = query.strip()
        if not clean_query:
            return {"success": False, "error": "Search query cannot be empty."}

        encoded_query = urllib.parse.quote_plus(clean_query)
        search_url = f"https://www.google.com/search?q={encoded_query}"
        return self.open_url(search_url)

chrome_controller = ChromeController()
