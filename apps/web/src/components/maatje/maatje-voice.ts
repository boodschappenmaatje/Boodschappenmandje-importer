/**
 * Opnemen terwijl je Maatje vasthoudt. iPhone neemt op als audio/mp4,
 * Chrome en Android als audio/webm.
 */

export type VoiceErrorCode = "unsupported" | "denied" | "failed";

export class VoiceError extends Error {
  constructor(readonly code: VoiceErrorCode) {
    super(code);
    this.name = "VoiceError";
  }
}

export interface VoiceRecording {
  /** Stopt de opname en geeft de audio terug (null als er niets is opgenomen). */
  stop(): Promise<{ blob: Blob; durationMs: number } | null>;
  /** Stopt zonder iets te bewaren. */
  cancel(): void;
}

const PREFERRED_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

export function voiceSupported(): boolean {
  return typeof window !== "undefined"
    && typeof window.MediaRecorder !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

function pickMimeType(): string | undefined {
  return PREFERRED_TYPES.find(type => MediaRecorder.isTypeSupported?.(type));
}

export async function startVoiceRecording(): Promise<VoiceRecording> {
  if (!voiceSupported()) throw new VoiceError("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    throw new VoiceError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
  }
  const release = () => stream.getTracks().forEach(track => track.stop());
  let recorder: MediaRecorder;
  try {
    const mimeType = pickMimeType();
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    release();
    throw new VoiceError("failed");
  }
  const chunks: Blob[] = [];
  const startedAt = performance.now();
  recorder.addEventListener("dataavailable", event => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.start();
  return {
    stop() {
      return new Promise(resolve => {
        if (recorder.state === "inactive") {
          release();
          resolve(null);
          return;
        }
        recorder.addEventListener("stop", () => {
          release();
          const type = (recorder.mimeType || chunks[0]?.type || "audio/mp4").split(";")[0];
          resolve(chunks.length ? { blob: new Blob(chunks, { type }), durationMs: performance.now() - startedAt } : null);
        }, { once: true });
        recorder.stop();
      });
    },
    cancel() {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
