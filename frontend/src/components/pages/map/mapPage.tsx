import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "@/context/auth";
import { Map as GoogleMap } from "@vis.gl/react-google-maps";
import { useTheme } from "@/context/theme";
import { potholeService, type Pothole } from "@/services/potholeService";
import PotholeMarker from "./potholeMarker";
import CompassMarker from "./compassMarker";
import { useCompass } from "./authHook";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CameraCapture, { type CapturedFrame } from "./cameraCapture";
import { Camera, Compass } from "lucide-react";
import MapNavigation from "./mapNavigation";

const SignInToReport = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button asChild size="lg" className="w-14 h-14 rounded-full shadow-lg">
        <Link to="/login" aria-label="Sign in to report a pothole">
          <Camera className="h-6 w-6" />
        </Link>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="left">Sign in to report a pothole</TooltipContent>
  </Tooltip>
);

// Keep the original map's fallback location and presentation.
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

export default function MapPage() {
  const { theme } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { heading, hasHeading, needsPermission, loading: compassLoading, permissionError: compassError, requestPermission } = useCompass();
  const [hasLocation, setHasLocation] = useState(false);
  const [travelHeading, setTravelHeading] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [updatesDisconnected, setUpdatesDisconnected] = useState(false);
  const pendingUpdate = useRef(false);
  const submission = useRef<AbortController | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "loading" | "detected" | "not-detected" | "error" | "signed-out">("idle");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const resetCapture = (frame: CapturedFrame | null) => {
    submission.current?.abort();
    submission.current = null;
    setCapturedFrame(frame);
    setReportStatus("idle");
  };

  useEffect(() => () => submission.current?.abort(), []);

  useEffect(() => {
    if (!capturedFrame) {
      setCapturedImageUrl("");
      return;
    }
    const imageUrl = URL.createObjectURL(capturedFrame.image);
    setCapturedImageUrl(imageUrl);
    return () => URL.revokeObjectURL(imageUrl);
  }, [capturedFrame]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(DEFAULT_CENTER);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setHasLocation(true);
        const direction = position.coords.heading;
        setTravelHeading(typeof direction === "number" && Number.isFinite(direction) ? direction : null);
      },
      () => { setUserLocation((previous) => previous || DEFAULT_CENTER); setHasLocation(false); setTravelHeading(null); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const announceUpdate = pendingUpdate.current;
    setLoading(true);
    setError(false);
    setShowUpdateNotice(false);
    potholeService.getPotholes(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setPotholes(Array.from(new Map(items.map((item) => [item._id, item])).values()));
          if (announceUpdate) {
            pendingUpdate.current = false;
            setShowUpdateNotice(true);
          }
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
    };
  }, [reload]);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      setUpdatesDisconnected(true);
      return;
    }
    let connectedBefore = false;
    const events = new EventSource(
      `${import.meta.env.VITE_API_URL || ""}/api/events`,
    );
    events.onopen = () => {
      setUpdatesDisconnected(false);
      // Refresh after reconnect: the stream does not replay missed events.
      if (connectedBefore) setReload((value) => value + 1);
      connectedBefore = true;
    };
    events.onerror = () => {
      connectedBefore = true;
      setUpdatesDisconnected(true);
    };
    events.onmessage = (event) => {
      try {
        if (JSON.parse(event.data).type !== "potholes.updated") return;
      } catch {
        return;
      }
      pendingUpdate.current = true;
      setReload((value) => value + 1);
    };
    return () => events.close();
  }, []);

  useEffect(() => {
    if (!showUpdateNotice) return;
    const timeout = window.setTimeout(() => setShowUpdateNotice(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [showUpdateNotice]);

  const submitCapture = async () => {
    if (!capturedFrame || submission.current) return;
    if (!user) { setReportStatus("signed-out"); return; }
    const controller = new AbortController();
    submission.current = controller;
    setReportStatus("loading");
    try {
      const result = await potholeService.reportDetection(capturedFrame, controller.signal);
      if (submission.current !== controller || controller.signal.aborted) return;
      setReportStatus(result.detected ? "detected" : "not-detected");
      if (result.detected) setReload((value) => value + 1);
    } catch (error) {
      if (submission.current === controller && !controller.signal.aborted) setReportStatus(isAxiosError(error) && error.response?.status === 401 ? "signed-out" : "error");
    } finally {
      if (submission.current === controller) submission.current = null;
    }
  };

  if (!apiKey) {
    return (
      <main className="h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">The map is currently unavailable. Please try again later.</p>
      </main>
    );
  }

  if (!userLocation) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Getting your location...</p>
          <p className="text-sm text-muted-foreground mt-2">Please allow location access for the best experience</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <main className="h-screen">
        <GoogleMap
          mapId={import.meta.env.VITE_GOOGLE_MAPS_ID || undefined}
          defaultCenter={userLocation}
          defaultZoom={17}
          gestureHandling={"greedy"}
          disableDefaultUI={true}
          colorScheme={theme === "dark" ? "DARK" : "LIGHT"}
        >
          <CompassMarker position={userLocation} heading={heading} />
          {potholes.map((pothole) => (
            <PotholeMarker key={pothole._id} pothole={pothole} />
          ))}
        </GoogleMap>
        {showUpdateNotice && (
          <div
            role="status"
            className="fixed top-20 left-1/2 z-20 -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg"
          >
            Pothole information updated. Map refreshed.
          </div>
        )}
        <MapNavigation location={hasLocation ? userLocation : null} heading={travelHeading ?? (hasHeading ? heading : null)} compassControl={needsPermission && (
            <Button aria-label="Enable compass" disabled={compassLoading} onClick={requestPermission} size="lg" className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg">
              <Compass className="w-6 h-6" stroke="currentColor" />
            </Button>
        )} cameraControl={user ? <CameraCapture onCapture={resetCapture} /> : !isAuthLoading ? <SignInToReport /> : null} />
        <div className="fixed bottom-24 left-4 right-24 z-20 flex max-h-[60vh] flex-col gap-3 overflow-y-auto sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm">
        {compassError && <p role="status" className="rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg">{compassError}</p>}
        {updatesDisconnected && (
          <div role="status" className="rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
            Live updates are temporarily unavailable. Refresh to check for new reports.
            <Button className="mt-2" size="sm" variant="outline" disabled={loading} onClick={() => setReload((value) => value + 1)}>Refresh map</Button>
          </div>
        )}
        {capturedFrame && capturedImageUrl && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-xl">
            <img
              src={capturedImageUrl}
              alt="Captured road scene"
              className="h-16 w-16 rounded object-cover"
            />
            <div className="min-w-0 text-xs">
              <p className="font-medium">Capture ready</p>
              <p className="text-muted-foreground">
                {capturedFrame.lat.toFixed(5)}, {capturedFrame.lng.toFixed(5)}
              </p>
              <p className="text-muted-foreground">
                {new Date(capturedFrame.capturedAt).toLocaleString()}
              </p>
              {reportStatus === "detected" && <p role="status">Pothole report saved.</p>}
              {reportStatus === "not-detected" && <p role="status">No pothole detected.</p>}
              {reportStatus === "signed-out" && <p role="alert">Please <Link to="/login" className="underline">sign in</Link> to submit this capture.</p>}
              {reportStatus === "error" && (
                <p role="alert" className="text-destructive">Could not submit capture. Please try again.</p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => void submitCapture()}
              disabled={reportStatus === "loading" || reportStatus === "detected" || reportStatus === "not-detected"}
            >
              {reportStatus === "loading" ? "Analyzing..." : "Analyze"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetCapture(null)}
              aria-label="Discard capture"
            >
              Discard
            </Button>
          </div>
        )}
        {/* Preserve the original successful map view; expose load status nonvisually. */}
        <p role="status" aria-live="polite" className="sr-only">
          {loading ? "Loading potholes..." : error ? "Pothole information is unavailable." : potholes.length === 0 ? "No potholes have been reported." : `${potholes.length} potholes loaded.`}
        </p>
        {error && (
          <div role="alert" className="rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-xl">
            <p className="text-sm">Pothole information is unavailable. Please try again.</p>
            <Button className="mt-2" variant="outline" size="sm" disabled={loading} onClick={() => setReload((value) => value + 1)}>Retry</Button>
          </div>
        )}
        </div>
      </main>
    </TooltipProvider>
  );
}
