import { create } from "zustand";

interface SimliStore {
  getSimliSessionToken: () => Promise<string>;
}

export const useSimliStore = create<SimliStore>((set, get) => ({
  getSimliSessionToken: async () => {
    const simliApiKey: string = import.meta.env.VITE_SIMLI_API_KEY;
    const simliFaceId: string = import.meta.env.VITE_SIMLI_FACE_ID;
    const res = await fetch("https://api.simli.ai/compose/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-simli-api-key": simliApiKey,
      },
      body: JSON.stringify({
        faceId: simliFaceId,
        apiVersion: "v2",
        handleSilence: true, // Keep avatar moving while you aren't talking
        maxSessionLength: 600,
        maxIdleTime: 300,
      }),
    });
    const data = await res.json();
    return data.session_token;
  },
}));
