import os
import sys
from typing import Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.logger import logger
from agent.permissions import validate_action_permission
from agent.chrome_controller import chrome_controller

class CommandRouter:
    def execute_action(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receives structured action requests and routes them to authorized execution handlers.
        """
        action_type = (payload.get("action") or payload.get("type") or "").upper().strip()
        target = (payload.get("target") or payload.get("url") or payload.get("query") or "").strip()

        logger.info(f"CommandRouter received payload: action='{action_type}', target='{target}'")

        # 1. Permission Validation
        allowed, perm_level, reasoning = validate_action_permission(action_type)
        if not allowed:
            logger.warning(f"Action rejected by security policy: {reasoning}")
            return {
                "success": False,
                "status": "REJECTED",
                "permission": perm_level,
                "error": reasoning,
                "action": action_type,
            }

        # 2. Handler Routing
        if action_type in ("OPEN_URL", "NAVIGATE_CHROME", "OPEN_CHROME"):
            url = target or "https://www.google.com"
            res = chrome_controller.open_url(url)
            res["permission"] = perm_level
            return res

        if action_type == "SEARCH_WEB":
            res = chrome_controller.search_web(target)
            res["permission"] = perm_level
            return res

        if action_type == "GET_CHROME_STATUS":
            res = chrome_controller.get_status()
            res["permission"] = perm_level
            res["success"] = True
            return res

        return {
            "success": False,
            "status": "UNHANDLED",
            "error": f"No execution handler implemented for registered action '{action_type}'.",
            "action": action_type,
        }

command_router = CommandRouter()
