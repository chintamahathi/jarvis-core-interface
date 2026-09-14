import os
import sys
import asyncio
import json
import time
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BACKEND_WS_URL, LOCAL_AGENT_ID, LOCAL_AGENT_SECRET, HEARTBEAT_INTERVAL_SECONDS
from actions import get_agent_capabilities
from executor import executor

try:
    import websockets
except ImportError:
    websockets = None

class BackendConnectionManager:
    def __init__(self):
        self.backend_url = BACKEND_WS_URL
        self.agent_id = LOCAL_AGENT_ID
        self.secret = LOCAL_AGENT_SECRET
        self.is_running = True
        self.is_connected = False
        self.heartbeat_task: Optional[asyncio.Task] = None

    async def send_heartbeat_loop(self, ws):
        while self.is_running and self.is_connected:
            try:
                heartbeat_msg = {
                    "type": "HEARTBEAT",
                    "agent_id": self.agent_id,
                    "timestamp": int(time.time()),
                }
                await ws.send(json.dumps(heartbeat_msg))
                await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            except Exception:
                break

    async def connect_and_listen(self):
        if websockets is None:
            print("[ERROR] Python 'websockets' library is missing. Install with: pip install websockets")
            return

        backoff = 1
        while self.is_running:
            try:
                print(f"[AGENT] Connecting to backend at {self.backend_url}...")
                async with websockets.connect(self.backend_url) as ws:
                    print("[AGENT] Connected to backend")
                    self.is_connected = True

                    # 1. Send Agent Authentication
                    print("[AGENT] Authenticating...")
                    auth_payload = {
                        "type": "agent_auth",
                        "agent_id": self.agent_id,
                        "secret": self.secret,
                        "platform": "Windows",
                    }
                    await ws.send(json.dumps(auth_payload))

                    # 2. Receive Auth ACK
                    auth_resp_raw = await ws.recv()
                    auth_resp = json.loads(auth_resp_raw)
                    if not auth_resp.get("success"):
                        err_reason = auth_resp.get("error", "Invalid secret or authentication rejected.")
                        print(f"[AGENT AUTHENTICATION FAILED] {err_reason}")
                        await asyncio.sleep(5)
                        continue

                    print("[AGENT] Authenticated successfully")

                    # 3. Send AGENT_READY Registration
                    ready_payload = {
                        "type": "AGENT_READY",
                        "agent_id": self.agent_id,
                        "platform": "Windows",
                        "capabilities": get_agent_capabilities(),
                    }
                    await ws.send(json.dumps(ready_payload))
                    print("[AGENT] Agent ONLINE")
                    print("[AGENT] Waiting for commands...\n")

                    # Reset backoff on clean connection
                    backoff = 1

                    # Start background heartbeat loop
                    self.heartbeat_task = asyncio.create_task(self.send_heartbeat_loop(ws))

                    # Listen for messages
                    async for message_str in ws:
                        try:
                            msg = json.loads(message_str)
                            await self.handle_incoming_message(ws, msg)
                        except Exception as err:
                            print(f"[AGENT] Error handling message: {err}")

            except (websockets.exceptions.ConnectionClosedError, OSError) as err:
                self.is_connected = False
                print(f"[AGENT] Connection lost ({err}). Reconnecting in {backoff}s...")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
            except Exception as fatal_err:
                self.is_connected = False
                print(f"[AGENT] Connection error ({fatal_err}). Reconnecting in {backoff}s...")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)

    async def handle_incoming_message(self, ws, msg: dict):
        msg_type = (msg.get("type") or msg.get("action") or "").upper()

        if msg_type == "HEARTBEAT_ACK":
            return

        if msg_type == "PING_AGENT":
            print("[AGENT] Ping received from backend. Sending PONG_AGENT...")
            pong_payload = {"type": "PONG_AGENT", "agent_id": self.agent_id, "timestamp": time.time()}
            if "request_id" in msg:
                pong_payload["request_id"] = msg["request_id"]
            await ws.send(json.dumps(pong_payload))
            return

        if msg_type in ("EXECUTE_ACTION", "ACTION", "OPEN_URL", "SEARCH_WEB", "OPEN_CHROME", "NAVIGATE_CHROME", "GET_AGENT_STATUS"):
            action_data = msg.get("action") if isinstance(msg.get("action"), dict) else msg
            print(f"[AGENT] Received action: {action_data.get('type') or action_data.get('action')} | Target: {action_data.get('url') or action_data.get('query') or action_data.get('target')}")
            print(f"[AGENT] Executing...")

            result = executor.dispatch(action_data)
            req_id = msg.get("request_id") or action_data.get("request_id")

            response_payload = {
                "type": "ACTION_RESULT",
                "agent_id": self.agent_id,
                "action": action_data.get("type") or action_data.get("action"),
                "success": result.get("success", False),
                "target": result.get("target"),
                "error": result.get("error"),
                "message": result.get("message") or ("Action executed successfully." if result.get("success") else result.get("error")),
            }
            if req_id:
                response_payload["request_id"] = req_id

            await ws.send(json.dumps(response_payload))
            print(f"[AGENT] Execution result sent to backend: Success={result.get('success')} | {response_payload['message']}\n")

    def stop(self):
        self.is_running = False
        self.is_connected = False
