// Centralized J.A.R.V.I.S. API Service

const API_BASE_URL =
  (typeof window !== "undefined" && (import.meta as any).env?.VITE_AGENT_API_URL) ||
  "http://localhost:8765";

export interface ChatRequestPayload {
  message: string;
  conversation_id?: string;
}

export interface ChatResponsePayload {
  success: boolean;
  spokenResponse?: string;
  logText?: string;
  intent?: string;
  target?: string;
  permission?: string;
  actionText?: string;
  userCommand?: string;
  transcript?: string;
  error?: string;
}

/**
 * Send a chat command (text or finalized voice transcript) to the JARVIS backend API.
 */
export async function sendChatMessage(
  message: string,
  conversationId: string = "default_session"
): Promise<ChatResponsePayload> {
  const cleanMessage = message.trim();
  if (!cleanMessage) {
    throw new Error("Cannot send empty message to J.A.R.V.I.S. backend.");
  }

  if (process.env["NODE_ENV"] !== "production") {
    console.log(`[VOICE] Sending final transcript to backend: "${cleanMessage}"`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: cleanMessage,
        conversation_id: conversationId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data: ChatResponsePayload = await response.json();

    if (process.env["NODE_ENV"] !== "production") {
      console.log("[VOICE] Backend response received:", data);
    }

    return data;
  } catch (err: any) {
    console.error("[VOICE] Backend chat request failed:", err);
    return {
      success: false,
      error: err.message || "Failed to communicate with J.A.R.V.I.S. backend.",
      spokenResponse: "I was unable to connect to the backend server, sir.",
      logText: `Network error: ${err.message}`,
    };
  }
}
