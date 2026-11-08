import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

export type CapturedFrame = {
  image: Blob;
  lat: number;
  lng: number;
  capturedAt: string;
  gpsAccuracy: number;
};

interface CameraCaptureProps {
  onCapture: (frame: CapturedFrame) => void;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location services are not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  );
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let cameraStream: MediaStream | undefined;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser.");
      return () => {
        cancelled = true;
      };
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStream = mediaStream;
        setStream(mediaStream);
        setError("");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Camera access is unavailable. Check your browser permission and try again.");
        }
      });

    return () => {
      cancelled = true;
      cameraStream?.getTracks().forEach((track) => track.stop());
      setStream(null);
    };
  }, [isOpen]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera is not ready yet. Please try again.");
      return;
    }

    setIsCapturing(true);
    setError("");
    const capturedAt = new Date().toISOString();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture image."))),
          "image/jpeg",
          0.85,
        );
      });
      const position = await getCurrentPosition();
      onCapture({
        image,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        capturedAt,
        gpsAccuracy: position.coords.accuracy,
      });
      setIsOpen(false);
    } catch (captureError) {
      if (isGeolocationError(captureError)) {
        setError(
          captureError.code === 1
            ? "Location permission is needed to save a capture."
            : "Could not get your location. Please try again.",
        );
      } else {
        setError("Could not capture the image. Please try again.");
      }
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="w-14 h-14 rounded-full shadow-lg"
        aria-label="Capture pothole image"
      >
        <Camera className="h-6 w-6" />
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-capture-title"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="camera-capture-title" className="font-semibold">
                Capture a pothole
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                aria-label="Close camera"
              >
                <X />
              </Button>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[60vh] w-full rounded-md bg-black object-contain"
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={captureFrame} disabled={!stream || isCapturing}>
                {isCapturing ? "Capturing..." : "Capture"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
