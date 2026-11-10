import { AdvancedMarker } from "@vis.gl/react-google-maps";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import {
  potholeService,
  type ConfirmationSummary,
  type Pothole,
} from "@/services/potholeService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/ui/imageViewer";
import { useAuth } from "@/context/auth";
import { Link } from "react-router-dom";

interface PotholeMarkerProps {
  pothole: Pothole;
}

const PotholeMarker = ({ pothole }: PotholeMarkerProps) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isClicked, setIsClicked] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [confirmationSummary, setConfirmationSummary] = useState<ConfirmationSummary | null>(null);
  const [isSubmittingConfirmation, setIsSubmittingConfirmation] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [myResponse, setMyResponse] = useState<boolean | null>(null);
  const viewerId = user?.id;
  const [summaryError, setSummaryError] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryReload, setSummaryReload] = useState(0);
  const summaryRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!isModalOpen) return;
    const controller = new AbortController();
    summaryRequest.current = controller;
    setConfirmationSummary(null);
    setMyResponse(null);
    setSummaryLoading(true);
    setSummaryError(false);
    potholeService.getConfirmations(pothole._id, controller.signal)
      .then((summary) => { if (!controller.signal.aborted) { setConfirmationSummary(summary); setMyResponse(summary.my_response); } })
      .catch(() => { if (!controller.signal.aborted) setSummaryError(true); })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [isModalOpen, pothole._id, summaryReload, viewerId]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isModalOpen, () => setIsModalOpen(false));

  useLayoutEffect(() => {
    if (!isModalOpen || !dialogRef.current) return;
    const placeDialog = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const { width, height } = dialog.getBoundingClientRect();
      dialog.style.left = `${Math.max(16, Math.min(position.x - 120, window.innerWidth - width - 16))}px`;
      dialog.style.top = `${Math.max(16, Math.min(position.y - 20 - height, window.innerHeight - height - 16))}px`;
    };
    placeDialog();
    const observer = new ResizeObserver(placeDialog);
    observer.observe(dialogRef.current);
    window.addEventListener("resize", placeDialog);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", placeDialog);
    };
  }, [isModalOpen, position]);

  const submitConfirmation = async (stillThere: boolean) => {
    summaryRequest.current?.abort();
    setSummaryLoading(false);
    setIsSubmittingConfirmation(true);
    setConfirmationError("");
    try {
      setConfirmationSummary(await potholeService.confirm(pothole._id, stillThere));
      setMyResponse(stillThere);
      setSummaryError(false);
    } catch {
      setConfirmationError("Couldn't save your confirmation. Please try again.");
    } finally {
      setIsSubmittingConfirmation(false);
    }
  };

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
      if (isModalOpen && !isImageViewerOpen) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isModalOpen, isImageViewerOpen]);

  return (
    <>
      <AdvancedMarker
        position={{ lat: pothole.latitude, lng: pothole.longitude }}
        zIndex={1}
        clickable={false}
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
            style={{ backgroundColor: getMarkerColor(), pointerEvents: "auto" }}
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
      {isModalOpen && createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Pothole ${pothole._id} details`}
          tabIndex={-1}
          className="fixed z-[9999] pointer-events-auto max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
          style={{
            left: position.x - 120, // Center the modal
            top: position.y - 20,
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

              {summaryLoading && <p role="status" className="text-muted-foreground">Loading community reports...</p>}
              {summaryError && <div role="status" className="text-muted-foreground">
                Community reports are unavailable.
                <Button size="sm" variant="ghost" disabled={isSubmittingConfirmation} onClick={() => setSummaryReload((value) => value + 1)}>Retry community reports</Button>
              </div>}
              {confirmationSummary && confirmationSummary.still_there + confirmationSummary.not_there > 0 && (
                <div className="space-y-1" aria-live="polite" aria-label="Community reports">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Community Reports:</span>
                    <Badge variant="secondary" className="text-xs">{confirmationSummary.still_there + confirmationSummary.not_there} total</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Still there:</span>
                    <Badge variant="destructive" className="text-xs">{confirmationSummary.still_there}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Not there:</span>
                    <Badge variant="success" className="text-xs">{confirmationSummary.not_there}</Badge>
                  </div>
                </div>
              )}
              <div className="text-muted-foreground">
                <div>Lat: {pothole.latitude.toFixed(6)}</div>
                <div>Lng: {pothole.longitude.toFixed(6)}</div>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground mb-2">Is this pothole still there?</p>
              {user ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-pressed={myResponse === true}
                    className={`flex-1 text-xs ${myResponse === true ? "ring-2 ring-ring ring-offset-2" : ""}`}
                    disabled={isSubmittingConfirmation}
                    onClick={() => void submitConfirmation(true)}
                  >
                    Still There
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    aria-pressed={myResponse === false}
                    className={`flex-1 text-xs ${myResponse === false ? "ring-2 ring-ring ring-offset-2" : ""}`}
                    disabled={isSubmittingConfirmation}
                    onClick={() => void submitConfirmation(false)}
                  >
                    Not There
                  </Button>
                </div>
              ) : !isAuthLoading ? (
                <p className="text-xs text-muted-foreground">
                  <Link to="/login" className="text-primary underline">
                    Sign in
                  </Link>{" "}
                  to confirm this report.
                </p>
              ) : null}
              {isSubmittingConfirmation && (
                <p role="status" className="text-xs text-muted-foreground">
                  Saving your confirmation...
                </p>
              )}
              {confirmationError && (
                <p role="alert" className="text-xs text-destructive">
                  {confirmationError}
                </p>
              )}
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
                          target.src = '/image-unavailable.svg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
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
