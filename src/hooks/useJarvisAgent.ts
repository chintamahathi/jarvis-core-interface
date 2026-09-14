import { useEffect, useRef, useState, useCallback } from "react";
import { sendChatMessage } from "@/services/jarvis";

export type VoiceState = "IDLE" | "LISTENING" | "PROCESSING" | "EXECUTING" | "RESPONDING" | "ERROR";

export interface TelemetryData {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  totalMemoryGB: string;
  freeMemoryGB: string;
  usedMemoryGB: string;
  batteryPercent: number;
  isBatteryCharging: boolean;
  uptimeFormatted: string;
  uptimeSeconds: number;
  diskFreeGB?: string;
  diskTotalGB?: string;
  diskUsagePercent?: number;
  networkStatus: "ONLINE" | "OFFLINE";
  networkType: string;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  time: string;
  state: string;
  tone: "active" | "warning" | "muted" | "danger";
}

export interface SystemLogEntry {
  id: string;
  time: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  text: string;
}

export interface ConfirmationRequest {
  confirmationId: string;
  tool: string;
  prompt: string;
  params: any;
}

export interface DebugInfo {
  userCommand: string;
  transcript: string;
  intent: string;
  target: string;
  permission: string;
  agentStatus: "CONNECTED" | "OFFLINE";
  action: string;
  result: "SUCCESS" | "FAILED" | "EXECUTING" | "PENDING" | "IDLE";
}

const DEFAULT_WS_URL =
  (typeof window !== "undefined" && (import.meta as any).env?.VITE_AGENT_WS_URL) ||
  "ws://localhost:8765";

const HEALTH_URL = "http://localhost:8765/api/agent/status";

export function useJarvisAgent() {
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [executingLabel, setExecutingLabel] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState(8);
  const [commandCount, setCommandCount] = useState(0);
  const [lastCommand, setLastCommand] = useState<string>("open youtube");
  const [lastResponse, setLastResponse] = useState<string>("SYSTEM ONLINE. READY FOR INPUT.");
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);

  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([
    { id: "1", time: "16:14:20", level: "INFO", text: "Chrome bridge ready" },
    { id: "2", time: "16:14:31", level: "INFO", text: "Local agent online" },
    { id: "3", time: "16:14:52", level: "SUCCESS", text: "Systems initialized" },
  ]);

  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    userCommand: "open youtube",
    transcript: "open youtube",
    intent: "open_website",
    target: "youtube",
    permission: "SAFE",
    agentStatus: "CONNECTED",
    action: "opening https://www.youtube.com in Chrome",
    result: "IDLE",
  });

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpuUsagePercent: 15,
    memoryUsagePercent: 42,
    totalMemoryGB: "8.0",
    freeMemoryGB: "4.6",
    usedMemoryGB: "3.4",
    batteryPercent: 100,
    isBatteryCharging: false,
    uptimeFormatted: "0h 0m",
    uptimeSeconds: 0,
    networkStatus: "ONLINE",
    networkType: "LOCAL / WIFI",
    timestamp: new Date().toISOString(),
  });

  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: "1", time: "16:14:52", state: "SYSTEM ONLINE", tone: "active" },
    { id: "2", time: "16:14:31", state: "CHROME BRIDGE READY", tone: "active" },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const silenceTimerRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);

  const addActivity = useCallback(
    (state: string, tone: "active" | "warning" | "muted" | "danger" = "active") => {
      const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setActivities((prev) => [
        { id: `${Date.now()}_${Math.random()}`, time, state, tone },
        ...prev.slice(0, 15),
      ]);
    },
    []
  );

  const addSystemLog = useCallback(
    (level: "INFO" | "SUCCESS" | "WARN" | "ERROR", text: string) => {
      const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setSystemLogs((prev) => [
        ...prev.slice(-12),
        { id: `${Date.now()}_${Math.random()}`, time, level, text },
      ]);
    },
    []
  );

  // Send raw message to WebSocket
  const sendWs = useCallback((msg: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  // Text-To-Speech execution
  const speakResponse = useCallback(
    (text: string, onDone?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setVoiceState("IDLE");
        setExecutingLabel(null);
        if (onDone) onDone();
        return;
      }

      window.speechSynthesis.cancel();
      isSpeakingRef.current = true;
      setVoiceState("RESPONDING");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("UK") ||
              v.name.includes("George") ||
              v.name.includes("David") ||
              v.name.includes("Natural"))
        ) || voices.find((v) => v.lang.startsWith("en"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      const finish = () => {
        isSpeakingRef.current = false;
        setVoiceState("IDLE");
        setExecutingLabel(null);
        sendWs({ type: "speech_finished" });
        if (onDone) onDone();
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);
    },
    [sendWs]
  );

  // Periodically check local agent health endpoint
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch(HEALTH_URL, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.status === "online") {
            setIsConnected(true);
            setDebugInfo((prev) => ({ ...prev, agentStatus: "CONNECTED" }));
          }
        } else {
          if (isMounted) {
            setIsConnected(false);
            setDebugInfo((prev) => ({ ...prev, agentStatus: "OFFLINE" }));
          }
        }
      } catch {
        if (isMounted) {
          setIsConnected(false);
          setDebugInfo((prev) => ({ ...prev, agentStatus: "OFFLINE" }));
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    let reconnectTimeout: any = null;
    let pingInterval: any = null;
    let isUnmounted = false;

    function connect() {
      try {
        const ws = new WebSocket(DEFAULT_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsConnected(true);
          addActivity("AGENT CONNECTED", "active");
          addSystemLog("INFO", "Local agent connected");
          setDebugInfo((prev) => ({ ...prev, agentStatus: "CONNECTED" }));

          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
            }
          }, 4000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "pong": {
                if (data.clientTimestamp) {
                  const rtt = Date.now() - data.clientTimestamp;
                  setLatencyMs(Math.max(1, rtt));
                }
                break;
              }

              case "agent_status": {
                const isOnline = data.status === "online";
                setIsConnected(isOnline);
                setDebugInfo((prev) => ({
                  ...prev,
                  agentStatus: isOnline ? "CONNECTED" : "OFFLINE",
                }));
                break;
              }

              case "state": {
                if (data.value) {
                  setVoiceState(data.value as VoiceState);
                }
                if (data.executingLabel) {
                  setExecutingLabel(data.executingLabel);
                }
                break;
              }

              case "telemetry": {
                if (data.data) {
                  setTelemetry(data.data);
                }
                break;
              }

              case "activity": {
                if (data.text) {
                  addActivity(data.text, data.tone || "active");
                }
                break;
              }

              case "syslog": {
                if (data.text) {
                  addSystemLog(data.level || "INFO", data.text);
                }
                break;
              }

              case "log": {
                if (data.text) {
                  setLastCommand(data.text);
                  setCommandCount((c) => c + 1);
                }
                break;
              }

              case "confirmation_required": {
                setPendingConfirmation({
                  confirmationId: data.confirmationId,
                  tool: data.tool,
                  prompt: data.prompt,
                  params: data.params,
                });
                break;
              }

              case "response": {
                if (data.logText) {
                  setLastResponse(data.logText);
                }

                setDebugInfo({
                  userCommand: data.userCommand || lastCommand,
                  transcript: data.transcript || data.userCommand || lastCommand,
                  intent: data.intent || "none",
                  target: data.target || "chrome",
                  permission: data.permission || "SAFE",
                  agentStatus: "CONNECTED",
                  action: data.actionText || data.logText || "Executed Chrome action",
                  result: data.success ? "SUCCESS" : "FAILED",
                });

                if (data.success === false) {
                  setVoiceState("ERROR");
                  addActivity(`EXECUTION FAILED: ${data.logText}`, "danger");
                } else {
                  addActivity(`SUCCESS: ${data.logText}`, "active");
                }

                if (data.spokenResponse) {
                  speakResponse(data.spokenResponse);
                } else {
                  setVoiceState("IDLE");
                  setExecutingLabel(null);
                }
                break;
              }
            }
          } catch (e) {
            console.error("Failed to parse agent message:", e);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setIsConnected(false);
          clearInterval(pingInterval);
          addActivity("AGENT OFFLINE", "muted");
          setDebugInfo((prev) => ({ ...prev, agentStatus: "OFFLINE" }));
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [addActivity, addSystemLog, lastCommand, speakResponse]);

  // Execute Command pipeline (Shared for both voice & text input!)
  const executeCommand = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      setLastCommand(clean);
      addActivity(`COMMAND: "${clean}"`, "active");
      addSystemLog("INFO", `Command received: "${clean}"`);

      // Transition to PROCESSING
      setVoiceState("PROCESSING");
      setExecutingLabel("Processing request...");
      setDebugInfo({
        userCommand: clean,
        transcript: clean,
        intent: "analyzing...",
        target: "analyzing...",
        permission: "SAFE",
        agentStatus: "CONNECTED",
        action: "routing to Chrome Windows controller...",
        result: "EXECUTING",
      });

      // Call Centralized API Service for HTTP POST /api/chat & fall back to WebSocket
      try {
        console.log(`[VOICE] Sending command to backend: "${clean}"`);
        sendWs({ type: "transcription", text: clean });
        const res = await sendChatMessage(clean);
        setIsConnected(true);
        if (res && res.spokenResponse) {
          setLastResponse(res.spokenResponse);
        } else if (res && res.error) {
          setVoiceState("ERROR");
          setLastResponse(`Backend error: ${res.error}`);
          addActivity(`BACKEND ERROR: ${res.error}`, "danger");
        }
      } catch (err: any) {
        console.error("[VOICE] Error dispatching command to backend:", err);
        setIsConnected(false);
        setVoiceState("ERROR");
        const offlineMsg = "Your local JARVIS agent is offline. Please start it using 'bun run agent' or 'start-agent.bat' or 'python jarvis-local-agent/agent.py'.";
        setExecutingLabel("BROWSER AGENT OFFLINE");
        setLastResponse(offlineMsg);
        addActivity("BROWSER AGENT OFFLINE", "danger");
        addSystemLog("ERROR", "Chrome control unavailable: local JARVIS agent offline");
        setDebugInfo({
          userCommand: clean,
          transcript: clean,
          intent: "browser_agent",
          target: "offline",
          permission: "SAFE",
          agentStatus: "OFFLINE",
          action: "Aborted - BROWSER AGENT OFFLINE",
          result: "FAILED",
        });
        speakResponse(offlineMsg);
      }
    },
    [addActivity, addSystemLog, sendWs, speakResponse]
  );

  // Error handling mapping helper
  const handleVoiceError = useCallback(
    (errCode: string) => {
      let userMsg = "Voice recognition encountered an issue.";
      if (errCode === "not-allowed" || errCode === "service-not-allowed") {
        userMsg = "Microphone permission is required.";
      } else if (errCode === "no-speech") {
        userMsg = "I didn't hear anything.";
      } else if (errCode === "audio-capture") {
        userMsg = "I couldn't access your microphone.";
      } else if (errCode === "network") {
        userMsg = "Speech recognition encountered a network problem.";
      } else if (errCode === "aborted") {
        userMsg = "Speech recognition was aborted.";
      } else {
        userMsg = `Speech recognition error: ${errCode}`;
      }

      console.error(`[VOICE] Recognition error: ${errCode} -> ${userMsg}`);
      setVoiceState("ERROR");
      setExecutingLabel(null);
      setLastResponse(userMsg);
      addActivity(`VOICE ERROR: ${userMsg}`, "warning");
      speakResponse(userMsg);
    },
    [addActivity, speakResponse]
  );

  const isListeningRef = useRef(false);
  const lastSeenTranscriptRef = useRef<string>("");

  // Setup Web Speech API recognition
  const startListening = useCallback(() => {
    console.log("[VOICE] Microphone activated");

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("[VOICE] Speech recognition is not supported in this browser. Please use Google Chrome.");
      const unsupportedMsg = "Speech recognition is not supported in this browser. Please use Google Chrome.";
      setVoiceState("ERROR");
      setExecutingLabel(null);
      setLastResponse(unsupportedMsg);
      addActivity("BROWSER NOT SUPPORTED", "danger");
      speakResponse(unsupportedMsg);
      return;
    }

    // Toggle off if already listening to prevent duplicate instances
    if (isListeningRef.current && recognitionRef.current) {
      console.log("[VOICE] Stopping active recognition instance");
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      isListeningRef.current = false;
      setVoiceState("IDLE");
      return;
    }

    if (isSpeakingRef.current) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
      recognition.maxAlternatives = 1;

      finalTranscriptRef.current = "";
      lastSeenTranscriptRef.current = "";
      setInterimTranscript("");

      recognition.onstart = () => {
        console.log("[VOICE] Speech recognition started");
        isListeningRef.current = true;
        setVoiceState("LISTENING");
        setExecutingLabel(null);
        sendWs({ type: "voice_start" });
        addActivity("LISTENING...", "active");

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          console.warn("[VOICE] Recognition timed out (silence limit reached).");
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {}
          }
        }, 12000);
      };

      recognition.onspeechstart = () => {
        console.log("[VOICE] Speech detected");
      };

      recognition.onresult = (event: any) => {
        console.log("[VOICE] Speech result received");

        // Clear silence timer on first valid result
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        let interimText = "";
        let finalText = "";

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const chunk = res?.[0]?.transcript || "";
          if (res.isFinal) {
            finalText += chunk;
          } else {
            interimText += chunk;
          }
        }

        const combined = (finalText || interimText).trim();
        if (combined) {
          lastSeenTranscriptRef.current = combined;
        }

        if (interimText) {
          setInterimTranscript(interimText);
          console.log(`[VOICE] Interim transcript: ${interimText}`);
        }

        if (finalText) {
          finalTranscriptRef.current = finalText.trim();
          setInterimTranscript(finalText.trim());
          console.log(`[VOICE] Final transcript: ${finalText.trim()}`);
        }
      };

      recognition.onspeechend = () => {
        console.log("[VOICE] Speech ended");
      };

      recognition.onerror = (event: any) => {
        console.error(`[VOICE] Recognition error: ${event.error}`);
        isListeningRef.current = false;
        handleVoiceError(event.error);
      };

      recognition.onend = () => {
        console.log("[VOICE] Recognition ended");
        isListeningRef.current = false;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const finalCmd = (finalTranscriptRef.current || lastSeenTranscriptRef.current || "").trim();
        setInterimTranscript("");

        if (finalCmd) {
          executeCommand(finalCmd);
        } else {
          setVoiceState((curr) => {
            if (curr === "LISTENING") {
              handleVoiceError("no-speech");
              return "ERROR";
            }
            return curr;
          });
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error("[VOICE] Speech recognition start exception:", err);
      isListeningRef.current = false;
      handleVoiceError("aborted");
    }
  }, [addActivity, executeCommand, handleVoiceError, sendWs, speakResponse]);

  // Handle user confirmation dialog
  const resolveConfirmation = useCallback(
    (confirmed: boolean) => {
      if (!pendingConfirmation) return;
      sendWs({
        type: "confirm_response",
        confirmationId: pendingConfirmation.confirmationId,
        confirmed,
      });
      setPendingConfirmation(null);
    },
    [pendingConfirmation, sendWs]
  );

  return {
    voiceState,
    executingLabel,
    interimTranscript,
    isConnected,
    latencyMs,
    telemetry,
    activities,
    systemLogs,
    lastCommand,
    lastResponse,
    commandCount,
    pendingConfirmation,
    debugInfo,
    startListening,
    resolveConfirmation,
    sendCommandText: executeCommand,
  };
}

