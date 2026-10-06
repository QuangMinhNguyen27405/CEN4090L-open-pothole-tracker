import { useEffect, useState } from "react";
import { Map as GoogleMap } from "@vis.gl/react-google-maps";
import { useTheme } from "@/context/theme";
import { potholeService, type Pothole } from "@/services/potholeService";
import PotholeMarker from "./potholeMarker";
import CompassMarker from "./compassMarker";
import { useCompass } from "./authHook";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Compass } from "lucide-react";

// Keep the original map's fallback location and presentation.
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

export default function MapPage() {
  const { theme } = useTheme();
  const { heading, needsPermission, requestPermission } = useCompass();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(DEFAULT_CENTER);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setUserLocation((previous) => previous || DEFAULT_CENTER),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    potholeService.getPotholes(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setPotholes(Array.from(new Map(items.map((item) => [item._id, item])).values()));
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
    };
  }, [reload]);

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
        {needsPermission && (
          <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-3">
            <Button onClick={requestPermission} size="lg" className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg">
              <Compass className="w-6 h-6" stroke="currentColor" />
            </Button>
          </div>
        )}
        {/* Preserve the original successful map view; expose load status nonvisually. */}
        <p role="status" aria-live="polite" className="sr-only">
          {loading ? "Loading potholes..." : error ? "Pothole information is unavailable." : potholes.length === 0 ? "No potholes have been reported." : `${potholes.length} potholes loaded.`}
        </p>
        {error && (
          <div role="alert" className="fixed bottom-6 left-6 z-20 max-w-xs rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-xl">
            <p className="text-sm">Pothole information is unavailable. Please try again.</p>
            <Button className="mt-2" variant="outline" size="sm" disabled={loading} onClick={() => setReload((value) => value + 1)}>Retry</Button>
          </div>
        )}
      </main>
    </TooltipProvider>
  );
}
