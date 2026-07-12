"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function PrecheckPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOk, setCameraOk] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setFullscreenSupported(!!document.documentElement.requestFullscreen);

    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setCameraOk(true);
      })
      .catch((err) => setCameraError(err.message ?? "Camera access denied"));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleStart() {
    setStarting(true);
    const res = await fetch("/api/attempts/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId }),
    });
    const data = await res.json();
    setStarting(false);

    if (!res.ok) {
      toast.error(data.error ?? "Could not start the exam");
      return;
    }
    router.push(`/exam-session/${examId}/take`);
  }

  const readyToStart = cameraOk && fullscreenSupported && consent;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Pre-exam system check</CardTitle>
          <CardDescription>
            We verify camera access and fullscreen support before you begin. This exam is
            proctored — the system logs tab switches, fullscreen exits, and camera snapshots
            for review by the exam administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span>Camera access</span>
            {cameraOk ? (
              <span className="text-sm text-green-600">Granted</span>
            ) : (
              <span className="text-sm text-destructive">{cameraError ?? "Waiting..."}</span>
            )}
          </div>
          <video ref={videoRef} autoPlay muted className="w-full rounded-md border" />
          <div className="flex items-center justify-between rounded-md border p-3">
            <span>Fullscreen support</span>
            <span className={fullscreenSupported ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {fullscreenSupported ? "Supported" : "Not supported by this browser"}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
            />
            <Label htmlFor="consent" className="font-normal leading-snug">
              I understand this exam is proctored using my camera and browser activity, and I
              consent to this monitoring for the duration of the exam.
            </Label>
          </div>
          <Button className="w-full" disabled={!readyToStart || starting} onClick={handleStart}>
            {starting ? "Starting..." : "Start exam"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
