import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera } from "lucide-react";

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

type CameraState = "idle" | "starting" | "ready" | "error";
const MAX_IMAGE_DIMENSION = 1600;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

function captureErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "Location services are not available in this browser.") return error.message;
    if (error.message === "Invalid GPS reading.") return "The GPS reading was invalid. Please try again.";
    if (error.message === "Image is too large.") return "The captured image is too large to submit. Please try again.";
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case 1:
        return "Location permission is needed to attach a capture. Allow location access and try again.";
      case 2:
        return "Your location is unavailable. Move to an area with a GPS signal and try again.";
      case 3:
        return "Getting your location timed out. Please try again.";
    }
  }
  return "Could not capture the image and location. Please try again.";
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [error, setError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => () => {
    sessionRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const openCamera = () => {
    sessionRef.current += 1;
    setError("");
    setCameraState("idle");
    setIsOpen(true);
  };

  const closeCamera = () => {
    sessionRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setCameraState("idle");
    setIsCapturing(false);
    setIsOpen(false);
  };

  const startCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser or connection.");
      setCameraState("error");
      return;
    }
    const session = sessionRef.current;
    setCameraState("starting");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (session !== sessionRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = mediaStream;
      mediaStream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (session !== sessionRef.current) return;
          mediaStream.getTracks().forEach((activeTrack) => activeTrack.stop());
          streamRef.current = null;
          setStream(null);
          setCameraState("error");
          setError("The camera stopped. Check its connection or permission and try again.");
        }, { once: true });
      });
      setStream(mediaStream);
      setCameraState("ready");
    } catch (cameraError) {
      if (session !== sessionRef.current) return;
      const denied = cameraError instanceof DOMException &&
        (cameraError.name === "NotAllowedError" || cameraError.name === "PermissionDeniedError");
      setError(denied
        ? "Camera permission was denied. Allow camera access in your browser and try again."
        : "The camera is unavailable. Check that it is connected and not in use, then try again.");
      setCameraState("error");
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera is not ready yet. Please try again.");
      return;
    }
    const session = sessionRef.current;
    setIsCapturing(true);
    setError("");
    const capturedAt = new Date().toISOString();
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not capture the image.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture the image."))),
          "image/jpeg",
          0.85,
        );
      });
      if (image.size > MAX_IMAGE_BYTES) throw new Error("Image is too large.");
      const position = await getCurrentPosition();
      if (session !== sessionRef.current) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          !Number.isFinite(accuracy) || accuracy < 0) {
        throw new Error("Invalid GPS reading.");
      }
      onCapture({
        image,
        lat: latitude,
        lng: longitude,
        capturedAt,
        gpsAccuracy: accuracy,
      });
      closeCamera();
    } catch (captureError) {
      if (session === sessionRef.current) setError(captureErrorMessage(captureError));
    } finally {
      if (session === sessionRef.current) setIsCapturing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? openCamera() : closeCamera()}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-14 h-14 rounded-full shadow-lg" aria-label="Capture pothole image">
          <Camera className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture a pothole</DialogTitle>
          <DialogDescription>
            Camera access takes one road image. When you capture it, location access attaches GPS coordinates.
            The image and location are sent only if you choose Analyze afterward.
          </DialogDescription>
        </DialogHeader>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cameraState === "ready" ? "max-h-[60vh] w-full rounded-md bg-black object-contain" : "hidden"}
        />
        {cameraState === "starting" && <p role="status">Starting camera...</p>}
        {isCapturing && <p role="status">Capturing image and getting your location...</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          {cameraState !== "ready" ? (
            <Button onClick={() => void startCamera()} disabled={cameraState === "starting"}>
              {cameraState === "error" ? "Retry camera" : "Start camera"}
            </Button>
          ) : (
            <Button onClick={() => void captureFrame()} disabled={isCapturing}>
              {isCapturing ? "Capturing..." : "Capture"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
