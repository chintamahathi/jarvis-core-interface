import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.logger import logger
from agent.command_router import command_router
from agent.websocket_client import JarvisAgentClient

def run_test_command(action_type: str, target: str):
    logger.info(f"=== RUNNING DIRECT AGENT TEST MODE ===")
    logger.info(f"Action: {action_type} | Target: {target}")

    payload = {"action": action_type, "target": target}
    result = command_router.execute_action(payload)

    logger.info(f"Test Execution Result: {result}")
    if result.get("success"):
        logger.info("[PASS] DIRECT AGENT TEST PASSED SUCCESSFULLY!")
    else:
        logger.error(f"[FAIL] DIRECT AGENT TEST FAILED: {result.get('error')}")

def main():
    print("==================================================")
    print("  J.A.R.V.I.S. LOCAL WINDOWS AGENT (Python)       ")
    print("  Status: ONLINE                                  ")
    print("==================================================")

    if len(sys.argv) >= 3 and sys.argv[1] == "--test":
        action = sys.argv[2]
        target = sys.argv[3] if len(sys.argv) > 3 else "https://www.youtube.com"
        run_test_command(action, target)
        return

    client = JarvisAgentClient()
    try:
        asyncio.run(client.connect_and_listen())
    except KeyboardInterrupt:
        logger.info("Stopping J.A.R.V.I.S. Local Windows Agent...")
        client.stop()

if __name__ == "__main__":
    main()
