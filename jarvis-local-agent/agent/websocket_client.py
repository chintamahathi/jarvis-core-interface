import os
import sys
import asyncio
import json

try:
    import websockets
except ImportError:
    websockets = None

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.config import BACKEND_WS_URL, LOCAL_AGENT_ID, LOCAL_AGENT_SECRET
from agent.logger import logger
from agent.command_router import command_router

class JarvisAgentClient:
    def __init__(self):
        self.backend_url = BACKEND_WS_URL
        self.agent_id = LOCAL_AGENT_ID
        self.secret = LOCAL_AGENT_SECRET
        self.is_running = True

    async def connect_and_listen(self):
        while self.is_running:
            try:
                logger.info(f"Connecting to JARVIS backend at {self.backend_url}...")
                async with websockets.connect(self.backend_url) as ws:
                    logger.info("Connected to backend WebSocket server. Authenticating...")

                    # Send registration & authentication payload
                    auth_payload = {
                        "type": "agent_auth",
                        "agent_id": self.agent_id,
                        "secret": self.secret,
                        "platform": "windows",
                    }
                    await ws.send(json.dumps(auth_payload))

                    async for message_str in ws:
                        try:
                            msg = json.loads(message_str)
                            await self.handle_message(ws, msg)
                        except Exception as err:
                            logger.error(f"Error handling incoming message: {err}")

            except (websockets.exceptions.ConnectionClosedError, OSError) as err:
                logger.warning(f"Connection to backend lost ({err}). Retrying in 5 seconds...")
                await asyncio.sleep(5)
            except Exception as fatal_err:
                logger.error(f"Unexpected WebSocket client error: {fatal_err}. Retrying in 5 seconds...")
                await asyncio.sleep(5)

    async def handle_message(self, ws, msg: dict):
        msg_type = msg.get("type", "").upper()

        if msg_type == "PING":
            await ws.send(json.dumps({"type": "pong", "timestamp": msg.get("timestamp")}))
            return

        if msg_type in ("ACTION", "OPEN_URL", "SEARCH_WEB", "OPEN_CHROME", "NAVIGATE_CHROME", "GET_CHROME_STATUS"):
            logger.info(f"Received structured computer-control request: {msg}")
            result = command_router.execute_action(msg)

            response_payload = {
                "type": "action_result",
                "action": msg.get("action") or msg_type,
                "success": result.get("success", False),
                "target": result.get("target"),
                "error": result.get("error"),
                "message": result.get("message"),
            }
            await ws.send(json.dumps(response_payload))
            logger.info(f"Action execution response sent to backend: {response_payload}")

    def stop(self):
        self.is_running = False
