import { AdvancedMarker } from "@vis.gl/react-google-maps";
import React, { useState } from "react";
import { type Pothole } from "@/services/potholeService";
import { Badge } from "@/components/ui/badge";
import ImageViewer from "@/components/ui/imageViewer";

interface PotholeMarkerProps {
  pothole: Pothole;

}

const PotholeMarker = ({ pothole }: PotholeMarkerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isClicked, setIsClicked] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const handleMarkerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 300); // Reset click animation

    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setIsModalOpen(!isModalOpen);
  };

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setIsImageViewerOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMarkerColor = () => {
    if (pothole.verified) return '#10b981'; // Green for verified
    if (pothole.confidenceScore > 0.8) return '#ef4444'; // Red for high confidence
    return '#f59e0b'; // Orange for medium confidence
  };

  const getConfidenceVariant = () => {
    if (pothole.confidenceScore > 0.8) return "destructive";
    if (pothole.confidenceScore > 0.6) return "warning";
    return "secondary";
  };

  // Close modal when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (isModalOpen) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isModalOpen]);

  return (
    <>
      <AdvancedMarker
        position={{ lat: pothole.latitude, lng: pothole.longitude }}
      >
        <div className="relative">
          {/* Radiating wave animation */}
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: getMarkerColor() }}
          />
          <div
            className="absolute inset-0 rounded-full animate-pulse opacity-30"
            style={{
              backgroundColor: getMarkerColor(),
              animationDelay: '0.5s',
              animationDuration: '2s'
            }}
          />

          {/* Main marker */}
          <div
            className={`w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-xl relative z-10 ${
              isClicked ? 'scale-125 shadow-2xl' : ''
            } ${isModalOpen ? 'scale-110 ring-2 ring-white ring-opacity-60' : ''}`}
            style={{ backgroundColor: getMarkerColor() }}
            role="button"
            tabIndex={0}
            aria-label={`View pothole ${pothole._id}`}
            onClick={handleMarkerClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleMarkerClick(event);
              }
            }}
          />
        </div>
      </AdvancedMarker>

      {/* Custom modal portal */}
      {isModalOpen && (
        <div
          className="fixed z-[9999] pointer-events-auto"
          style={{
            left: position.x - 120, // Center the modal
            top: position.y - 20, // Position above the marker
            transform: 'translateY(-100%)'
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
        >
          <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-xl p-4 space-y-3 max-w-sm animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Close button */}
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Pothole</h4>
              <div className="flex items-center gap-2">
                {pothole.verified ? (
                  <Badge variant="success" className="text-xs">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Unverified
                  </Badge>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence:</span>
                <Badge variant={getConfidenceVariant()}>
                  {Math.round(pothole.confidenceScore * 100)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Detected:</span>
                <span className="font-medium">{formatDate(pothole.detectedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Times detected:</span>
                <Badge variant="secondary">
                  {pothole.detectionCount}x
                </Badge>
              </div>

              <div className="text-muted-foreground">
                <div>Lat: {pothole.latitude.toFixed(6)}</div>
                <div>Lng: {pothole.longitude.toFixed(6)}</div>
              </div>
            </div>

            {/* Images section */}
            {pothole.images && pothole.images.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">Images ({pothole.images.length})</div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ maxWidth: '240px', scrollbarWidth: 'thin' }}>
                  {pothole.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleImageClick(index)}
                      className="flex-shrink-0 w-16 h-16 rounded border border-border overflow-hidden hover:border-primary transition-colors"
                    >
                      <img
                        src={image}
                        alt={`Pothole image ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-image.jpg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Viewer */}
      <ImageViewer
        images={pothole.images || []}
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        initialIndex={selectedImageIndex}
      />
    </>
  );
};

export default PotholeMarker;