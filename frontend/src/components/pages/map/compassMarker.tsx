import { AdvancedMarker } from "@vis.gl/react-google-maps";

const CompassMarker = ({
  position,
  heading,
}: {
  position: { lat: number; lng: number };
  heading: number;
}) => {
  return (
    <AdvancedMarker position={position} zIndex={0}>
      <img
        src="/location-arrow.png"
        alt="User Direction"
        className="h-8 w-auto"
        style={{
          // rotate so that 0° = north
          transform: `rotate(${heading}deg)`,
          transformOrigin: "center center",
        }}
      />
    </AdvancedMarker>
  );
};

export default CompassMarker;
