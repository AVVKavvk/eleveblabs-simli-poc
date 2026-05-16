// App.jsx - Simli video avatar + ElevenLabs audio pipeline

import { SimliClient, LogLevel } from "simli-client";
import { useSimliStore } from "./store/simliStore.js";
import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

const AGENT_ID = import.meta.env.VITE_elevenLabsAgentId;
const API_KEY = import.meta.env.VITE_elevenLabsApiKey;

async function getZToken() {
  try {
    const tokenResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`,
      {
        method: "GET",
        headers: { "xi-api-key": API_KEY },
      },
    );

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get token: ${tokenResponse.statusText}`);
    }

    const data = await tokenResponse.json();
    const signedUrl = data.signed_url;
    console.log("Token retrieved successfully:", signedUrl);
    return signedUrl;
  } catch (error) {
    console.error("getZToken failed:", error);
    throw error;
  }
}

function App() {
  const { getSimliSessionToken } = useSimliStore();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const simliClientRef = useRef(null);
  const isActiveRef = useRef(false);

  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [error, setError] = useState(null);

  // ─── ElevenLabs conversation ───────────────────────────────────────────────
  const conversation = useConversation({
    onConnect: () => setStatus("connected"),
    onDisconnect: () => {
      if (isActiveRef.current) setStatus("idle");
    },
    onError: (e) => {
      console.error("ElevenLabs error", e);
      setError("ElevenLabs connection lost");
      setStatus("error");
    },

    // Every audio chunk ElevenLabs produces → forward to Simli for lip-sync
    onAudio: (base64Audio) => {
      if (!simliClientRef.current) return;
      try {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        simliClientRef.current.sendAudioData(bytes);
      } catch (err) {
        console.error("Audio relay error", err);
      }
    },
  });

  // ─── Start ─────────────────────────────────────────────────────────────────
  const startChat = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);
      isActiveRef.current = true;

      // 1. Mic access — goes to ElevenLabs, NOT Simli
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Boot Simli for video/lip-sync only
      const sessionToken = await getSimliSessionToken();
      const simli = new SimliClient(
        sessionToken,
        videoRef.current,
        audioRef.current,
        null,
        LogLevel.INFO,
        "livekit",
      );

      simli.on("error", (e) => {
        console.error("Simli error", e);
        setError("Avatar connection lost");
        setStatus("error");
      });

      await simli.start();
      simliClientRef.current = simli;

      if (audioRef.current) {
        audioRef.current.muted = true;
        audioRef.current.volume = 0;
      }

      // 3. Start ElevenLabs session (mic → EL → onAudio → Simli)
      const signedUrl = await getZToken();
      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
      });
    } catch (err) {
      isActiveRef.current = false;
      console.error(err);
      setError(err.message || "Failed to connect");
      setStatus("error");
    }
  }, [conversation, getSimliSessionToken]);

  // ─── Stop ──────────────────────────────────────────────────────────────────
  const stopChat = useCallback(async () => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;

    try {
      await conversation.endSession();
    } catch {}
    if (simliClientRef.current) {
      try {
        await simliClientRef.current.stop();
      } catch {}
      simliClientRef.current = null;
    }
    setStatus("idle");
  }, [conversation]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopChat();
    },
    [stopChat],
  );

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.avatarBox}>
        <video ref={videoRef} autoPlay playsInline style={styles.video} />
        <audio ref={audioRef} style={{ display: "none" }} />

        {status !== "connected" && (
          <div style={styles.overlay}>
            {status === "connecting"
              ? "Establishing connection..."
              : "Click Start"}
          </div>
        )}
      </div>

      <div style={styles.controls}>
        {status === "idle" || status === "error" ? (
          <button onClick={startChat} style={styles.btnStart}>
            Start Talking
          </button>
        ) : (
          <button onClick={stopChat} style={styles.btnStop}>
            Stop Chat
          </button>
        )}
        {error && (
          <p style={{ color: "#ff4d4d", marginTop: "10px" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBox: {
    position: "relative",
    width: "520px",
    height: "520px",
    borderRadius: "50%",
    overflow: "hidden",
    border: "2px solid #84ecdb",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    background: "rgba(0,0,0,0.4)",
  },
  controls: { marginTop: "2rem", textAlign: "center" },
  btnStart: {
    padding: "12px 30px",
    borderRadius: "12px",
    border: "none",
    background: "#079754",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnStop: {
    padding: "12px 30px",
    borderRadius: "12px",
    border: "1px solid #ff4d4d",
    background: "transparent",
    color: "#ff4d4d",
    cursor: "pointer",
  },
};

export default App;
