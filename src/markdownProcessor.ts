import MarkdownIt from 'markdown-it';
import juice from 'juice';
import { TFile, Vault, normalizePath, Notice } from 'obsidian';
import { WechatApi } from './wechatApi';
import { ImageProcessor, ImageInfo, ProcessedImage } from './imageProcessor';
import { WeChatPluginSettings } from './settings';

export type ThemeType = 'default' | 'simple' | 'tech' | 'literary';

export const THEME_NAMES: readonly ThemeType[] = ['default', 'simple', 'tech', 'literary'] as const;

export function isValidTheme(theme: string): theme is ThemeType {
  return (THEME_NAMES as readonly string[]).includes(theme);
}

const PROGRESS_STAGES = {
  READING_IMAGES: "正在读取图片文件...",
  UPLOADING_IMAGES: "正在上传图片...",
  PROCESSING_IMAGES: "正在处理图片..."
} as const;

class MarkdownProcessorError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MarkdownProcessorError';
  }
}

const THEMES: Record<ThemeType, string> = {
  default: `
    h1 { font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #333; }
    h2 { font-size: 18px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #07c160; padding-bottom: 10px; color: #333; }
    h3 { font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #333; }
    p { font-size: 16px; line-height: 1.8; color: #3f3f3f; margin-bottom: 20px; text-align: justify; }
    img { max-width: 100% !important; height: auto !important; border-radius: 6px; margin: 10px 0; display: block; }
    blockquote { padding: 15px; background-color: #f7f7f7; border-left: 5px solid #07c160; color: #666; margin-bottom: 20px; font-size: 15px; }
    code { background-color: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-family: Consolas, Monaco, monospace; color: #d63384; }
    pre { background-color: #f6f8fa; padding: 15px; border-radius: 5px; overflow-x: auto; margin-bottom: 20px; }
    pre code { background-color: transparent; padding: 0; color: #333; }
    ul, ol { margin-bottom: 20px; padding-left: 20px; }
    li { margin-bottom: 5px; font-size: 16px; color: #3f3f3f; }
  `,
  simple: `
    h1 { font-size: 20px; font-weight: normal; margin-bottom: 15px; color: #2c3e50; }
    h2 { font-size: 16px; font-weight: normal; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #2c3e50; }
    p { font-size: 15px; line-height: 1.6; color: #555; margin-bottom: 15px; }
    img { max-width: 100%; border-radius: 3px; margin: 8px 0; }
    blockquote { padding: 10px; background-color: #f9f9f9; border-left: 3px solid #ddd; color: #666; font-size: 14px; }
  `,
  tech: `
    h1 { font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { font-size: 18px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; color: #2563eb; }
    p { font-size: 16px; line-height: 1.7; color: #1e293b; margin-bottom: 20px; }
    img { max-width: 100%; border-radius: 8px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    blockquote { padding: 15px; background-color: #eff6ff; border-left: 4px solid #2563eb; color: #1e40af; margin-bottom: 20px; font-size: 15px; }
    code { background-color: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: 'Fira Code', monospace; color: #dc2626; }
  `,
  literary: `
    h1 { font-size: 24px; font-weight: normal; margin-bottom: 25px; color: #8b4513; text-align: center; }
    h2 { font-size: 18px; font-weight: normal; margin-top: 30px; margin-bottom: 15px; color: #8b4513; border-bottom: 1px dashed #8b4513; padding-bottom: 5px; text-align: center; }
    p { font-size: 17px; line-height: 2; color: #5c4033; margin-bottom: 20px; font-family: "Georgia", serif; }
    img { max-width: 100%; border-radius: 4px; margin: 15px 0; filter: sepia(10%); }
    blockquote { padding: 20px; background-color: #faf5ef; border-left: 3px solid #8b4513; color: #5c4033; margin-bottom: 20px; font-style: italic; font-size: 16px; }
  `,
};

/**
 * Markdown 处理器，负责将 Markdown 内容转换为带样式的 HTML
 */
export class MarkdownProcessor {
  vault: Vault;
  api: WechatApi;
  imageProcessor: ImageProcessor;
  settings: WeChatPluginSettings;

  /**
   * 构造函数
   * @param vault - Obsidian Vault 实例
   * @param api - 微信 API 实例
   * @param imageProcessor - 图片处理器
   * @param settings - 插件设置
   */
  constructor(vault: Vault, api: WechatApi, imageProcessor: ImageProcessor, settings: WeChatPluginSettings) {
    this.vault = vault;
    this.api = api;
    this.imageProcessor = imageProcessor;
    this.settings = settings;
  }

  /**
   * 处理 Markdown 内容
   * @param content - Markdown 内容
   * @param sourceFile - 源文件
   * @param uploadImages - 是否上传图片
   * @param onProgress - 进度回调函数
   * @returns 包含 HTML 和封面 Media ID 的对象
   */
  async process(
    content: string,
    sourceFile: TFile,
    uploadImages: boolean = true,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<{ html: string; coverMediaId: string | null }> {
    const images = this.extractImages(content);
    const fileBuffers = await this.readImageFiles(images, sourceFile, onProgress);

    const { uploadedImages, firstImageBuffer, firstImageName } = await this.uploadImagesIfNeeded(
      images,
      fileBuffers,
      uploadImages,
      onProgress
    );

    content = this.replaceImageLinks(content, uploadedImages);
    const html = await this.renderHtmlWithStyles(content);
    const coverMediaId = await this.uploadCoverIfNeeded(firstImageBuffer, firstImageName, uploadImages);

    return { html, coverMediaId };
  }

  /**
   * 读取图片文件
   * @param images - 图片信息列表
   * @param sourceFile - 源文件
   * @param onProgress - 进度回调函数
   * @returns 文件名到二进制数据的映射
   */
  private async readImageFiles(
    images: ImageInfo[],
    sourceFile: TFile,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Map<string, ArrayBuffer>> {
    const fileBuffers = new Map<string, ArrayBuffer>();

    if (images.length === 0) {
      return fileBuffers;
    }

    if (onProgress) {
      onProgress(0, images.length, PROGRESS_STAGES.READING_IMAGES);
    }

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image) continue;

      const file = this.vault.getAbstractFileByPath(
        this.resolvePath(image.fileName, sourceFile),
      );

      if (file instanceof TFile) {
        const buffer = await this.vault.readBinary(file);
        fileBuffers.set(image.fileName, buffer);
      }

      if (onProgress) {
        onProgress(i + 1, images.length, PROGRESS_STAGES.READING_IMAGES);
      }
    }

    return fileBuffers;
  }

  /**
   * 上传图片（如果需要）
   * @param images - 图片信息列表
   * @param fileBuffers - 文件二进制数据映射
   * @param uploadImages - 是否上传图片
   * @param onProgress - 进度回调函数
   * @returns 包含已上传图片、第一张图片缓冲区和名称的对象
   */
  private async uploadImagesIfNeeded(
    images: ImageInfo[],
    fileBuffers: Map<string, ArrayBuffer>,
    uploadImages: boolean,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<{ uploadedImages: ProcessedImage[]; firstImageBuffer: ArrayBuffer | null; firstImageName: string }> {
    if (uploadImages && images.length > 0) {
      const result = await this.imageProcessor.processImages(
        images,
        fileBuffers,
        onProgress
      );
      return result;
    } else {
      const firstImage = images[0];
      return {
        uploadedImages: [],
        firstImageBuffer: firstImage ? fileBuffers.get(firstImage.fileName) || null : null,
        firstImageName: firstImage?.fileName || ""
      };
    }
  }

  /**
   * 替换 Markdown 中的图片链接
   * @param content - Markdown 内容
   * @param uploadedImages - 已上传的图片列表
   * @returns 替换后的内容
   */
  private replaceImageLinks(content: string, uploadedImages: ProcessedImage[]): string {
    for (const uploadedImage of uploadedImages) {
      content = content.replace(uploadedImage.originalTag, `<img src="${uploadedImage.uploadedUrl}" />`);
    }
    return content;
  }

  /**
   * 渲染 HTML 并内联样式
   * @param content - Markdown 内容
   * @returns 带样式的 HTML
   */
  private async renderHtmlWithStyles(content: string): Promise<string> {
    const md = new MarkdownIt({ html: true });
    let html = md.render(content);
    html = await this.inlineStyles(html);
    return html;
  }

  /**
   * 上传封面图片（如果需要）
   * @param firstImageBuffer - 第一张图片的二进制数据
   * @param firstImageName - 第一张图片的文件名
   * @param uploadImages - 是否上传图片
   * @returns 封面 Media ID 或 null
   * @throws {MarkdownProcessorError} 如果上传失败
   */
  private async uploadCoverIfNeeded(
    firstImageBuffer: ArrayBuffer | null,
    firstImageName: string,
    uploadImages: boolean
  ): Promise<string | null> {
    let coverMediaId = null;

    if (uploadImages && firstImageBuffer) {
      try {
        coverMediaId = await this.imageProcessor.uploadCover(
          firstImageBuffer,
          firstImageName,
        );
      } catch (e) {
        console.error("Cover upload failed", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        new Notice(`封面图片上传失败: ${firstImageName}\n错误: ${errorMessage}`, 5000);
        const error = e instanceof Error ? e : new Error(String(e));
        throw new MarkdownProcessorError(
          `封面图片上传失败: ${firstImageName}`,
          error
        );
      }
    }

    return coverMediaId;
  }

  /**
   * 从 Markdown 内容中提取图片
   * @param content - Markdown 内容
   * @returns 图片信息列表
   */
  private extractImages(content: string): ImageInfo[] {
    const images: ImageInfo[] = [];

    const wikiImgRegex = /!\[\[(.*?)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = wikiImgRegex.exec(content)) !== null) {
      const originalTag = match[0];
      const fullText = match[1];
      if (!fullText) continue;

      const fileName = fullText.split("|")[0];
      if (!fileName) continue;

      const sizeMatch = fullText.match(/\|(\d+x\d+|\d+)/);
      const size = sizeMatch ? sizeMatch[1] : undefined;

      images.push({ originalTag, fileName, size });
    }

    const mdImgRegex = /!\[([^\]]*)\]\((.*?)\)/g;
    while ((match = mdImgRegex.exec(content)) !== null) {
      const originalTag = match[0];
      const fileName = match[2];
      if (fileName) {
        images.push({ originalTag, fileName });
      }
    }

    return images;
  }

  /**
   * 解析图片文件的完整路径
   * @param fileName - 图片文件名或相对路径
   * @param sourceFile - 源文件
   * @returns 解析后的完整路径
   */
  private resolvePath(fileName: string, sourceFile: TFile): string {
    // 如果已经是绝对路径（以/开头），直接返回
    if (fileName.startsWith('/')) {
      return normalizePath(fileName.slice(1));
    }
    
    const parentPath = sourceFile.parent?.path || '';
    const fullPath = parentPath + '/' + fileName;
    
    // 手动处理相对路径（../ 和 ./）
    const parts = fullPath.split('/').filter(p => p.length > 0);
    const resolvedParts: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        // 返回上一级目录
        resolvedParts.pop();
      } else if (part !== '.') {
        // 忽略 ./，正常添加其他部分
        resolvedParts.push(part);
      }
    }
    
    return resolvedParts.join('/');
  }

  /**
   * 将 CSS 样式内联到 HTML
   * @param html - HTML 内容
   * @returns 带内联样式的 HTML
   */
  private async inlineStyles(html: string): Promise<string> {
    let css = "";

    if (this.settings.customCssFile) {
      try {
        const cssFile = this.vault.getAbstractFileByPath(this.settings.customCssFile);
        if (cssFile) {
          const cssContent = await this.vault.read(cssFile as TFile);
          const cssMatch = cssContent.match(/```css\n([\s\S]*?)\n```/);
          if (cssMatch && cssMatch[1]) {
            css = cssMatch[1];
          }
        }
      } catch (e) {
        console.warn("Failed to load custom CSS:", e);
      }
    }

    if (!css && this.settings.theme) {
      const theme = isValidTheme(this.settings.theme) ? this.settings.theme : 'default';
      css = THEMES[theme];
    }

    return juice(html, { extraCss: css });
  }
}
