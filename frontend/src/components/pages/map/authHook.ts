import { useEffect, useState } from "react";

export function useCompass() {
  const [heading, setHeading] = useState<number>(0);
  const [hasHeading, setHasHeading] = useState(false);
  const [needsPermission, setNeedsPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionError, setPermissionError] = useState("");

  useEffect(() => {
    const handleOrientation = (
      event: DeviceOrientationEvent & { webkitCompassHeading?: number }
    ) => {
      let compassdir: number | null = null;

      if (typeof event.webkitCompassHeading !== "undefined") {
        compassdir = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        compassdir = event.alpha;
      }

      if (compassdir !== null && Number.isFinite(compassdir)) { setHeading(compassdir); setHasHeading(true); }
    };

    if (typeof DeviceOrientationEvent === "undefined") return;

    if (
      typeof (
        DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<string>;
        }
      ).requestPermission === "function" && !permissionGranted
    ) {
      setNeedsPermission(true);
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [permissionGranted]);

  const requestPermission = async () => {
    try {
      setLoading(true);
      setPermissionError("");
      const response = await (
        DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission();
      if (response === "granted") {
        setNeedsPermission(false);
        setPermissionGranted(true);
      } else {
        setPermissionError("Compass access was denied. You can still browse the map.");
      }
    } catch {
      setPermissionError("Compass access is unavailable. You can still browse the map.");
    } finally {
      setLoading(false);
    }
  };

  return { heading, hasHeading, needsPermission, loading, permissionError, requestPermission };
}
