export interface DetectionResult {
  predictions: Array<{
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export type ImageAnalyzer = (imageBuffer: Buffer) => Promise<DetectionResult>;

export class DetectionService {
  private readonly imageAnalyzer: ImageAnalyzer;

  constructor(imageAnalyzer: ImageAnalyzer) {
    this.imageAnalyzer = imageAnalyzer;
  }

  async processFrame(imageBuffer: Buffer): Promise<DetectionResult> {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new TypeError("Image must be a non-empty buffer");
    }

    return this.imageAnalyzer(imageBuffer);
  }
}
