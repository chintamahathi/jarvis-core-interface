import urllib.parse
from typing import Tuple

SAFE_ACTIONS = {
    "OPEN_CHROME",
    "OPEN_URL",
    "SEARCH_WEB",
    "NAVIGATE_CHROME",
    "GET_AGENT_STATUS",
}

CONFIRM_REQUIRED_ACTIONS = {
    "DELETE_FILE",
    "MOVE_FILE",
    "RUN_COMMAND",
    "INSTALL_APPLICATION",
    "CHANGE_SYSTEM_SETTINGS",
}

BLOCKED_ACTIONS = {
    "DESTRUCTIVE_SYSTEM_COMMAND",
    "UNRESTRICTED_SHELL",
    "PASSWORD_ACCESS",
    "CREDENTIAL_ACCESS",
}

def validate_action_security(action_type: str) -> Tuple[bool, str, str]:
    action_type = (action_type or "").upper().strip()

    if action_type in SAFE_ACTIONS:
        return True, "SAFE", f"Action '{action_type}' is registered as SAFE."

    if action_type in CONFIRM_REQUIRED_ACTIONS:
        return False, "CONFIRM_REQUIRED", f"Action '{action_type}' requires user authorization."

    if action_type in BLOCKED_ACTIONS:
        return False, "BLOCKED", f"Action '{action_type}' is strictly BLOCKED for system security."

    return False, "BLOCKED", f"Action '{action_type}' is unknown and rejected."

def validate_url_security(url: str) -> Tuple[bool, str]:
    if not url:
        return False, "Empty URL provided."

    parsed = urllib.parse.urlparse(url.strip())
    scheme = parsed.scheme.lower()

    if scheme not in ("http", "https"):
        return (
            False,
            f"Security policy rejected URL scheme '{scheme}:'. Only 'http:' and 'https:' are permitted.",
        )

    danger_patterns = ["javascript:", "data:", "vbscript:", "file://"]
    lower_url = url.lower()
    for pattern in danger_patterns:
        if pattern in lower_url:
            return False, f"Security violation detected: URL contains unsafe payload pattern '{pattern}'."

    return True, "URL validated successfully."
