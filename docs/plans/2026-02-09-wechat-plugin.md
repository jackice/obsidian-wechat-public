# Obsidian 微信公众号插件 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现一个完整的 Obsidian 插件，支持将 Markdown 笔记一键发布到微信公众号草稿箱，包含图片上传、样式内联、预览功能等增强特性。

**Architecture:** 采用模块化设计，分为 5 个核心模块：WeChatApiAdapter（微信API交互）、MarkdownProcessor（Markdown转HTML）、ImageProcessor（图片处理）、SettingsManager（设置管理）、MainPlugin（主入口）。使用 TypeScript 开发，遵循 Obsidian 插件开发规范。

**Tech Stack:** TypeScript, Obsidian Plugin API, markdown-it, juice, browser-image-compression, pica

---

## Task 1: 安装必要的依赖包

**Files:**
- Modify: `package.json`

**Step 1: 编辑 package.json，添加依赖**

```json
{
  "name": "obsidian-wechat-public",
  "version": "1.0.0",
  "description": "Publish Obsidian notes to WeChat Official Account drafts.",
  "main": "main.js",
  "type": "module",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json",
    "lint": "eslint ."
  },
  "keywords": ["obsidian", "wechat", "weixin"],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^16.11.6",
    "esbuild": "0.25.5",
    "eslint-plugin-obsidianmd": "0.1.9",
    "globals": "14.0.0",
    "tslib": "2.4.0",
    "typescript": "^5.8.3",
    "typescript-eslint": "8.35.1",
    "@eslint/js": "9.30.1",
    "jiti": "2.6.1"
  },
  "dependencies": {
    "obsidian": "latest",
    "markdown-it": "^14.0.0",
    "juice": "^10.0.0",
    "browser-image-compression": "^2.0.2",
    "pica": "^9.0.0"
  }
}
```

**Step 2: 安装依赖**

运行: `npm install`
预期输出: 成功安装所有依赖包，没有错误

**Step 3: 验证依赖安装**

运行: `cat package.json | grep -A 20 "dependencies"`
预期输出: 显示新添加的依赖包

**Step 4: 提交更改**

```bash
git add package.json package-lock.json
git commit -m "feat: add dependencies for wechat plugin (markdown-it, juice, image compression)"
```

---

## Task 2: 创建设置接口和默认值

**Files:**
- Create: `src/settings.ts`

**Step 1: 创建设置接口文件**

```typescript
import { PluginSettingTab, App, Setting } from "obsidian";
import WechatPlugin from "./main";

export interface WeChatPluginSettings {
  // 微信 API 凭证
  appId: string;
  appSecret: string;

  // IP 白名单
  currentIP: string;
  manualIP: string;
  useManualIP: boolean;

  // CSS 主题
  theme: string;
  customCssFile: string;

  // 默认封面
  defaultCoverMediaId: string;
  defaultCoverFile: string;

  // 图片处理
  enableImageCompression: boolean;
  compressionQuality: number;
  maxWidth: number;

  // 预览设置
  enablePreview: boolean;
  previewMode: 'quick' | 'full';
}

export const DEFAULT_SETTINGS: WeChatPluginSettings = {
  appId: "",
  appSecret: "",
  currentIP: "",
  manualIP: "",
  useManualIP: false,
  theme: "default",
  customCssFile: "",
  defaultCoverMediaId: "",
  defaultCoverFile: "",
  enableImageCompression: true,
  compressionQuality: 0.8,
  maxWidth: 1080,
  enablePreview: true,
  previewMode: "quick",
};

export class WechatPluginSettingTab extends PluginSettingTab {
  plugin: WechatPlugin;

  constructor(app: App, plugin: WechatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "微信公众号配置" });

    // IP 白名单部分
    containerEl.createEl("h3", { text: "IP 白名单" });
    containerEl.createEl("p", {
      text: "请确保你的电脑 IP 已加入公众号后台的白名单中。",
    });

    new Setting(containerEl)
      .setName("获取当前 IP")
      .setDesc("点击按钮获取当前公网 IP 地址")
      .addButton((button) =>
        button
          .setButtonText("获取 IP")
          .onClick(async () => {
            const ip = await this.plugin.wechatApi?.getCurrentIP();
            if (ip) {
              this.plugin.settings.currentIP = ip;
              await this.plugin.saveSettings();
              new Notice(`当前 IP: ${ip}`);
            }
          }),
      );

    new Setting(containerEl)
      .setName("当前 IP")
      .setDesc("自动获取的 IP 地址")
      .addText((text) =>
        text
          .setPlaceholder("未获取")
          .setValue(this.plugin.settings.currentIP)
          .setDisabled(true),
      );

    new Setting(containerEl)
      .setName("使用手动 IP")
      .setDesc("如果自动获取失败，可以手动输入 IP 地址")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useManualIP)
          .onChange(async (value) => {
            this.plugin.settings.useManualIP = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("手动 IP")
      .setDesc("手动输入的 IP 地址")
      .addText((text) =>
        text
          .setPlaceholder("例如: 1.2.3.4")
          .setValue(this.plugin.settings.manualIP)
          .onChange(async (value) => {
            this.plugin.settings.manualIP = value;
            await this.plugin.saveSettings();
          }),
      );

    // 微信 API 凭证部分
    containerEl.createEl("h3", { text: "微信 API 凭证" });

    new Setting(containerEl)
      .setName("AppID")
      .setDesc("微信公众号后台的 AppID")
      .addText((text) =>
        text
          .setPlaceholder("wx...")
          .setValue(this.plugin.settings.appId)
          .onChange(async (value) => {
            this.plugin.settings.appId = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("AppSecret")
      .setDesc("微信公众号后台的 AppSecret")
      .addText((text) =>
        text
          .setPlaceholder("...")
          .setValue(this.plugin.settings.appSecret)
          .onChange(async (value) => {
            this.plugin.settings.appSecret = value;
            await this.plugin.saveSettings();
          }),
      );

    // 样式配置部分
    containerEl.createEl("h3", { text: "样式配置" });

    new Setting(containerEl)
      .setName("预设主题")
      .setDesc("选择预设的 CSS 主题")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("default", "默认主题")
          .addOption("simple", "简约风格")
          .addOption("tech", "科技风格")
          .addOption("literary", "文艺风格")
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            this.plugin.settings.theme = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("自定义 CSS 文件")
      .setDesc("指定自定义 CSS 文件的路径")
      .addText((text) =>
        text
          .setPlaceholder("例如: assets/custom.css")
          .setValue(this.plugin.settings.customCssFile)
          .onChange(async (value) => {
            this.plugin.settings.customCssFile = value;
            await this.plugin.saveSettings();
          }),
      );

    // 封面图配置部分
    containerEl.createEl("h3", { text: "封面图配置" });

    new Setting(containerEl)
      .setName("默认封面 Media ID")
      .setDesc("如果没有图片，使用此封面作为默认封面")
      .addText((text) =>
        text
          .setPlaceholder("例如: abc123def456")
          .setValue(this.plugin.settings.defaultCoverMediaId)
          .onChange(async (value) => {
            this.plugin.settings.defaultCoverMediaId = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("默认封面文件")
      .setDesc("指定本地封面文件路径")
      .addText((text) =>
        text
          .setPlaceholder("例如: assets/cover.jpg")
          .setValue(this.plugin.settings.defaultCoverFile)
          .onChange(async (value) => {
            this.plugin.settings.defaultCoverFile = value;
            await this.plugin.saveSettings();
          }),
      );

    // 图片处理部分
    containerEl.createEl("h3", { text: "图片处理" });

    new Setting(containerEl)
      .setName("启用图片压缩")
      .setDesc("上传前自动压缩图片以节省流量")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableImageCompression)
          .onChange(async (value) => {
            this.plugin.settings.enableImageCompression = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("压缩质量")
      .setDesc("图片压缩质量 (0.1 - 1.0)")
      .addSlider((slider) =>
        slider
          .setLimits(0.1, 1.0, 0.1)
          .setValue(this.plugin.settings.compressionQuality)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.compressionQuality = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("最大宽度")
      .setDesc("图片最大宽度（像素），0 表示不限制")
      .addText((text) =>
        text
          .setPlaceholder("例如: 1080")
          .setValue(String(this.plugin.settings.maxWidth))
          .onChange(async (value) => {
            const maxWidth = parseInt(value);
            if (!isNaN(maxWidth)) {
              this.plugin.settings.maxWidth = maxWidth;
              await this.plugin.saveSettings();
            }
          }),
      );

    // 预览设置部分
    containerEl.createEl("h3", { text: "预览设置" });

    new Setting(containerEl)
      .setName("启用预览")
      .setDesc("发布前预览转换结果")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enablePreview)
          .onChange(async (value) => {
            this.plugin.settings.enablePreview = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("预览模式")
      .setDesc("选择预览模式")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("quick", "快速预览（不上传图片）")
          .addOption("full", "完整预览（上传图片）")
          .setValue(this.plugin.settings.previewMode)
          .onChange(async (value) => {
            this.plugin.settings.previewMode = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
```

**Step 2: 验证文件创建**

运行: `ls -la src/settings.ts`
预期输出: 显示 settings.ts 文件存在

**Step 3: 提交更改**

```bash
git add src/settings.ts
git commit -m "feat: add settings interface and configuration panel"
```

---

## Task 3: 创建微信 API 适配器模块

**Files:**
- Create: `src/wechatApi.ts`

**Step 1: 创建微信 API 模块**

```typescript
import { requestUrl, Notice } from "obsidian";

export class WechatApi {
  appId: string;
  appSecret: string;
  accessToken: string = "";
  expiresAt: number = 0;

  constructor(appId: string, appSecret: string) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  async getAccessToken(): Promise<string> {
    if (!this.appId || !this.appSecret) {
      throw new Error("请先在设置中配置 AppID 和 AppSecret");
    }

    if (this.accessToken && Date.now() < this.expiresAt) {
      return this.accessToken;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
    const res = await requestUrl({ url, method: "GET" });
    const data = res.json;

    if (data.errcode) {
      throw new Error(
        `获取 Token 失败: [${data.errcode}] ${data.errmsg}`,
      );
    }

    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in - 200) * 1000;
    return this.accessToken;
  }

  async getCurrentIP(): Promise<string | null> {
    try {
      // 尝试多个 IP 查询服务
      const services = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://api.ip.sb/ip'
      ];

      for (const service of services) {
        try {
          const res = await requestUrl({ url: service, method: "GET" });
          if (service.includes('ipify')) {
            return res.json.ip;
          } else if (service.includes('ipapi')) {
            return res.json.ip;
          } else {
            return res.text;
          }
        } catch (e) {
          console.warn(`Failed to get IP from ${service}:`, e);
        }
      }
      return null;
    } catch (e) {
      console.error('Failed to get current IP:', e);
      return null;
    }
  }

  async uploadImage(
    fileBuffer: ArrayBuffer,
    filename: string,
  ): Promise<string> {
    const token = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${token}`;

    const { body, boundary } = this.buildMultipartBody(
      fileBuffer,
      filename,
      "media",
    );

    const res = await requestUrl({
      url: url,
      method: "POST",
      contentType: `multipart/form-data; boundary=${boundary}`,
      body: body,
    });

    if (res.json.errcode)
      throw new Error(`图片上传失败: ${res.json.errmsg}`);
    return res.json.url;
  }

  async uploadCover(
    fileBuffer: ArrayBuffer,
    filename: string,
  ): Promise<string> {
    const token = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`;

    const { body, boundary } = this.buildMultipartBody(
      fileBuffer,
      filename,
      "media",
    );

    const res = await requestUrl({
      url: url,
      method: "POST",
      contentType: `multipart/form-data; boundary=${boundary}`,
      body: body,
    });

    if (res.json.errcode)
      throw new Error(`封面上传失败: ${res.json.errmsg}`);
    return res.json.media_id;
  }

  async createDraft(
    title: string,
    content: string,
    thumbMediaId: string,
    digest: string = "",
  ) {
    const token = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;

    const article = {
      title: title,
      content: content,
      thumb_media_id: thumbMediaId,
      digest: digest,
      show_cover_pic: 1,
    };

    const res = await requestUrl({
      url: url,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({ articles: [article] }),
    });

    if (res.json.errcode)
      throw new Error(`草稿创建失败: ${res.json.errmsg}`);
    return res.json;
  }

  private buildMultipartBody(
    fileBuffer: ArrayBuffer,
    filename: string,
    fieldName: string,
  ) {
    const boundary =
      "----ObsidianWechatBoundary" +
      Math.random().toString(36).substring(2);
    const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const suffix = `\r\n--${boundary}--`;

    const prefixBuffer = new TextEncoder().encode(prefix);
    const suffixBuffer = new TextEncoder().encode(suffix);
    const fileUint8 = new Uint8Array(fileBuffer);

    const totalLength =
      prefixBuffer.length + fileUint8.length + suffixBuffer.length;
    const body = new Uint8Array(totalLength);

    body.set(prefixBuffer, 0);
    body.set(fileUint8, prefixBuffer.length);
    body.set(suffixBuffer, prefixBuffer.length + fileUint8.length);

    return { body: body.buffer, boundary };
  }
}
```

**Step 2: 验证文件创建**

运行: `ls -la src/wechatApi.ts`
预期输出: 显示 wechatApi.ts 文件存在

**Step 3: 提交更改**

```bash
git add src/wechatApi.ts
git commit -m "feat: implement WeChat API adapter with token management and image upload"
```

---

## Task 4: 创建图片处理模块

**Files:**
- Create: `src/imageProcessor.ts`

**Step 1: 创建图片处理模块**

```typescript
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

        // 保存第一张图片
        if (i === 0) {
          firstImageBuffer = buffer;
          firstImageName = image.fileName;
        }

        // 压缩图片
        let processedBuffer = buffer;
        if (this.settings.enableImageCompression) {
          processedBuffer = await this.compressImage(buffer, this.settings.compressionQuality);
        }

        // 上传图片
        const uploadedUrl = await this.api.uploadImage(processedBuffer, image.fileName);

        uploadedImages.push({
          uploadedUrl: uploadedUrl,
          originalTag: image.originalTag
        });

      } catch (error) {
        console.error(`Failed to process image ${image.fileName}:`, error);
        // 继续处理其他图片
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
      return buffer; // 如果压缩失败，返回原始 buffer
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
```

**Step 2: 验证文件创建**

运行: `ls -la src/imageProcessor.ts`
预期输出: 显示 imageProcessor.ts 文件存在

**Step 3: 提交更改**

```bash
git add src/imageProcessor.ts
git commit -m "feat: implement image processor with compression and upload"
```

---

## Task 5: 创建 Markdown 处理模块

**Files:**
- Create: `src/markdownProcessor.ts`

**Step 1: 创建 Markdown 处理模块**

```typescript
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
```

**Step 2: 验证文件创建**

运行: `ls -la src/markdownProcessor.ts`
预期输出: 显示 markdownProcessor.ts 文件存在

**Step 3: 提交更改**

```bash
git add src/markdownProcessor.ts
git commit -m "feat: implement markdown processor with image extraction and HTML conversion"
```

---

## Task 6: 创建预览 Modal

**Files:**
- Create: `src/previewModal.ts`

**Step 1: 创建预览 Modal**

```typescript
import { Modal, App, Notice } from 'obsidian';
import { MarkdownProcessor } from './markdownProcessor';
import { TFile } from 'obsidian';

export class PreviewModal extends Modal {
  app: App;
  processor: MarkdownProcessor;
  sourceFile: TFile;
  content: string;
  html: string = '';
  previewContainer: HTMLElement;

  constructor(app: App, processor: MarkdownProcessor, sourceFile: TFile, content: string) {
    super(app);
    this.app = app;
    this.processor = processor;
    this.sourceFile = sourceFile;
    this.content = content;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // 标题
    contentEl.createEl('h2', { text: '预览发布效果' });

    // 说明
    contentEl.createEl('p', {
      text: '请检查转换结果。确认无误后点击"确认发布"。'
    });

    // 预览容器
    this.previewContainer = contentEl.createDiv({
      cls: 'wechat-preview-container'
    });
    this.previewContainer.style.height = '400px';
    this.previewContainer.style.overflow = 'auto';
    this.previewContainer.style.border = '1px solid #ddd';
    this.previewContainer.style.padding = '20px';
    this.previewContainer.style.backgroundColor = '#fff';

    // 显示加载状态
    this.previewContainer.createEl('p', { text: '正在加载预览...' });

    // 按钮容器
    const buttonContainer = contentEl.createDiv({
      cls: 'modal-button-container'
    });
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';

    // 刷新按钮
    const refreshButton = buttonContainer.createEl('button', {
      text: '刷新',
      cls: 'mod-cta'
    });
    refreshButton.onclick = () => {
      this.loadPreview();
    };

    // 取消按钮
    const cancelButton = buttonContainer.createEl('button', {
      text: '取消',
      cls: 'mod-cancel'
    });
    cancelButton.onclick = () => {
      this.close();
    };

    // 确认发布按钮
    const confirmButton = buttonContainer.createEl('button', {
      text: '确认发布',
      cls: 'mod-cta'
    });
    confirmButton.onclick = () => {
      this.publish();
    };

    // 加载预览
    await this.loadPreview();
  }

  async loadPreview() {
    this.previewContainer.empty();
    this.previewContainer.createEl('p', { text: '正在加载预览...' });

    try {
      const result = await this.processor.process(
        this.content,
        this.sourceFile,
        false, // 不上传图片
        (current, total, message) => {
          this.previewContainer.empty();
          this.previewContainer.createEl('p', { text: `${message} (${current}/${total})` });
        }
      );

      this.html = result.html;

      // 显示预览
      this.previewContainer.empty();
      const previewContent = this.previewContainer.createDiv();
      previewContent.innerHTML = this.html;

    } catch (error) {
      console.error('Preview failed:', error);
      this.previewContainer.empty();
      this.previewContainer.createEl('p', {
        text: `预览加载失败: ${error.message}`,
        cls: 'error-message'
      });
    }
  }

  async publish() {
    this.close();

    // 触发发布事件
    const event = new CustomEvent('wechat-publish', {
      detail: {
        content: this.content,
        sourceFile: this.sourceFile,
        html: this.html
      }
    });
    window.dispatchEvent(event);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

**Step 2: 验证文件创建**

运行: `ls -la src/previewModal.ts`
预期输出: 显示 previewModal.ts 文件存在

**Step 3: 提交更改**

```bash
git add src/previewModal.ts
git commit -m "feat: implement preview modal with HTML rendering"
```

---

## Task 7: 更新主入口文件

**Files:**
- Modify: `src/main.ts`

**Step 1: 重写 main.ts**

```typescript
import { Plugin, App, Notice, Editor, MarkdownView } from 'obsidian';
import {
  WeChatPluginSettings,
  DEFAULT_SETTINGS,
  WechatPluginSettingTab
} from "./settings";
import { WechatApi } from "./wechatApi";
import { ImageProcessor } from "./imageProcessor";
import { MarkdownProcessor } from "./markdownProcessor";
import { PreviewModal } from "./previewModal";
import { TFile } from "obsidian";

export default class WechatPlugin extends Plugin {
  settings: WeChatPluginSettings;
  api: WechatApi;
  imageProcessor: ImageProcessor;
  markdownProcessor: MarkdownProcessor;

  async onload() {
    await this.loadSettings();

    // 初始化 API 和处理器
    this.api = new WechatApi(this.settings.appId, this.settings.appSecret);
    this.imageProcessor = new ImageProcessor(this.api, this.settings);
    this.markdownProcessor = new MarkdownProcessor(
      this.app.vault,
      this.api,
      this.imageProcessor,
      this.settings
    );

    // 添加设置页面
    this.addSettingTab(new WechatPluginSettingTab(this.app, this));

    // 添加 Ribbon 图标
    this.addRibbonIcon('send', '发布到微信公众号', (evt: MouseEvent) => {
      this.publishCurrentNote();
    });

    // 添加命令：发布到微信公众号
    this.addCommand({
      id: 'publish-to-wechat',
      name: '发布到微信公众号',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        await this.publishCurrentNote();
      },
    });

    // 添加命令：预览发布效果
    this.addCommand({
      id: 'preview-wechat',
      name: '预览发布效果',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        await this.previewCurrentNote(editor, view);
      },
    });

    // 监听发布事件
    window.addEventListener('wechat-publish', this.handlePublishEvent.bind(this));
  }

  async publishCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      new Notice('请先打开一个 Markdown 文件');
      return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice('无法获取编辑器视图');
      return;
    }

    const content = view.editor.getValue();
    const title = file.basename;

    // 检查配置
    if (!this.settings.appId || !this.settings.appSecret) {
      new Notice('请先在设置中配置 AppID 和 AppSecret');
      return;
    }

    // 检查 IP 白名单
    const currentIP = this.settings.useManualIP
      ? this.settings.manualIP
      : this.settings.currentIP;

    if (!currentIP) {
      new Notice('请先获取当前 IP 地址或手动输入 IP');
      return;
    }

    // 如果启用了预览，先显示预览
    if (this.settings.enablePreview) {
      new PreviewModal(this.app, this.markdownProcessor, file, content).open();
      return;
    }

    // 直接发布
    await this.publishContent(title, content, file);
  }

  async previewCurrentNote(editor: Editor, view: MarkdownView) {
    const file = view.file;
    if (!file) {
      new Notice('无法获取当前文件');
      return;
    }

    const content = editor.getValue();
    new PreviewModal(this.app, this.markdownProcessor, file, content).open();
  }

  async handlePublishEvent(event: CustomEvent) {
    const { content, sourceFile, html } = event.detail;
    const title = sourceFile.basename;
    await this.publishContent(title, content, sourceFile, html);
  }

  async publishContent(
    title: string,
    content: string,
    sourceFile: TFile,
    preProcessedHtml?: string
  ) {
    const notice = new Notice("正在发布到微信公众号...", 0);

    try {
      let html: string;
      let coverMediaId: string | null;

      if (preProcessedHtml) {
        // 使用预处理的 HTML
        html = preProcessedHtml;
        // 需要上传图片获取封面
        const result = await this.markdownProcessor.process(
          content,
          sourceFile,
          true, // 上传图片
          (current, total, message) => {
            notice.setMessage(`${message} (${current}/${total})`);
          }
        );
        coverMediaId = result.coverMediaId;
      } else {
        // 完整处理
        const result = await this.markdownProcessor.process(
          content,
          sourceFile,
          true, // 上传图片
          (current, total, message) => {
            notice.setMessage(`${message} (${current}/${total})`);
          }
        );
        html = result.html;
        coverMediaId = result.coverMediaId;
      }

      if (!coverMediaId) {
        throw new Error(
          "文章中没有检测到图片，且未配置默认封面。微信草稿必须要有封面图。",
        );
      }

      notice.setMessage("正在推送草稿...");

      // 推送草稿
      await this.api.createDraft(title, html, coverMediaId);

      notice.setMessage("✅ 发布成功！请前往公众号后台查看草稿箱。");
      setTimeout(() => notice.hide(), 5000);

    } catch (error) {
      console.error(error);
      notice.setMessage(`❌ 发布失败: ${error.message}`);
      setTimeout(() => notice.hide(), 10000);
    }
  }

  onunload() {
    // 清理事件监听
    window.removeEventListener('wechat-publish', this.handlePublishEvent.bind(this));
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData() as Partial<WeChatPluginSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // 更新 API 实例的凭证
    this.api.appId = this.settings.appId;
    this.api.appSecret = this.settings.appSecret;
  }
}
```

**Step 2: 验证文件更新**

运行: `head -50 src/main.ts`
预期输出: 显示更新后的 main.ts 内容

**Step 3: 编译检查**

运行: `npm run build`
预期输出: 编译成功，生成 main.js

**Step 4: 提交更改**

```bash
git add src/main.ts
git commit -m "feat: implement main plugin with commands and ribbon icon"
```

---

## Task 8: 更新插件清单文件

**Files:**
- Modify: `manifest.json`

**Step 1: 更新 manifest.json**

```json
{
  "id": "obsidian-wechat-public",
  "name": "WeChat Public Account Sync",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Publish Obsidian notes to WeChat Official Account drafts with image upload and style inlining.",
  "author": "jackice",
  "authorUrl": "https://github.com/jackice",
  "isDesktopOnly": true
}
```

**Step 2: 验证文件更新**

运行: `cat manifest.json`
预期输出: 显示更新后的 manifest.json

**Step 3: 提交更改**

```bash
git add manifest.json
git commit -m "chore: update manifest.json with plugin metadata"
```

---

## Task 9: 创建 README 文档

**Files:**
- Create: `README.md`

**Step 1: 创建 README.md**

```markdown
# Obsidian 微信公众号插件

将 Obsidian 笔记一键发布到微信公众号草稿箱。

## 功能特性

- ✅ 支持 Markdown 转 HTML（使用 markdown-it）
- ✅ 自动上传图片到微信公众号
- ✅ CSS 样式内联（使用 juice）
- ✅ 支持 WikiLink 图片格式 `![[image.png]]`
- ✅ 支持标准 Markdown 图片格式 `![](image.png)`
- ✅ IP 白名单支持（自动获取和手动输入）
- ✅ 预设 CSS 主题选择
- ✅ 自定义 CSS 文件支持
- ✅ 封面图智能处理
- ✅ 图片压缩和尺寸调整
- ✅ 发布前预览功能

## 安装

1. 下载插件 releases
2. 将插件文件放入 Obsidian 的 `.obsidian/plugins/obsidian-wechat-public/` 目录
3. 在 Obsidian 设置中启用插件

## 配置

### 微信 API 凭证

1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入"开发" -> "基本配置"
3. 获取 AppID 和 AppSecret
4. 在插件设置中填入 AppID 和 AppSecret

### IP 白名单

1. 点击插件设置中的"获取 IP"按钮
2. 将获取的 IP 地址添加到[微信公众号后台](https://mp.weixin.qq.com/)的 IP 白名单中
3. 或者手动输入 IP 地址

### 样式配置

1. 选择预设主题或指定自定义 CSS 文件
2. 自定义 CSS 文件需要放在 Obsidian vault 中

### 封面图配置

1. 配置默认封面 Media ID 或文件路径
2. 如果文章中没有图片，将使用默认封面

### 图片处理

1. 启用图片压缩可以节省流量
2. 设置压缩质量和最大宽度
3. 图片会自动调整尺寸并压缩

## 使用方法

### 发布到微信公众号

1. 在 Obsidian 中打开一个 Markdown 文件
2. 点击左侧工具栏的图标或使用命令面板（Ctrl+P）
3. 选择"发布到微信公众号"命令
4. 查看预览效果，确认无误后点击"确认发布"
5. 等待上传完成，查看公众号草稿箱

### 预览发布效果

1. 在 Obsidian 中打开一个 Markdown 文件
2. 使用命令面板（Ctrl+P）
3. 选择"预览发布效果"命令
4. 查看转换结果

## 图片格式支持

- WikiLink: `![[image.png]]` 或 `![[image.png|100x80]]`
- Markdown: `![](image.png)` 或 `![alt](image.png)`

## 注意事项

- 请确保您的 IP 已加入公众号后台的白名单
- 微信草稿必须有封面图，请确保文章中有图片或配置了默认封面
- 图片上传需要一定时间，请耐心等待
- 首次使用建议先预览，确认无误后再发布

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

## License

MIT License
```

**Step 2: 验证文件创建**

运行: `ls -la README.md`
预期输出: 显示 README.md 文件存在

**Step 3: 提交更改**

```bash
git add README.md
git commit -m "docs: add comprehensive README documentation"
```

---

## Task 10: 编译和测试

**Files:**
- None (Build and test)

**Step 1: 运行 TypeScript 编译**

运行: `npm run build`
预期输出: 编译成功，生成 main.js 和 main.js.map

**Step 2: 检查生成的文件**

运行: `ls -lh main.js`
预期输出: 显示 main.js 文件存在且大小合理（应该 > 500KB）

**Step 3: 运行代码检查**

运行: `npm run lint`
预期输出: 没有错误或警告

**Step 4: 验证插件文件结构**

运行: `ls -R`
预期输出: 显示完整的插件文件结构

**Step 5: 提交最终更改**

```bash
git add .
git commit -m "chore: build and verify plugin files"
```

---

## 验收标准

### 功能测试
- [ ] 插件可以在 Obsidian 中正常加载
- [ ] 设置页面可以正常打开和保存
- [ ] 可以获取当前 IP 地址
- [ ] 可以发布 Markdown 笔记到微信公众号
- [ ] 图片可以正常上传
- [ ] CSS 样式正确内联
- [ ] 预览功能正常工作
- [ ] 封面图正确设置

### 代码质量
- [ ] 没有 TypeScript 编译错误
- [ ] 没有 ESLint 警告
- [ ] 代码符合 Obsidian 插件规范
- [ ] 代码有适当的错误处理
- [ ] 代码有适当的注释

### 文档
- [ ] README 文档完整
- [ ] 设计文档完整
- [ ] 实施计划完整

## 相关技能引用

- @superpowers:subagent-driven-development - 子代理驱动开发
- @superpowers:verification-before-completion - 完成前验证
- @superpowers:token-budget-management - Token 预算管理
