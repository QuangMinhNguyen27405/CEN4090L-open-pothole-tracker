import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImageViewer from "@/components/ui/imageViewer";
import { useAuth } from "@/context/auth";
import {
  adminService,
  type ReviewDecision,
  type ReviewDetail,
  type ReviewStatus,
} from "@/services/adminService";
import { getApiErrorMessage } from "@/utils/apiError";

const STATUSES: { value: ReviewStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGES = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
} as const;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`;

const countOf = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const imageSource = (path: string) =>
  `${import.meta.env.VITE_API_URL || ""}${path}`;

const StatusBadge = ({ status }: { status: ReviewStatus }) => (
  <Badge variant={STATUS_BADGES[status]} className="capitalize">
    {status}
  </Badge>
);

const ReportDetail = ({
  report,
  isSaving,
  error,
  onDecide,
}: {
  report: ReviewDetail;
  isSaving: boolean;
  error: string;
  onDecide: (decision: ReviewDecision) => void;
}) => {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const images = report.images.map(imageSource);
  const { still_there, not_there } = report.confirmationSummary;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <StatusBadge status={report.reviewStatus} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Confidence</dt>
          <dd className="mt-1">{formatConfidence(report.confidenceScore)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Detections</dt>
          <dd className="mt-1">{report.detectionCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last detected</dt>
          <dd className="mt-1">{formatDateTime(report.detectedAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Location</dt>
          <dd className="mt-1">
            <a
              className="underline underline-offset-2"
              href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
              target="_blank"
              rel="noopener noreferrer">
              {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
            </a>
          </dd>
        </div>
      </dl>

      <section aria-label="Photos">
        <h3 className="text-sm font-medium">Photos</h3>
        {images.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No photos submitted.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                aria-label={`Open photo ${index + 1}`}
                onClick={() => setViewerIndex(index)}>
                <img
                  src={src}
                  alt={`Report evidence ${index + 1}`}
                  className="h-20 w-20 rounded-md object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Community confirmations">
        <h3 className="text-sm font-medium">Community confirmations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {still_there} say still there, {not_there} say fixed or gone
        </p>
        {report.confirmations.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {report.confirmations.map((confirmation) => (
              <li key={confirmation.userId}>
                {confirmation.username ?? `User ${confirmation.userId}`}:{" "}
                {confirmation.status === "still_there"
                  ? "still there"
                  : "fixed or gone"}{" "}
                <span className="text-muted-foreground">
                  ({formatDateTime(confirmation.confirmedAt)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Detection history">
        <h3 className="text-sm font-medium">Detection history</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {report.detections.map((detection) => (
            <li key={detection.id}>
              {formatDateTime(detection.capturedAt)}:{" "}
              {formatConfidence(detection.confidence)} confidence,{" "}
              {detection.modelVersion}
              {detection.gpsAccuracy !== null &&
                `, GPS within ${Math.round(detection.gpsAccuracy)} m`}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2">
        <Button
          disabled={isSaving || report.reviewStatus === "verified"}
          onClick={() => onDecide("verified")}>
          Verify
        </Button>
        <Button
          variant="destructive"
          disabled={isSaving || report.reviewStatus === "rejected"}
          onClick={() => onDecide("rejected")}>
          Reject
        </Button>
      </div>
      {isSaving && (
        <p role="status" className="text-sm text-muted-foreground">
          Saving decision...
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ImageViewer
        images={images}
        isOpen={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        initialIndex={viewerIndex ?? 0}
      />
    </div>
  );
};

const AdminPage = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate("/login", { replace: true });
    else if (user.role !== "admin") navigate("/", { replace: true });
  }, [user, isLoading, navigate]);

  const queue = useQuery({
    queryKey: ["adminPotholes", status],
    queryFn: () => adminService.getQueue(status),
    enabled: isAdmin,
  });

  const detail = useQuery({
    queryKey: ["adminPothole", selectedId],
    queryFn: () => adminService.getPothole(selectedId!),
    enabled: isAdmin && selectedId !== null,
  });

  const decision = useMutation({
    mutationFn: ({ id, value }: { id: string; value: ReviewDecision }) =>
      adminService.review(id, value),
    onSuccess: async () => {
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["adminPotholes"] });
      await queryClient.invalidateQueries({ queryKey: ["adminPothole"] });
    },
  });

  const selectReport = (id: string | null) => {
    decision.reset();
    setSelectedId(id);
  };

  if (isLoading || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-20">
        <p role="status" className="text-muted-foreground">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Pothole reviews</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section
          aria-label="Review queue"
          className={selectedId ? "hidden lg:block" : undefined}>
          <div className="flex gap-2" role="group" aria-label="Filter by status">
            {STATUSES.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={status === option.value ? "default" : "outline"}
                aria-pressed={status === option.value}
                onClick={() => {
                  setStatus(option.value);
                  selectReport(null);
                }}>
                {option.label}
              </Button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {queue.isPending && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading reports...
              </p>
            )}
            {queue.isError && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{getApiErrorMessage(queue.error, "Could not load reports.")}</p>
                <Button size="sm" variant="outline" onClick={() => void queue.refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {queue.data?.length === 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                No {status} reports.
              </p>
            )}
            {queue.data?.map((report) => (
              <button
                key={report._id}
                type="button"
                aria-current={selectedId === report._id ? "true" : undefined}
                onClick={() => selectReport(report._id)}
                className="w-full rounded-lg border p-3 text-left text-sm hover:bg-accent aria-[current=true]:border-primary">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">Report #{report._id}</span>
                  <StatusBadge status={report.reviewStatus} />
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {formatConfidence(report.confidenceScore)} confidence,{" "}
                  {countOf(report.detectionCount, "detection")},{" "}
                  {countOf(report.images.length, "photo")}
                </span>
                <span className="block text-muted-foreground">
                  {report.stillThereCount} still there, {report.notThereCount} fixed
                  or gone
                </span>
              </button>
            ))}
          </div>
        </section>

        <Card className={selectedId ? undefined : "hidden lg:block"}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {selectedId ? `Report #${selectedId}` : "Report details"}
            </CardTitle>
            {selectedId && (
              <Button
                size="sm"
                variant="outline"
                className="lg:hidden"
                onClick={() => selectReport(null)}>
                Back to queue
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedId && (
              <p className="text-sm text-muted-foreground">
                Select a report to review it.
              </p>
            )}
            {selectedId && detail.isPending && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading report...
              </p>
            )}
            {selectedId && detail.isError && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{getApiErrorMessage(detail.error, "Could not load this report.")}</p>
                <Button size="sm" variant="outline" onClick={() => void detail.refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {selectedId && detail.data && (
              <ReportDetail
                report={detail.data}
                isSaving={decision.isPending}
                error={
                  decision.isError
                    ? getApiErrorMessage(decision.error, "Could not save the decision.")
                    : ""
                }
                onDecide={(value) => decision.mutate({ id: selectedId, value })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminPage;
