import imageCompression from 'browser-image-compression';
import { WechatApi } from './wechatApi';

export interface ImageInfo {
  originalTag: string;
  fileName: string;
  size?: string;
}

export interface ProcessedImage {
  uploadedUrl: string;
  originalTag: string;
}

export class ImageProcessor {
  api: WechatApi;
  settings: any;

  constructor(api: WechatApi, settings: any) {
    this.api = api;
    this.settings = settings;
  }

  async processImages(
    images: ImageInfo[],
    fileBuffers: Map<string, ArrayBuffer>,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<{ uploadedImages: ProcessedImage[], firstImageBuffer: ArrayBuffer | null, firstImageName: string }> {
    const uploadedImages: ProcessedImage[] = [];
    let firstImageBuffer: ArrayBuffer | null = null;
    let firstImageName = "";

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const buffer = fileBuffers.get(image.fileName);

      if (!buffer) {
        console.warn(`Image not found: ${image.fileName}`);
        continue;
      }

      try {
        if (onProgress) {
          onProgress(i + 1, images.length, `正在处理图片: ${image.fileName}`);
        }

        if (i === 0) {
          firstImageBuffer = buffer;
          firstImageName = image.fileName;
        }

        let processedBuffer = buffer;
        if (this.settings.enableImageCompression) {
          processedBuffer = await this.compressImage(buffer, this.settings.compressionQuality);
        }

        const uploadedUrl = await this.api.uploadImage(processedBuffer, image.fileName);

        uploadedImages.push({
          uploadedUrl: uploadedUrl,
          originalTag: image.originalTag
        });

      } catch (error) {
        console.error(`Failed to process image ${image.fileName}:`, error);
      }
    }

    return { uploadedImages, firstImageBuffer, firstImageName };
  }

  private async compressImage(buffer: ArrayBuffer, quality: number): Promise<ArrayBuffer> {
    try {
      const file = new File([buffer], 'image.jpg', { type: 'image/jpeg' });
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: this.settings.maxWidth,
        useWebWorker: true,
        initialQuality: quality,
      };

      const compressedFile = await imageCompression(file, options);
      return await compressedFile.arrayBuffer();
    } catch (error) {
      console.error('Image compression failed:', error);
      return buffer;
    }
  }

  async uploadCover(buffer: ArrayBuffer, filename: string): Promise<string> {
    try {
      return await this.api.uploadCover(buffer, filename);
    } catch (error) {
      console.error('Cover upload failed:', error);
      throw error;
    }
  }
}
