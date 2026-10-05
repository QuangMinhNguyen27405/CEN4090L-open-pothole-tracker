import type {
  DetectionResult,
  ImageAnalyzer,
} from "./detection.service.ts";

function isDetectionResult(value: unknown): value is DetectionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "predictions" in value &&
    Array.isArray(value.predictions) &&
    value.predictions.every(
      (prediction: unknown) =>
        typeof prediction === "object" &&
        prediction !== null &&
        "class" in prediction &&
        typeof prediction.class === "string" &&
        "confidence" in prediction &&
        typeof prediction.confidence === "number" &&
        "x" in prediction &&
        typeof prediction.x === "number" &&
        "y" in prediction &&
        typeof prediction.y === "number" &&
        "width" in prediction &&
        typeof prediction.width === "number" &&
        "height" in prediction &&
        typeof prediction.height === "number",
    )
  );
}

export function createRoboflowImageAnalyzer(config: {
  apiKey: string;
  projectId: string;
  modelVersion: string;
}): ImageAnalyzer {
  return async (imageBuffer) => {
    const projectPath = config.projectId
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const url = new URL(
      `https://detect.roboflow.com/${projectPath}/${encodeURIComponent(config.modelVersion)}`,
    );
    url.searchParams.set("api_key", config.apiKey);
    url.searchParams.set("confidence", "20");

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: imageBuffer.toString("base64"),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Roboflow inference failed with HTTP ${response.status}`);
    }

    const result: unknown = await response.json();
    if (!isDetectionResult(result)) {
      throw new Error("Roboflow returned an invalid predictions response");
    }

    return result;
  };
}
