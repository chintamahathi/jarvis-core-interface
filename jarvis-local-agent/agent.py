import os
import sys
import asyncio

# Ensure local imports work regardless of working directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BACKEND_WS_URL, LOCAL_AGENT_ID
from executor import executor
from connection import BackendConnectionManager

def run_test_mode(action_type: str, target: str):
    print("=== RUNNING DIRECT AGENT TEST MODE ===")
    print(f"Action: {action_type} | Target: {target}")

    payload = {"type": action_type, "target": target}
    result = executor.dispatch(payload)

    print(f"Execution Result: {result}")
    if result.get("success"):
        print("[PASS] DIRECT AGENT TEST PASSED SUCCESSFULLY!")
    else:
        print(f"[FAIL] DIRECT AGENT TEST FAILED: {result.get('error')}")

def main():
    print("JARVIS LOCAL AGENT")
    print("==================")
    print(f"Agent ID: {LOCAL_AGENT_ID}")
    print("Platform: Windows")
    print(f"Backend URL: {BACKEND_WS_URL}\n")

    if len(sys.argv) >= 3 and sys.argv[1] == "--test":
        action = sys.argv[2]
        target = sys.argv[3] if len(sys.argv) > 3 else "https://www.youtube.com"
        run_test_mode(action, target)
        return

    conn = BackendConnectionManager()
    try:
        asyncio.run(conn.connect_and_listen())
    except KeyboardInterrupt:
        print("\nStopping J.A.R.V.I.S. Local Windows Agent...")
        conn.stop()

if __name__ == "__main__":
    main()
