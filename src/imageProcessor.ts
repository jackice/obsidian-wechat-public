import imageCompression from 'browser-image-compression';
import { WechatApi } from './wechatApi';

const PROGRESS_STAGES = {
  PROCESSING: "正在处理图片...",
  UPLOADING: "正在上传图片..."
} as const;

export interface ImageInfo {
  originalTag: string;
  fileName: string;
  size?: string;
}

export interface ProcessedImage {
  uploadedUrl: string;
  originalTag: string;
}

export interface ProcessImagesResult {
  uploadedImages: ProcessedImage[];
  failedImages: { fileName: string; error: string }[];
  firstImageBuffer: ArrayBuffer | null;
  firstImageName: string;
}

export interface ImageProcessorSettings {
  enableImageCompression: boolean;
  compressionQuality: number;
  maxWidth: number;
}

export class ImageProcessor {
  api: WechatApi;
  settings: ImageProcessorSettings;

  /**
   * 创建图片处理器实例
   * @param api - 微信 API 实例
   * @param settings - 图片处理器配置
   * @throws {Error} 如果 settings 参数无效
   */
  constructor(api: WechatApi, settings: ImageProcessorSettings) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Settings must be a valid ImageProcessorSettings object');
    }
    if (typeof settings.enableImageCompression !== 'boolean') {
      throw new Error('settings.enableImageCompression must be a boolean');
    }
    if (typeof settings.compressionQuality !== 'number' || settings.compressionQuality < 0 || settings.compressionQuality > 1) {
      throw new Error('settings.compressionQuality must be a number between 0 and 1');
    }
    if (typeof settings.maxWidth !== 'number' || settings.maxWidth <= 0) {
      throw new Error('settings.maxWidth must be a positive number');
    }

    this.api = api;
    this.settings = settings;
  }

  /**
   * 处理并上传多张图片
   * @param images - 图片信息数组
   * @param fileBuffers - 文件名到 buffer 的映射
   * @param onProgress - 可选的进度回调函数
   * @returns 处理结果，包含成功上传的图片、失败的图片和首张图片信息
   */
  async processImages(
    images: ImageInfo[],
    fileBuffers: Map<string, ArrayBuffer>,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<ProcessImagesResult> {
    if (images.length === 0) {
      return {
        uploadedImages: [],
        failedImages: [],
        firstImageBuffer: null,
        firstImageName: ''
      };
    }

    const uploadedImages: ProcessedImage[] = [];
    const failedImages: { fileName: string; error: string }[] = [];
    let firstImageBuffer: ArrayBuffer | null = null;
    let firstImageName = "";

    const firstImage = images[0];
    if (firstImage) {
      const buffer = fileBuffers.get(firstImage.fileName);
      if (buffer) {
        firstImageBuffer = buffer;
        firstImageName = firstImage.fileName;
      }
    }

    let completedCount = 0;
    const processPromises = images.map(async (image) => {
      const buffer = fileBuffers.get(image.fileName);

      if (!buffer) {
        console.warn(`Image not found: ${image.fileName}`);
        failedImages.push({ fileName: image.fileName, error: 'Image not found' });
        return null;
      }

      try {
        let processedBuffer = buffer;
        if (this.settings.enableImageCompression) {
          processedBuffer = await this.compressImage(buffer, this.settings.compressionQuality);
        }

        const uploadedUrl = await this.api.uploadImage(processedBuffer, image.fileName);

        completedCount++;
        if (onProgress) {
          onProgress(completedCount, images.length, `${PROGRESS_STAGES.UPLOADING} (${completedCount}/${images.length}): ${image.fileName}`);
        }

        return {
          uploadedUrl: uploadedUrl,
          originalTag: image.originalTag
        };

      } catch (error) {
        completedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedImages.push({ fileName: image.fileName, error: errorMessage });
        console.error(`Failed to process image ${image.fileName}:`, error);
        return null;
      }
    });

    const results = await Promise.all(processPromises);
    results.forEach(result => {
      if (result) {
        uploadedImages.push(result);
      }
    });

    return { uploadedImages, failedImages, firstImageBuffer, firstImageName };
  }

  private async compressImage(buffer: ArrayBuffer, quality: number): Promise<ArrayBuffer> {
    const file = new File([buffer], 'image.jpg', { type: 'image/jpeg' });
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: this.settings.maxWidth,
      useWebWorker: true,
      initialQuality: quality,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return await compressedFile.arrayBuffer();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Image compression failed:', errorMessage);
      throw new Error(`Image compression failed: ${errorMessage}`);
    }
  }

  /**
   * 上传封面图片
   * @param buffer - 图片 buffer
   * @param filename - 文件名
   * @returns 上传后的图片 URL
   * @throws {Error} 如果上传失败
   */
  async uploadCover(buffer: ArrayBuffer, filename: string): Promise<string> {
    try {
      return await this.api.uploadCover(buffer, filename);
    } catch (error) {
      console.error('Cover upload failed:', error);
      throw error;
    }
  }
}
