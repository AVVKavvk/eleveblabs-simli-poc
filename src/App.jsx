import { SimliClient, LogLevel } from "simli-client";
import { useSimliStore } from "./store/simliStore.js";
import { useCallback, useEffect, useRef, useState } from "react";

function App() {
  const { getSimliSessionToken } = useSimliStore();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const simliClientRef = useRef(null);
  const micStreamRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | connected | error
  const [error, setError] = useState(null);

  const startDirectChat = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Simli prefers 16kHz
        },
      });

      micStreamRef.current = stream;

      const sessionToken = await getSimliSessionToken();

      const simli = new SimliClient(
        sessionToken,
        videoRef.current,
        audioRef.current,
        null,
        LogLevel.INFO,
        "livekit",
      );

      const audioTrack = stream.getAudioTracks()[0];
      simli.listenToMediastreamTrack(audioTrack);

      simli.on("start", () => setStatus("connected"));
      simli.on("error", (e) => {
        console.error(e);
        setError("Connection lost");
      });

      simli.on("speaking", () => {
        console.log("Avatar Speaking.........");
      });

      simli.on("silent", () => {
        console.log("Avatar Silent.........");
      });

      await simli.start();
      simliClientRef.current = simli;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setStatus("error");
    }
  }, []);

  const stopChat = useCallback(async () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (simliClientRef.current) {
      await simliClientRef.current.stop();
    }
    setStatus("idle");
  }, []);

  useEffect(() => () => stopChat(), [stopChat]);

  return (
    <>
      <div style={styles.container}>
        <div style={styles.avatarBox}>
          <video ref={videoRef} autoPlay playsInline style={styles.video} />
          <audio ref={audioRef} autoPlay style={{ display: "none" }} />

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
            <button onClick={startDirectChat} style={styles.btnStart}>
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
    </>
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
  },
  controls: { marginTop: "2rem", textAlign: "center" },
  btnStart: {
    padding: "12px 30px",
    borderRadius: "12px",
    border: "none",
    background: "#079754",
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
