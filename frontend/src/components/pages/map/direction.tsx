import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

export type Place = { lat: number; lng: number; address?: string };

export default function Direction({ origin, destination, selectedRouteIndex, onResult, onError, driving, location }: {
  origin: Place | null; destination: Place | null; selectedRouteIndex: number;
  onResult: (routes: google.maps.DirectionsRoute[] | null) => void;
  onError: (message: string) => void; driving: boolean; location: Place | null;
}) {
  const map = useMap();
  const library = useMapsLibrary("routes");
  const renderers = useRef<google.maps.DirectionsRenderer[]>([]);
  const selected = useRef(selectedRouteIndex);
  selected.current = selectedRouteIndex;

  useEffect(() => {
    onResult(null);
    onError("");
    if (!map || !origin || !destination) return;
    if (!library) { onError("Directions are loading. Please wait."); return; }
    let active = true;
    const service = new library.DirectionsService();
    service.route({ origin, destination, travelMode: google.maps.TravelMode.DRIVING, provideRouteAlternatives: true })
      .then((response) => {
        if (!active) return;
        if (!response.routes.length) throw new Error("No routes");
        onResult(response.routes);
        renderers.current = response.routes.map((_, i) => new library.DirectionsRenderer({
          map, directions: response, routeIndex: i,
          polylineOptions: { strokeColor: i === selected.current ? "blue" : "gray", strokeOpacity: i === selected.current ? 1 : 0.4, strokeWeight: i === selected.current ? 6 : 4 },
        }));
      })
      .catch(() => { if (active) onError("Could not load directions. Choose another address or try again."); });
    return () => {
      active = false;
      renderers.current.forEach((renderer) => renderer.setMap(null));
      renderers.current = [];
    };
  }, [map, library, origin, destination, onResult, onError]);

  useEffect(() => {
    renderers.current.forEach((renderer, i) => renderer.setOptions({
      polylineOptions: { strokeColor: i === selectedRouteIndex ? "blue" : "gray", strokeOpacity: i === selectedRouteIndex ? 1 : 0.4, strokeWeight: i === selectedRouteIndex ? 6 : 4 },
    }));
  }, [selectedRouteIndex]);

  useEffect(() => {
    if (!map) return;
    if (driving && location) { map.panTo(location); map.setZoom(17); map.setTilt(65); }
    else { map.setHeading(0); map.setTilt(0); }
  }, [map, driving, location]);
  useEffect(() => () => { map?.setTilt(0); map?.setHeading(0); }, [map]);
  return null;
}
