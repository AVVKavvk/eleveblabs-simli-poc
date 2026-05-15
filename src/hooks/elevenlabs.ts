import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://back.archietechos.com";

export function useArchieVoice() {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      setIsConnecting(false);
    },
    onDisconnect: () => {
      setIsConnecting(false);
    },
    onError: () => {
      setIsConnecting(false);
      console.error("Error while connecting to agent");
    },
    onAudio(base64Audio: string) {},
  });

  const start = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const res = await fetch(`${API_BASE}/api/signed-url`);
      if (!res.ok) throw new Error("Failed to get signed URL");

      const data = await res.json();
      if (!data.signedUrl) throw new Error("No signed URL received");

      await conversation.startSession({
        signedUrl: data.signedUrl,
        connectionType: "websocket",
      });
    } catch (err) {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return {
    start,
    stop,
    isConnecting,
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    isConnected: conversation.status === "connected",
  };
}
