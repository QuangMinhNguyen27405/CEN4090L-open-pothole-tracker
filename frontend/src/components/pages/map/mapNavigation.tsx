import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigation, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import PotholeToast from "@/components/ui/potholeToast";
import { calculateDistance, isPotholeAhead } from "@/utils/geoUtils";
import { potholeService } from "@/services/potholeService";
import Direction, { type Place } from "./direction";
import LocationDrawer from "./locationDrawer";

export default function MapNavigation({ location, heading, compassControl, cameraControl }: {
  location: Place | null; heading: number | null; compassControl: ReactNode; cameraControl: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<google.maps.DirectionsRoute[] | null>(null);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [driving, setDriving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [warning, setWarning] = useState<{ distance: number } | null>(null);
  const [nearbyError, setNearbyError] = useState(false);
  const lastWarning = useRef({ id: "", time: 0 });
  const current = useRef({ location, heading });
  current.current = { location, heading };
  const receiveRoutes = useCallback((result: google.maps.DirectionsRoute[] | null) => {
    setRoutes(result); setSelectedRoute(0);
  }, []);
  const changeOrigin = (place: Place | null) => { setOrigin(place); setRoutes(null); setDriving(false); };
  const changeDestination = (place: Place | null) => { setDestination(place); setRoutes(null); setDriving(false); };

  useEffect(() => {
    if (!driving) { setWarning(null); setNearbyError(false); return; }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const check = async () => {
      const point = current.current.location;
      if (point) {
        try {
          const nearby = await potholeService.getNearby(point, controller.signal);
          if (!active) return;
          setNearbyError(false);
          const nowPoint = current.current.location;
          if (!nowPoint) {
            setWarning(null);
            timer = setTimeout(() => void check(), 3000);
            return;
          }
          const bearing = current.current.heading;
          const candidate = nearby.map((p) => ({ ...p, distance: calculateDistance(nowPoint.lat, nowPoint.lng, p.latitude, p.longitude) }))
            .filter((p) => p.distance <= 200 && (bearing === null || isPotholeAhead(nowPoint.lat, nowPoint.lng, bearing, p.latitude, p.longitude, 90)))
            .sort((a, b) => a.distance - b.distance)[0];
          if (!candidate) setWarning(null);
          else if (candidate._id !== lastWarning.current.id || Date.now() - lastWarning.current.time >= 9000) {
            lastWarning.current = { id: candidate._id, time: Date.now() };
            setWarning({ distance: candidate.distance });
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { if (active) setWarning(null); }, 6000);
          }
        } catch { if (active) { setNearbyError(true); setWarning(null); } }
      } else { setWarning(null); }
      if (active) timer = setTimeout(() => void check(), 3000);
    };
    void check();
    return () => { active = false; controller.abort(); clearTimeout(timer); clearTimeout(hideTimer); };
  }, [driving]);

  return <>
    <Direction key={retry} origin={origin} destination={destination} selectedRouteIndex={selectedRoute}
      onResult={receiveRoutes} onError={setError} driving={driving} location={location} />
    <LocationDrawer open={open} onOpenChange={setOpen} location={location} origin={origin} destination={destination}
      setOrigin={changeOrigin} setDestination={changeDestination} routes={routes} selectedRoute={selectedRoute}
      setSelectedRoute={setSelectedRoute} driving={driving} error={error} retry={() => { setDriving(false); setRetry((value) => value + 1); }}
      onStart={() => { if (routes?.[selectedRoute]) { lastWarning.current = { id: "", time: 0 }; setDriving(true); } }} />
    <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-3">
      {compassControl}
      {driving && <Button aria-label="Stop driving" onClick={() => setDriving(false)} size="lg" className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"><Square className="w-6 h-6" fill="currentColor" /></Button>}
      {cameraControl}
      <Button aria-label="Directions" onClick={() => setOpen(true)} size="lg" className="w-14 h-14 rounded-full bg-foreground hover:bg-foreground/90 text-background shadow-lg"><Navigation className="w-6 h-6" /></Button>
    </div>
    <PotholeToast isVisible={driving && warning !== null} distance={warning?.distance} onDismiss={() => setWarning(null)} />
    {driving && !location && <p role="status" className="fixed top-36 left-4 right-4 z-20 rounded-md bg-popover p-3 text-sm text-popover-foreground shadow-lg sm:left-6 sm:right-auto">Location is unavailable. Enable location access for map following and nearby pothole warnings.</p>}
    {driving && nearbyError && <p role="status" className="fixed top-36 left-4 right-4 z-20 rounded-md bg-popover p-3 text-sm text-popover-foreground shadow-lg sm:left-6 sm:right-auto">Nearby pothole warnings are temporarily unavailable. Retrying automatically.</p>}
  </>;
}
