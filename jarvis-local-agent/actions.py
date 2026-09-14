from typing import Dict, List

class ActionDefinition:
    def __init__(self, name: str, description: str, permission_level: str, parameters: List[str]):
        self.name = name
        self.description = description
        self.permission_level = permission_level
        self.parameters = parameters

ACTION_REGISTRY: Dict[str, ActionDefinition] = {
    "OPEN_CHROME": ActionDefinition(
        name="OPEN_CHROME",
        description="Launch Google Chrome browser on Windows",
        permission_level="SAFE",
        parameters=["url"],
    ),
    "OPEN_URL": ActionDefinition(
        name="OPEN_URL",
        description="Open target website URL in Google Chrome",
        permission_level="SAFE",
        parameters=["url"],
    ),
    "SEARCH_WEB": ActionDefinition(
        name="SEARCH_WEB",
        description="Execute web search query in Google Chrome",
        permission_level="SAFE",
        parameters=["query"],
    ),
    "NAVIGATE_CHROME": ActionDefinition(
        name="NAVIGATE_CHROME",
        description="Navigate Google Chrome tab to URL",
        permission_level="SAFE",
        parameters=["url"],
    ),
    "GET_AGENT_STATUS": ActionDefinition(
        name="GET_AGENT_STATUS",
        description="Retrieve local Windows agent system status & capabilities",
        permission_level="SAFE",
        parameters=[],
    ),
}

def get_agent_capabilities() -> List[str]:
    return list(ACTION_REGISTRY.keys())
