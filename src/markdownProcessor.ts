import MarkdownIt from 'markdown-it';
import juice from 'juice';
import { TFile, Vault } from 'obsidian';
import { WechatApi } from './wechatApi';
import { ImageProcessor, ImageInfo, ProcessedImage } from './imageProcessor';

// 预设主题 CSS
const THEMES: Record<string, string> = {
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

export class MarkdownProcessor {
  vault: Vault;
  api: WechatApi;
  imageProcessor: ImageProcessor;
  settings: any;

  constructor(vault: Vault, api: WechatApi, imageProcessor: ImageProcessor, settings: any) {
    this.vault = vault;
    this.api = api;
    this.imageProcessor = imageProcessor;
    this.settings = settings;
  }

  async process(
    content: string,
    sourceFile: TFile,
    uploadImages: boolean = true,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<{ html: string; coverMediaId: string | null }> {
    const md = new MarkdownIt({ html: true });

    // 1. 提取图片
    const images = this.extractImages(content);
    const fileBuffers = new Map<string, ArrayBuffer>();

    if (images.length > 0) {
      if (onProgress) {
        onProgress(0, images.length, "正在读取图片文件...");
      }

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const file = this.vault.getAbstractFileByPath(
          this.resolvePath(image.fileName, sourceFile),
        );

        if (file instanceof TFile) {
          const buffer = await this.vault.readBinary(file);
          fileBuffers.set(image.fileName, buffer);
        }
      }
    }

    let uploadedImages: ProcessedImage[] = [];
    let firstImageBuffer: ArrayBuffer | null = null;
    let firstImageName = "";

    // 2. 处理图片（上传或仅占位符）
    if (uploadImages && images.length > 0) {
      const result = await this.imageProcessor.processImages(
        images,
        fileBuffers,
        onProgress
      );
      uploadedImages = result.uploadedImages;
      firstImageBuffer = result.firstImageBuffer;
      firstImageName = result.firstImageName;
    } else {
      // 使用占位符
      firstImageBuffer = fileBuffers.get(images[0]?.fileName) || null;
      firstImageName = images[0]?.fileName || "";
    }

    // 3. 替换图片链接
    for (const uploadedImage of uploadedImages) {
      content = content.replace(uploadedImage.originalTag, `<img src="${uploadedImage.uploadedUrl}" />`);
    }

    // 4. 渲染 HTML
    let html = md.render(content);

    // 5. 内联 CSS 样式
    html = this.inlineStyles(html);

    // 6. 上传封面（如果需要）
    let coverMediaId = null;
    if (uploadImages && firstImageBuffer) {
      try {
        coverMediaId = await this.imageProcessor.uploadCover(
          firstImageBuffer,
          firstImageName,
        );
      } catch (e) {
        console.error("Cover upload failed", e);
        // 尝试使用默认封面
        if (this.settings.defaultCoverMediaId) {
          coverMediaId = this.settings.defaultCoverMediaId;
        }
      }
    }

    return { html, coverMediaId };
  }

  private extractImages(content: string): ImageInfo[] {
    const images: ImageInfo[] = [];

    // 匹配 WikiLink: ![[image.png]] 或 ![[image.png|100x80]]
    const wikiImgRegex = /!\[\[(.*?)\]\]/g;
    let match;
    while ((match = wikiImgRegex.exec(content)) !== null) {
      const originalTag = match[0];
      const fullText = match[1];
      const fileName = fullText.split("|")[0]; // 提取文件名，忽略尺寸
      const sizeMatch = fullText.match(/\|(\d+x\d+|\d+)/);
      const size = sizeMatch ? sizeMatch[1] : undefined;

      images.push({ originalTag, fileName, size });
    }

    // 匹配 Markdown: ![](image.png) 或 ![alt](image.png)
    const mdImgRegex = /!\[([^\]]*)\]\((.*?)\)/g;
    while ((match = mdImgRegex.exec(content)) !== null) {
      const originalTag = match[0];
      const fileName = match[2];
      images.push({ originalTag, fileName });
    }

    return images;
  }

  private resolvePath(fileName: string, sourceFile: TFile): string {
    const file = this.vault.getFiles().find((f) => f.name === fileName);
    return file ? file.path : fileName;
  }

  private inlineStyles(html: string): string {
    let css = "";

    // 尝试加载自定义 CSS 文件
    if (this.settings.customCssFile) {
      try {
        const cssFile = this.vault.getAbstractFileByPath(this.settings.customCssFile);
        if (cssFile) {
          const cssContent = await this.vault.read(cssFile as TFile);
          // 提取 CSS 代码块
          const cssMatch = cssContent.match(/```css\n([\s\S]*?)\n```/);
          if (cssMatch) {
            css = cssMatch[1];
          }
        }
      } catch (e) {
        console.warn("Failed to load custom CSS:", e);
      }
    }

    // 如果没有自定义 CSS，使用预设主题
    if (!css && this.settings.theme) {
      css = THEMES[this.settings.theme] || THEMES.default;
    }

    return juice(html, { extraCss: css });
  }
}
