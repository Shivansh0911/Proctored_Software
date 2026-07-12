"use client";

import { useEffect, useRef } from "react";
import type { ProctoringEventType, ProctoringSeverity, ProctoringSettings } from "@/types/database";

const FACE_CHECK_INTERVAL_MS = 15000;
const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

interface UseProctoringOptions {
  settings: ProctoringSettings;
  onEvent: (type: ProctoringEventType, severity: ProctoringSeverity, snapshot?: Blob) => Promise<{ shouldAutoSubmit: boolean }> | void;
  enabled: boolean;
}

/**
 * Wires up the client-side proctoring signals described in the exam's
 * proctoring_settings: fullscreen enforcement, tab/window focus tracking,
 * copy/paste + right-click hardening, and periodic camera face-detection.
 * Every anomaly is reported through onEvent, which POSTs to the server.
 *
 * This deters and logs; it cannot fully prevent a determined cheater with a
 * second device (there is no true lockdown browser here — see exam settings
 * copy shown to admins).
 */
export function useProctoring({ settings, onEvent, enabled }: UseProctoringOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fullscreen enforcement
  useEffect(() => {
    if (!enabled || !settings.fullscreen_required) return;

    document.documentElement.requestFullscreen?.().catch(() => {});

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        onEvent("fullscreen_exit", "high");
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [enabled, settings.fullscreen_required, onEvent]);

  // Tab / window focus tracking
  useEffect(() => {
    if (!enabled) return;

    function handleVisibilityChange() {
      if (document.hidden) onEvent("tab_switch", "medium");
    }
    function handleBlur() {
      onEvent("window_blur", "low");
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, onEvent]);

  // Input hardening: copy/paste/right-click/selection
  useEffect(() => {
    if (!enabled) return;

    function block(e: Event) {
      e.preventDefault();
    }
    function handleContextMenu(e: MouseEvent) {
      if (settings.disable_right_click) {
        e.preventDefault();
        onEvent("right_click", "low");
      }
    }
    function handleCopyPaste(e: ClipboardEvent) {
      if (settings.disable_copy_paste) {
        e.preventDefault();
        onEvent("copy_paste", "low");
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const isDevtoolsShortcut =
        key === "f12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        (e.ctrlKey && key === "u");
      if (isDevtoolsShortcut) {
        e.preventDefault();
        onEvent("devtools", "medium");
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("keydown", handleKeyDown);
    if (settings.disable_copy_paste) document.addEventListener("selectstart", block);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", block);
    };
  }, [enabled, settings.disable_right_click, settings.disable_copy_paste, onEvent]);

  // Camera + periodic face-presence detection
  useEffect(() => {
    if (!enabled || !settings.camera) return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any = null;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        videoRef.current = video;

        if (settings.face_detection) {
          const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
          const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
          detector = await FaceDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL },
            runningMode: "VIDEO",
          });
        }

        intervalId = setInterval(async () => {
          if (!videoRef.current) return;
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth || 320;
          canvas.height = videoRef.current.videoHeight || 240;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

          let faceCount = 1;
          if (detector) {
            try {
              const result = detector.detectForVideo(videoRef.current, Date.now());
              faceCount = result.detections?.length ?? 0;
            } catch {
              // detector hiccup — skip this tick rather than crash the exam
              return;
            }
          }

          canvas.toBlob(
            async (blob) => {
              if (!blob) return;
              if (faceCount === 0) {
                await onEvent("face_missing", "high", blob);
              } else if (faceCount > 1) {
                await onEvent("multiple_faces", "high", blob);
              }
            },
            "image/jpeg",
            0.7
          );
        }, FACE_CHECK_INTERVAL_MS);
      } catch {
        // Camera unavailable — precheck should have caught this, but don't
        // crash the exam if the stream drops mid-attempt.
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.camera, settings.face_detection]);
}
