import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { PORT, HOST, TOOL_PERMISSIONS } from "./config";
import { collectSystemTelemetry, SystemTelemetry } from "./systemMonitor";
import { brain } from "./brain";
import { toolRegistry } from "./tools";
import { browserPlanner } from "./browserPlanner";
import { chromeController } from "./chromeController";

export interface WsMessage {
  type: string;
  [key: string]: any;
}

interface LocalAgentSession {
  agentId: string;
  platform: string;
  capabilities: string[];
  lastHeartbeat: number;
  authenticated: boolean;
}

let activeAgentSocket: WebSocket | null = null;
let activeAgentSession: LocalAgentSession | null = null;
const LOCAL_AGENT_SECRET = process.env.LOCAL_AGENT_SECRET || "jarvis_secret_token_12345";

interface PendingRequest {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timeout: NodeJS.Timeout;
}
const pendingAgentRequests = new Map<string, PendingRequest>();

function executeLocalAgentAction(action: string, target?: string, payload?: any): Promise<any> {
  return new Promise((resolve) => {
    if (
      !activeAgentSocket ||
      activeAgentSocket.readyState !== WebSocket.OPEN ||
      !activeAgentSession ||
      !activeAgentSession.authenticated
    ) {
      return resolve({
        success: false,
        offline: true,
        message: "Local JARVIS agent is offline",
      });
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timeout = setTimeout(() => {
      pendingAgentRequests.delete(requestId);
      resolve({
        success: false,
        message: "Local agent action timed out after 10 seconds",
      });
    }, 10000);

    pendingAgentRequests.set(requestId, { resolve, reject: resolve, timeout });

    try {
      activeAgentSocket.send(
        JSON.stringify({
          type: "EXECUTE_ACTION",
          action,
          target,
          url: target,
          query: target,
          request_id: requestId,
          ...payload,
        })
      );
    } catch (err: any) {
      clearTimeout(timeout);
      pendingAgentRequests.delete(requestId);
      resolve({
        success: false,
        message: `Failed to send action over WebSocket: ${err.message}`,
      });
    }
  });
}

// Periodically monitor agent heartbeat expiry (8 seconds)
setInterval(() => {
  if (activeAgentSession) {
    if (Date.now() - activeAgentSession.lastHeartbeat > 8000) {
      console.log(`[JARVIS AGENT] Agent '${activeAgentSession.agentId}' heartbeat expired. Status: OFFLINE.`);
      activeAgentSession = null;
      activeAgentSocket = null;
      broadcast({ type: "agent_status", status: "offline", agent: null });
    }
  }
}, 3000);

const server = http.createServer(async (req, res) => {
  // Simple CORS and status endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/api/agent/diagnostics") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    const pythonAgentConnected =
      activeAgentSession !== null &&
      activeAgentSession.authenticated &&
      activeAgentSocket !== null &&
      activeAgentSocket.readyState === WebSocket.OPEN;

    res.end(
      JSON.stringify({
        status: pythonAgentConnected ? "online" : "offline",
        agent: "jarvis-local-agent",
        agent_id: activeAgentSession?.agentId || "windows-main",
        platform: activeAgentSession?.platform || "Windows",
        capabilities: activeAgentSession?.capabilities || [
          "OPEN_CHROME",
          "OPEN_URL",
          "SEARCH_WEB",
          "NAVIGATE_CHROME",
        ],
        authenticated: activeAgentSession?.authenticated || false,
        last_heartbeat: activeAgentSession?.lastHeartbeat || 0,
        ws_connected: activeAgentSocket !== null && activeAgentSocket.readyState === WebSocket.OPEN,
        time_since_heartbeat_ms: activeAgentSession ? Date.now() - activeAgentSession.lastHeartbeat : null,
      })
    );
    return;
  }

  if (req.url === "/api/agent/test" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const action = (payload.action || "PING_AGENT").toUpperCase();
        const target = payload.target || payload.url || payload.query || "https://www.youtube.com";

        if (
          !activeAgentSocket ||
          activeAgentSocket.readyState !== WebSocket.OPEN ||
          !activeAgentSession ||
          !activeAgentSession.authenticated
        ) {
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(
            JSON.stringify({ success: false, status: "offline", message: "Local JARVIS agent is offline" })
          );
          return;
        }

        if (action === "PING_AGENT" || action === "PING") {
          const requestId = `ping_${Date.now()}`;
          const promise = new Promise<any>((resolve) => {
            const timeout = setTimeout(() => {
              pendingAgentRequests.delete(requestId);
              resolve({ success: false, message: "Ping timed out" });
            }, 5000);
            pendingAgentRequests.set(requestId, { resolve, reject: resolve, timeout });
          });
          activeAgentSocket.send(JSON.stringify({ type: "PING_AGENT", request_id: requestId }));
          const result = await promise;
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ success: true, result }));
          return;
        }

        const actionResult = await executeLocalAgentAction(action, target);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ success: actionResult.success, result: actionResult }));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (
    req.url === "/api/agent/status" ||
    req.url === "/health" ||
    req.url === "/api/status"
  ) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    const pythonAgentConnected =
      activeAgentSession !== null &&
      activeAgentSession.authenticated &&
      activeAgentSocket !== null &&
      activeAgentSocket.readyState === WebSocket.OPEN;

    res.end(
      JSON.stringify({
        status: "online",
        agent: "jarvis-local-agent",
        agent_id: activeAgentSession?.agentId || "windows-main",
        platform: activeAgentSession?.platform || "Windows",
        capabilities: activeAgentSession?.capabilities || ["OPEN_CHROME", "OPEN_URL", "SEARCH_WEB", "NAVIGATE_CHROME"],
        authenticated: true,
        python_agent_connected: pythonAgentConnected,
        last_heartbeat: activeAgentSession?.lastHeartbeat || Date.now(),
      })
    );
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const userText = (payload.message || payload.text || "").trim();

        if (!userText) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Message content cannot be empty" }));
          return;
        }

        console.log(`[JARVIS AGENT] HTTP POST /api/chat received command: "${userText}"`);

        // Broadcast processing state over WS to UI
        broadcast({ type: "state", value: "PROCESSING" });
        broadcast({
          type: "activity",
          text: "PROCESSING",
          tone: "active",
          timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        });
        broadcast({ type: "log", author: "USER", text: userText });
        broadcast({ type: "syslog", level: "INFO", text: `HTTP Command received: "${userText}"` });

        brain.addMessage("user", userText);

        const intentResult = await brain.determineIntent(userText);
        console.log(`[JARVIS AGENT] Determined intent:`, intentResult);

        const destTarget =
          intentResult.parameters?.target ||
          intentResult.parameters?.application ||
          intentResult.parameters?.query ||
          intentResult.parameters?.url ||
          intentResult.intent;

        const isChromeCommand =
          intentResult.intent === "open_website" ||
          intentResult.intent === "open_chrome" ||
          intentResult.intent === "navigate_chrome" ||
          intentResult.intent === "search_chrome" ||
          intentResult.intent === "search_website_context" ||
          intentResult.intent === "search_web";

        let responsePayload: any = {
          success: true,
          spokenResponse: intentResult.spokenResponse || `Executing ${userText}`,
          logText: `Processed intent: ${intentResult.intent}`,
          intent: intentResult.intent,
          target: destTarget,
          permission: "SAFE",
          actionText: `${intentResult.intent} -> ${destTarget}`,
          userCommand: userText,
          transcript: userText,
        };

        if (intentResult.intent === "none" || !toolRegistry[intentResult.intent]) {
          const speech = intentResult.spokenResponse || "At your service, sir.";
          brain.addMessage("assistant", speech);

          broadcast({ type: "state", value: "RESPONDING" });
          broadcast({
            type: "activity",
            text: "RESPONDING",
            tone: "warning",
            timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          });

          responsePayload = {
            success: true,
            spokenResponse: speech,
            logText: speech,
            intent: "none",
            target: "conversational",
            permission: "SAFE",
            userCommand: userText,
            transcript: userText,
          };
          broadcast({ type: "response", ...responsePayload });
        } else {
          const pythonAgentConnected =
            activeAgentSocket !== null &&
            activeAgentSocket.readyState === WebSocket.OPEN &&
            activeAgentSession?.authenticated;

          if (pythonAgentConnected && (isChromeCommand || intentResult.intent === "open_application")) {
            let actionName = "OPEN_URL";
            let targetUrl = destTarget;

            if (
              intentResult.intent === "search_chrome" ||
              intentResult.intent === "search_web" ||
              intentResult.intent === "search_website_context"
            ) {
              const query = intentResult.parameters?.query || destTarget;
              const engine = intentResult.parameters?.engine;
              actionName = "SEARCH_WEB";
              targetUrl =
                engine === "youtube"
                  ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
                  : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            } else if (intentResult.intent === "open_website") {
              const key = (destTarget || "").toLowerCase();
              if (key.includes("youtube")) targetUrl = "https://www.youtube.com";
              else if (key.includes("github")) targetUrl = "https://github.com";
              else if (key.includes("google")) targetUrl = "https://www.google.com";
              else if (key.includes("gmail")) targetUrl = "https://mail.google.com";
              else if (key.includes("drive")) targetUrl = "https://drive.google.com";
              else if (!targetUrl.startsWith("http")) targetUrl = `https://${key.replace(/\s+/g, "")}.com`;
            } else if (intentResult.intent === "open_chrome" || intentResult.intent === "navigate_chrome") {
              if (!targetUrl || !targetUrl.startsWith("http")) {
                targetUrl = targetUrl ? `https://${targetUrl}` : "https://www.google.com";
              }
            }

            broadcast({ type: "state", value: "EXECUTING", executingLabel: `${actionName} -> ${targetUrl}` });
            const agentRes = await executeLocalAgentAction(actionName, targetUrl);

            if (agentRes.success) {
              const spoken = targetUrl.includes("youtube")
                ? "Certainly, sir. YouTube is open."
                : targetUrl.includes("github")
                ? "Certainly, sir. GitHub is open."
                : targetUrl.includes("google")
                ? "Certainly, sir. Google is open."
                : `Done. Executed ${actionName} in Chrome on your PC, sir.`;
              brain.addMessage("assistant", spoken);

              responsePayload = {
                success: true,
                spokenResponse: spoken,
                logText: agentRes.message || `Executed ${actionName} on Windows PC`,
                toolResult: agentRes,
                intent: intentResult.intent,
                target: targetUrl,
                permission: "SAFE",
                actionText: `${actionName} -> ${targetUrl}`,
                userCommand: userText,
                transcript: userText,
              };
              broadcast({ type: "state", value: "RESPONDING" });
              broadcast({ type: "response", ...responsePayload });
            } else {
              responsePayload = {
                success: false,
                spokenResponse: `I was unable to complete the command: ${agentRes.message || "Execution failed"}`,
                logText: agentRes.message,
                intent: intentResult.intent,
                target: targetUrl,
                permission: "SAFE",
                actionText: "Failed command",
                userCommand: userText,
                transcript: userText,
              };
              broadcast({ type: "state", value: "ERROR" });
              broadcast({ type: "response", ...responsePayload });
            }
          } else if (isChromeCommand) {
            const plan = browserPlanner.createPlan(userText);
            let lastStepResult: any = { success: true };

            for (const step of plan.steps) {
              broadcast({ type: "state", value: "EXECUTING", executingLabel: step.description });
              lastStepResult = await step.execute();
              if (!lastStepResult.success) break;
            }

            const session = chromeController.getSession();
            const finalUrl = session?.currentUrl || lastStepResult.currentUrl;

            if (lastStepResult.success) {
              const spoken = `Done. I've opened ${plan.targetWebsite || "the page"} in a new Chrome tab, sir.`;
              brain.addMessage("assistant", spoken);
              brain.updateContext({ lastMentionedWebsite: plan.targetWebsite, lastWebsiteUrl: finalUrl });

              responsePayload = {
                success: true,
                spokenResponse: spoken,
                logText: `Completed browser task: ${plan.taskDescription}`,
                toolResult: lastStepResult,
                intent: "browser_agent",
                target: plan.targetWebsite,
                permission: "SAFE",
                actionText: plan.taskDescription,
                userCommand: userText,
                transcript: userText,
              };
              broadcast({ type: "state", value: "RESPONDING" });
              broadcast({ type: "response", ...responsePayload });
            } else {
              responsePayload = {
                success: false,
                spokenResponse: `I was unable to complete the browser task: ${lastStepResult.message}`,
                logText: lastStepResult.message,
                intent: "browser_agent",
                target: plan.targetWebsite,
                permission: "SAFE",
                actionText: "Failed browser task",
                userCommand: userText,
                transcript: userText,
              };
              broadcast({ type: "state", value: "ERROR" });
              broadcast({ type: "response", ...responsePayload });
            }
          } else {
            const tool = toolRegistry[intentResult.intent];
            const execResult = await tool.execute(intentResult.parameters, brain.context);
            if (execResult.contextUpdate) brain.updateContext(execResult.contextUpdate);

            const spoken = execResult.spokenResponse || execResult.message;
            brain.addMessage("assistant", spoken);

            responsePayload = {
              success: execResult.success,
              spokenResponse: spoken,
              logText: execResult.message,
              toolResult: execResult,
              intent: tool.name,
              target: destTarget,
              permission: tool.permissionLevel,
              actionText: execResult.actionDescription || `${tool.name} -> ${destTarget}`,
              userCommand: userText,
              transcript: userText,
            };
            broadcast({ type: "state", value: execResult.success ? "RESPONDING" : "ERROR" });
            broadcast({ type: "response", ...responsePayload });
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responsePayload));
      } catch (err: any) {
        console.error("[JARVIS AGENT] Error handling /api/chat:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("J.A.R.V.I.S. Local Windows Agent is Active.");
});

const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

// Pending confirmations map
const pendingConfirmations = new Map<
  string,
  {
    resolve: (val: boolean) => void;
    toolName: string;
    params: any;
  }
>();

function broadcast(msg: WsMessage) {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendToClient(ws: WebSocket, msg: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Broadcast live telemetry periodically
let telemetryInterval: NodeJS.Timeout | null = null;
function startTelemetryStream() {
  if (telemetryInterval) clearInterval(telemetryInterval);
  telemetryInterval = setInterval(async () => {
    if (clients.size === 0) return;
    try {
      const telemetry = await collectSystemTelemetry();
      broadcast({ type: "telemetry", data: telemetry });
    } catch (err) {
      console.error("Telemetry collection error:", err);
    }
  }, 2000);
}

wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
  const connUrl = req.url || "/";
  clients.add(ws);
  console.log(`[JARVIS AGENT] Client connected on ${connUrl}. Active clients: ${clients.size}`);

  if (connUrl === "/ws/agent") {
    console.log(`[JARVIS AGENT] Dedicated local agent connection initialized on /ws/agent.`);
    activeAgentSocket = ws;
  }

  // Send initial connected state and telemetry immediately
  sendToClient(ws, {
    type: "connected",
    message: "Connected to J.A.R.V.I.S. Local Windows Agent",
    version: "Mark VII",
    timestamp: new Date().toISOString(),
  });

  try {
    const initialTelemetry = await collectSystemTelemetry();
    sendToClient(ws, { type: "telemetry", data: initialTelemetry });
  } catch (e) {
    // ignore
  }

  ws.on("message", async (raw: string) => {
    try {
      const message = JSON.parse(raw.toString()) as WsMessage;
      await handleClientMessage(ws, message);
    } catch (err: any) {
      console.error("[JARVIS AGENT] Error parsing message:", err);
      sendToClient(ws, { type: "error", error: "Invalid JSON format" });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (ws === activeAgentSocket) {
      console.log(`[JARVIS AGENT] Python local agent disconnected.`);
      activeAgentSocket = null;
      activeAgentSession = null;
      broadcast({ type: "agent_status", status: "offline", agent: null });
      broadcast({ type: "syslog", level: "WARN", text: "Local Windows Agent disconnected." });
    } else {
      console.log(`[JARVIS AGENT] Frontend client disconnected. Remaining clients: ${clients.size}`);
    }
  });

  ws.on("error", (err) => {
    console.error("[JARVIS AGENT] Socket error:", err);
    clients.delete(ws);
  });
});

async function handleClientMessage(ws: WebSocket, msg: WsMessage) {
  const msgType = (msg.type || "").toString();

  switch (msgType) {
    case "ping":
      sendToClient(ws, { type: "pong", clientTimestamp: msg.timestamp, serverTimestamp: Date.now() });
      break;

    case "agent_auth": {
      const secret = msg.secret || "";
      if (secret === LOCAL_AGENT_SECRET || !LOCAL_AGENT_SECRET) {
        activeAgentSocket = ws;
        activeAgentSession = {
          agentId: msg.agent_id || "windows-main",
          platform: msg.platform || "Windows",
          capabilities: msg.capabilities || ["OPEN_CHROME", "OPEN_URL", "SEARCH_WEB", "NAVIGATE_CHROME"],
          lastHeartbeat: Date.now(),
          authenticated: true,
        };
        console.log(`[JARVIS AGENT] Local agent '${activeAgentSession.agentId}' authenticated successfully.`);
        sendToClient(ws, { type: "agent_auth_response", success: true, status: "authenticated" });
        broadcast({ type: "agent_status", status: "online", agent: activeAgentSession });
      } else {
        console.warn(`[JARVIS AGENT] Rejected local agent authentication attempt: invalid secret.`);
        sendToClient(ws, { type: "agent_auth_response", success: false, error: "Invalid agent secret" });
      }
      break;
    }

    case "AGENT_READY": {
      activeAgentSocket = ws;
      if (activeAgentSession) {
        activeAgentSession.capabilities = msg.capabilities || activeAgentSession.capabilities;
        activeAgentSession.platform = msg.platform || activeAgentSession.platform;
        activeAgentSession.lastHeartbeat = Date.now();
      } else {
        activeAgentSession = {
          agentId: msg.agent_id || "windows-main",
          platform: msg.platform || "Windows",
          capabilities: msg.capabilities || ["OPEN_CHROME", "OPEN_URL", "SEARCH_WEB", "NAVIGATE_CHROME"],
          lastHeartbeat: Date.now(),
          authenticated: true,
        };
      }
      console.log(`[JARVIS AGENT] Agent '${activeAgentSession.agentId}' is ONLINE. Capabilities: ${activeAgentSession.capabilities.join(", ")}`);
      broadcast({ type: "agent_status", status: "online", agent: activeAgentSession });
      broadcast({ type: "syslog", level: "SUCCESS", text: `Local Windows Agent '${activeAgentSession.agentId}' connected & ready.` });
      break;
    }

    case "HEARTBEAT":
    case "AGENT_HEARTBEAT": {
      activeAgentSocket = ws;
      if (activeAgentSession) {
        activeAgentSession.lastHeartbeat = Date.now();
      } else {
        activeAgentSession = {
          agentId: msg.agent_id || "windows-main",
          platform: "Windows",
          capabilities: ["OPEN_CHROME", "OPEN_URL", "SEARCH_WEB", "NAVIGATE_CHROME"],
          lastHeartbeat: Date.now(),
          authenticated: true,
        };
      }
      sendToClient(ws, { type: "HEARTBEAT_ACK", timestamp: Date.now() });
      sendToClient(ws, { type: "pong", timestamp: Date.now() });
      break;
    }

    case "PONG_AGENT": {
      if (msg.request_id && pendingAgentRequests.has(msg.request_id)) {
        const req = pendingAgentRequests.get(msg.request_id)!;
        clearTimeout(req.timeout);
        pendingAgentRequests.delete(msg.request_id);
        req.resolve({ success: true, type: "PONG_AGENT", timestamp: Date.now() });
      } else {
        for (const [id, req] of pendingAgentRequests.entries()) {
          if (id.startsWith("ping_")) {
            clearTimeout(req.timeout);
            pendingAgentRequests.delete(id);
            req.resolve({ success: true, type: "PONG_AGENT", timestamp: Date.now() });
            break;
          }
        }
      }
      break;
    }

    case "ACTION_RESULT": {
      console.log(`[JARVIS AGENT] ACTION_RESULT received:`, msg);
      if (msg.request_id && pendingAgentRequests.has(msg.request_id)) {
        const req = pendingAgentRequests.get(msg.request_id)!;
        clearTimeout(req.timeout);
        pendingAgentRequests.delete(msg.request_id);
        req.resolve(msg);
      } else {
        for (const [id, req] of pendingAgentRequests.entries()) {
          if (id.startsWith("req_")) {
            clearTimeout(req.timeout);
            pendingAgentRequests.delete(id);
            req.resolve(msg);
            break;
          }
        }
      }
      broadcast({
        type: "syslog",
        level: msg.success ? "SUCCESS" : "ERROR",
        text: msg.message || `Action ${msg.action} result: ${msg.success ? "SUCCESS" : "FAILED"}`,
      });
      break;
    }

    case "voice_start":
      broadcast({ type: "state", value: "LISTENING" });
      broadcast({
        type: "activity",
        text: "LISTENING",
        tone: "active",
        timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      });
      break;

    case "confirm_response": {
      const { confirmationId, confirmed } = msg;
      const pending = pendingConfirmations.get(confirmationId);
      if (pending) {
        pending.resolve(!!confirmed);
        pendingConfirmations.delete(confirmationId);
      }
      break;
    }

    // Explicit Structured Action Protocol Support
    case "action":
    case "OPEN_URL":
    case "SEARCH_WEB":
    case "OPEN_CHROME":
    case "NAVIGATE_CHROME": {
      const actionType = (msg.action || msg.type).toUpperCase();
      const target = (msg.target || msg.url || msg.query || "").trim();

      console.log(`[JARVIS AGENT] Structured action received: ${actionType} -> ${target}`);

      broadcast({
        type: "syslog",
        level: "INFO",
        text: `Structured Action: ${actionType}`,
      });

      broadcast({
        type: "state",
        value: "EXECUTING",
        executingLabel: `${actionType} -> ${target}`,
      });

      try {
        let result: any;
        const pythonAgentConnected =
          activeAgentSocket !== null &&
          activeAgentSocket.readyState === WebSocket.OPEN &&
          activeAgentSession?.authenticated;

        if (pythonAgentConnected) {
          result = await executeLocalAgentAction(actionType, target);
        } else if (actionType === "OPEN_URL" || actionType === "NAVIGATE_CHROME") {
          result = await chromeController.openNewTab(target, "Browser Navigation");
        } else if (actionType === "SEARCH_WEB") {
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
          result = await chromeController.openNewTab(searchUrl, "Google Search");
        } else if (actionType === "OPEN_CHROME") {
          result = await chromeController.openNewTab(target || "https://www.google.com", "Chrome");
        } else {
          sendToClient(ws, {
            action: actionType,
            status: "REJECTED",
            error: `Action '${actionType}' is not in the authorized browser action registry.`,
          });
          return;
        }

        if (result.success) {
          broadcast({
            type: "syslog",
            level: "SUCCESS",
            text: `Action ${actionType} completed in Chrome`,
          });
          broadcast({ type: "state", value: "RESPONDING" });

          const spoken = target.includes("youtube")
            ? "YouTube is open, sir."
            : target.includes("github")
            ? "GitHub is open, sir."
            : target.includes("google")
            ? "Google is open, sir."
            : `Completed ${actionType} in Chrome, sir.`;

          sendToClient(ws, {
            action: actionType,
            status: "SUCCESS",
            target: target,
            currentUrl: result.currentUrl || target,
            spokenResponse: spoken,
          });

          broadcast({
            type: "response",
            success: true,
            spokenResponse: spoken,
            logText: `Executed ${actionType} -> ${target}`,
            intent: actionType,
            target: target,
            permission: "SAFE",
            actionText: `${actionType} -> ${target}`,
            userCommand: `${actionType} ${target}`,
            transcript: `${actionType} ${target}`,
          });
        } else {
          broadcast({ type: "state", value: "ERROR" });
          sendToClient(ws, {
            action: actionType,
            status: "FAILED",
            target: target,
            error: result.message,
          });
        }
      } catch (err: any) {
        broadcast({ type: "state", value: "ERROR" });
        sendToClient(ws, {
          action: actionType,
          status: "FAILED",
          target: target,
          error: err.message,
        });
      }
      break;
    }

    case "command":
    case "transcription": {
      const userText = (msg.text || "").trim();
      if (!userText) {
        broadcast({ type: "state", value: "IDLE" });
        return;
      }

      console.log(`[JARVIS AGENT] Speech input: "${userText}"`);

      // 1. PROCESSING State
      broadcast({ type: "state", value: "PROCESSING" });
      broadcast({
        type: "activity",
        text: "PROCESSING",
        tone: "active",
        timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      });
      broadcast({
        type: "log",
        author: "USER",
        text: userText,
      });
      broadcast({
        type: "syslog",
        level: "INFO",
        text: `Command received: "${userText}"`,
      });

      brain.addMessage("user", userText);

      // 2. Intent Determination
      const intentResult = await brain.determineIntent(userText);
      console.log(`[JARVIS AGENT] Determined intent:`, intentResult);

      const destTarget =
        intentResult.parameters?.target ||
        intentResult.parameters?.application ||
        intentResult.parameters?.query ||
        intentResult.parameters?.url ||
        intentResult.intent;

      const isChromeCommand =
        intentResult.intent === "open_website" ||
        intentResult.intent === "open_chrome" ||
        intentResult.intent === "navigate_chrome" ||
        intentResult.intent === "search_chrome" ||
        intentResult.intent === "search_website_context" ||
        intentResult.intent === "search_web";

      if (isChromeCommand) {
        broadcast({
          type: "syslog",
          level: "INFO",
          text: `Destination resolved: ${destTarget}`,
        });
      }

      if (intentResult.intent === "none" || !toolRegistry[intentResult.intent]) {
        // Pure conversational or unhandled response
        const speech = intentResult.spokenResponse || "At your service, sir.";
        brain.addMessage("assistant", speech);

        broadcast({ type: "state", value: "RESPONDING" });
        broadcast({
          type: "activity",
          text: "RESPONDING",
          tone: "warning",
          timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        });
        broadcast({
          type: "response",
          spokenResponse: speech,
          logText: speech,
          intent: "none",
        });
        return;
      }

      const pythonAgentConnected =
        activeAgentSocket !== null &&
        activeAgentSocket.readyState === WebSocket.OPEN &&
        activeAgentSession?.authenticated;

      if (pythonAgentConnected && (isChromeCommand || intentResult.intent === "open_application")) {
        let actionName = "OPEN_URL";
        let targetUrl = destTarget;

        if (
          intentResult.intent === "search_chrome" ||
          intentResult.intent === "search_web" ||
          intentResult.intent === "search_website_context"
        ) {
          const query = intentResult.parameters?.query || destTarget;
          const engine = intentResult.parameters?.engine;
          actionName = "SEARCH_WEB";
          targetUrl =
            engine === "youtube"
              ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
              : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        } else if (intentResult.intent === "open_website") {
          const key = (destTarget || "").toLowerCase();
          if (key.includes("youtube")) targetUrl = "https://www.youtube.com";
          else if (key.includes("github")) targetUrl = "https://github.com";
          else if (key.includes("google")) targetUrl = "https://www.google.com";
          else if (key.includes("gmail")) targetUrl = "https://mail.google.com";
          else if (key.includes("drive")) targetUrl = "https://drive.google.com";
          else if (!targetUrl.startsWith("http")) targetUrl = `https://${key.replace(/\s+/g, "")}.com`;
        } else if (intentResult.intent === "open_chrome" || intentResult.intent === "navigate_chrome") {
          if (!targetUrl || !targetUrl.startsWith("http")) {
            targetUrl = targetUrl ? `https://${targetUrl}` : "https://www.google.com";
          }
        }

        broadcast({ type: "state", value: "EXECUTING", executingLabel: `${actionName} -> ${targetUrl}` });
        const agentRes = await executeLocalAgentAction(actionName, targetUrl);

        if (agentRes.success) {
          const spoken = targetUrl.includes("youtube")
            ? "Certainly, sir. YouTube is open."
            : targetUrl.includes("github")
            ? "Certainly, sir. GitHub is open."
            : targetUrl.includes("google")
            ? "Certainly, sir. Google is open."
            : `Done. Executed ${actionName} in Chrome on your PC, sir.`;
          brain.addMessage("assistant", spoken);

          broadcast({ type: "state", value: "RESPONDING" });
          broadcast({
            type: "response",
            success: true,
            spokenResponse: spoken,
            logText: agentRes.message || `Executed ${actionName} on Windows PC`,
            intent: intentResult.intent,
            target: targetUrl,
            permission: "SAFE",
            actionText: `${actionName} -> ${targetUrl}`,
            userCommand: userText,
            transcript: userText,
          });
        } else {
          broadcast({ type: "state", value: "ERROR" });
          broadcast({
            type: "response",
            success: false,
            spokenResponse: `I was unable to complete the command: ${agentRes.message || "Execution failed"}`,
            logText: agentRes.message,
            intent: intentResult.intent,
            target: targetUrl,
            permission: "SAFE",
            actionText: "Failed command",
            userCommand: userText,
            transcript: userText,
          });
        }
        return;
      }

      const tool = toolRegistry[intentResult.intent];
      const permLevel = tool.permissionLevel;

      // Check for BLOCKED
      if (permLevel === "BLOCKED") {
        const speech = "I cannot execute that command as it violates safety constraints, sir.";
        broadcast({ type: "state", value: "RESPONDING" });
        broadcast({
          type: "response",
          spokenResponse: speech,
          logText: `BLOCKED: ${tool.name}`,
          intent: tool.name,
        });
        return;
      }

      // Check for CONFIRM_REQUIRED
      if (permLevel === "CONFIRM_REQUIRED") {
        const confirmId = `conf_${Date.now()}`;
        broadcast({
          type: "confirmation_required",
          confirmationId: confirmId,
          tool: tool.name,
          params: intentResult.parameters,
          prompt: `Confirm execution of ${tool.name}?`,
        });

        const confirmed = await new Promise<boolean>((resolve) => {
          pendingConfirmations.set(confirmId, {
            resolve,
            toolName: tool.name,
            params: intentResult.parameters,
          });
          setTimeout(() => {
            if (pendingConfirmations.has(confirmId)) {
              pendingConfirmations.delete(confirmId);
              resolve(false);
            }
          }, 30000);
        });

        if (!confirmed) {
          const speech = "Action cancelled, sir.";
          broadcast({ type: "state", value: "RESPONDING" });
          broadcast({
            type: "response",
            spokenResponse: speech,
            logText: `Cancelled ${tool.name}`,
            intent: tool.name,
          });
          return;
        }
      }

      // EXECUTING State (Node Local fallback)
      if (isChromeCommand) {
        broadcast({
          type: "syslog",
          level: "INFO",
          text: "Browser task received",
        });

        const plan = browserPlanner.createPlan(userText);
        broadcast({
          type: "syslog",
          level: "INFO",
          text: `Plan created: ${plan.steps.length} sequential actions`,
        });

        let lastStepResult: any = { success: true };
        for (const step of plan.steps) {
          broadcast({
            type: "state",
            value: "EXECUTING",
            executingLabel: step.description,
          });
          broadcast({
            type: "activity",
            text: step.description.toUpperCase(),
            tone: "active",
            timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          });
          broadcast({
            type: "syslog",
            level: "INFO",
            text: step.description,
          });

          lastStepResult = await step.execute();
          if (!lastStepResult.success) {
            break;
          }
        }

        const session = chromeController.getSession();
        const finalUrl = session?.currentUrl || lastStepResult.currentUrl;

        if (lastStepResult.success) {
          broadcast({
            type: "syslog",
            level: "SUCCESS",
            text: `${plan.targetWebsite || "Task"} completed in new Chrome tab`,
          });
          broadcast({ type: "state", value: "RESPONDING" });
          broadcast({
            type: "activity",
            text: `SUCCESS [${(plan.targetWebsite || "BROWSER").toUpperCase()}]`,
            tone: "warning",
            timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          });

          const spoken = `Done. I've opened ${plan.targetWebsite || "the page"} in a new Chrome tab, sir.`;
          brain.addMessage("assistant", spoken);
          brain.updateContext({ lastMentionedWebsite: plan.targetWebsite, lastWebsiteUrl: finalUrl });

          broadcast({
            type: "response",
            success: true,
            spokenResponse: spoken,
            logText: `Completed browser task: ${plan.taskDescription}`,
            toolResult: lastStepResult,
            intent: "browser_agent",
            target: plan.targetWebsite,
            permission: "SAFE",
            actionText: plan.taskDescription,
            userCommand: userText,
            transcript: userText,
          });
          return;
        } else {
          broadcast({ type: "state", value: "ERROR" });
          broadcast({
            type: "syslog",
            level: "ERROR",
            text: `Browser action failed: ${lastStepResult.message}`,
          });
          broadcast({
            type: "response",
            success: false,
            spokenResponse: `I was unable to complete the browser task: ${lastStepResult.message}`,
            logText: lastStepResult.message,
            intent: "browser_agent",
            target: plan.targetWebsite,
            permission: "SAFE",
            actionText: `Failed browser task`,
            userCommand: userText,
            transcript: userText,
          });
          return;
        }
      }

      const executingMsg = `Executing ${tool.name}...`;

      broadcast({
        type: "state",
        value: "EXECUTING",
        executingLabel: executingMsg,
      });
      broadcast({
        type: "activity",
        text: `EXECUTING [${tool.name.toUpperCase()}]`,
        tone: "active",
        timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      });

      try {
        const execResult = await tool.execute(intentResult.parameters, brain.context);
        if (execResult.contextUpdate) {
          brain.updateContext(execResult.contextUpdate);
        }

        const spoken = execResult.spokenResponse || execResult.message;
        brain.addMessage("assistant", spoken);

        const target = destTarget;

        if (!execResult.success) {
          broadcast({ type: "state", value: "ERROR" });
          broadcast({
            type: "syslog",
            level: "ERROR",
            text: `Failed: ${execResult.message}`,
          });
          broadcast({
            type: "activity",
            text: `FAILED [${tool.name.toUpperCase()}]: ${execResult.message}`,
            tone: "danger",
            timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          });
        } else {
          broadcast({ type: "state", value: "RESPONDING" });
          broadcast({
            type: "activity",
            text: `SUCCESS [${tool.name.toUpperCase()}]`,
            tone: "warning",
            timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          });
        }

        broadcast({
          type: "response",
          success: execResult.success,
          spokenResponse: spoken,
          logText: execResult.message,
          toolResult: execResult,
          intent: tool.name,
          target: target,
          permission: permLevel,
          actionText: execResult.actionDescription || `${tool.name} -> ${target}`,
          userCommand: userText,
          transcript: userText,
        });
      } catch (err: any) {
        console.error(`[JARVIS AGENT] Tool execution error:`, err);
        const errMsg = `Encountered an error executing ${tool.name}: ${err.message}`;
        broadcast({ type: "state", value: "ERROR" });
        broadcast({
          type: "response",
          success: false,
          spokenResponse: `I wasn't able to complete that action, sir.`,
          logText: errMsg,
          intent: tool.name,
          target: "system",
          permission: permLevel,
          actionText: `Error executing ${tool.name}`,
          userCommand: userText,
          transcript: userText,
        });
      }
      break;
    }

    case "speech_finished":
      broadcast({ type: "state", value: "IDLE" });
      break;

    default:
      console.log(`[JARVIS AGENT] Unhandled event: ${msg.type}`);
  }
}

server.listen(PORT, HOST, () => {
  console.log(`==================================================`);
  console.log(`  J.A.R.V.I.S. LOCAL WINDOWS AGENT ONLINE         `);
  console.log(`  Address: http://${HOST}:${PORT}                 `);
  console.log(`  WebSocket: ws://${HOST}:${PORT}                 `);
  console.log(`==================================================`);
  startTelemetryStream();
});

process.on("SIGINT", () => {
  if (telemetryInterval) clearInterval(telemetryInterval);
  server.close();
  process.exit(0);
});
