import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Place } from "./direction";

export default function LocationDrawer({ open, onOpenChange, location, origin, destination, setOrigin, setDestination, routes, selectedRoute, setSelectedRoute, driving, onStart, error, retry }: {
  open: boolean; onOpenChange: (open: boolean) => void; location: Place | null;
  origin: Place | null; destination: Place | null; setOrigin: (place: Place | null) => void; setDestination: (place: Place | null) => void;
  routes: google.maps.DirectionsRoute[] | null; selectedRoute: number; setSelectedRoute: (index: number) => void;
  driving: boolean; onStart: () => void; error: string; retry: () => void;
}) {
  return <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
    <DrawerContent className="h-[500px] pointer-events-auto overflow-y-auto">
      <DrawerTitle className="sr-only">Directions</DrawerTitle>
      <DrawerDescription className="sr-only">Choose a starting point, destination, and driving route.</DrawerDescription>
      <div className="p-4">
        <PlacesAutocomplete label="From" place={origin} setPlace={setOrigin} currentPosition={location} />
        <PlacesAutocomplete label="To" place={destination} setPlace={setDestination} />
        {error && <div role="status" className="text-sm text-destructive">{error}<Button variant="ghost" size="sm" onClick={retry}>Retry directions</Button></div>}
        {origin && destination && !routes && !error && <p role="status">Loading directions...</p>}
        {routes && <ScrollArea className="mt-3 h-50 block rounded-md border border-border bg-background">
          <div className="p-2 space-y-2">{routes.map((route, i) => <button key={i} type="button" aria-pressed={i === selectedRoute}
            className={`w-full text-left p-3 rounded-md cursor-pointer transition-colors ${i === selectedRoute ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            onClick={() => setSelectedRoute(i)}>
            <p className="text-sm font-medium">{route.summary || `Route ${i + 1}`}</p>
            <p className="text-xs text-muted-foreground">{route.legs[0]?.distance?.text} • {route.legs[0]?.duration?.text}</p>
          </button>)}</div>
        </ScrollArea>}
        {!driving && <div className="mt-4"><Button disabled={!routes?.[selectedRoute]} className="w-full bg-blue-500 hover:bg-blue-600 text-white" onClick={() => { onStart(); onOpenChange(false); }}>Start Driving</Button></div>}
      </div>
    </DrawerContent>
  </Drawer>;
}

function PlacesAutocomplete({ label, place, setPlace, currentPosition }: {
  label: string; place: Place | null; setPlace: (place: Place | null) => void; currentPosition?: Place | null;
}) {
  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const [input, setInput] = useState(place?.address || "");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [error, setError] = useState("");
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => {
    if (!input || input === place?.address) { setSuggestions([]); return; }
    if (!places) { setError("Address search is loading or unavailable."); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      try {
        const service = new places.AutocompleteService();
        service.getPlacePredictions({ input }, (results, status) => {
          if (!active) return;
          setSuggestions(results || []);
          setError(status === "OK" ? "" : status === "ZERO_RESULTS" ? "No matching addresses." : "Address search is unavailable. Please try again.");
        });
      } catch {
        if (active) { setSuggestions([]); setError("Address search is unavailable. Please try again."); }
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [input, place, places]);
  const select = async (prediction: google.maps.places.AutocompletePrediction) => {
    const request = ++version.current;
    setSuggestions([]);
    if (!geocoding) { setError("Address lookup is unavailable. Please try again."); return; }
    try {
      const response = await new geocoding.Geocoder().geocode({ placeId: prediction.place_id });
      if (request !== version.current) return;
      const point = response.results[0]?.geometry.location;
      if (!point) throw new Error("No location");
      setInput(prediction.description);
      setPlace({ lat: point.lat(), lng: point.lng(), address: prediction.description });
      setError("");
    } catch { if (request === version.current) setError("Could not find that address. Please try again."); }
  };
  return <div className="items-center justify-center text-foreground bg-background">
    <p className="block pl-2 text-sm font-medium text-foreground">{label}</p>
    <div className="flex justify-center my-2"><Command label={label} className="rounded-lg" shouldFilter={false}>
      <CommandInput placeholder="Search by address or postcode" value={input} className="block text-base" onValueChange={(value) => {
        version.current++; setInput(value); setPlace(null); setSuggestions([]); setError("");
      }} />
      <CommandList>
        {currentPosition && !place && <CommandItem onSelect={() => {
          version.current++; setInput("Current Location"); setPlace({ ...currentPosition, address: "Current Location" }); setSuggestions([]); setError("");
        }}>Use current location</CommandItem>}
        {suggestions.map((prediction) => <CommandItem key={prediction.place_id} value={prediction.description} onSelect={() => void select(prediction)}>{prediction.description}</CommandItem>)}
      </CommandList>
    </Command></div>
    {error && <p role="status" className="text-sm text-destructive">{error}</p>}
  </div>;
}
