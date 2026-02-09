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
  api: WechatApi | null = null;
  imageProcessor: ImageProcessor | null = null;
  markdownProcessor: MarkdownProcessor | null = null;

  async onload() {
    await this.loadSettings();

    // 延迟初始化 API 和处理器，直到第一次使用时
    // 这样用户可以在没有配置的情况下启用插件

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

  /**
   * 延迟初始化 API 和处理器
   * 在用户第一次使用插件功能时调用
   */
  private initializeProcessors(): boolean {
    // 如果已经初始化，直接返回 true
    if (this.api && this.imageProcessor && this.markdownProcessor) {
      return true;
    }

    // 检查配置
    if (!this.settings.appId || !this.settings.appSecret) {
      new Notice('请先在设置中配置 AppID 和 AppSecret');
      return false;
    }

    try {
      // 初始化 API 和处理器
      this.api = new WechatApi(
        this.settings.appId,
        this.settings.appSecret,
        this.settings.useProxy,
        this.settings.proxyUrl,
        this.settings.proxyApiKey
      );
      this.imageProcessor = new ImageProcessor(this.api, this.settings);
      this.markdownProcessor = new MarkdownProcessor(
        this.app.vault,
        this.api,
        this.imageProcessor,
        this.settings
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`初始化失败: ${errorMessage}`);
      return false;
    }
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

    // 检查 IP 白名单
    const currentIP = this.settings.useManualIP
      ? this.settings.manualIP
      : this.settings.currentIP;

    if (!currentIP) {
      new Notice('请先获取当前 IP 地址或手动输入 IP');
      return;
    }

    // 延迟初始化处理器
    if (!this.initializeProcessors()) {
      return;
    }

    // 如果启用了预览，先显示预览
    if (this.settings.enablePreview) {
      new PreviewModal(this.app, this.markdownProcessor!, file, content).open();
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

    // 延迟初始化处理器
    if (!this.initializeProcessors()) {
      return;
    }

    const content = editor.getValue();
    new PreviewModal(this.app, this.markdownProcessor!, file, content).open();
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
        const result = await this.markdownProcessor!.process(
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
        const result = await this.markdownProcessor!.process(
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
      await this.api!.createDraft(title, html, coverMediaId);

      notice.setMessage("✅ 发布成功！请前往公众号后台查看草稿箱。");
      setTimeout(() => notice.hide(), 5000);

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      notice.setMessage(`❌ 发布失败: ${errorMessage}`);
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
    // 如果 API 已初始化，更新凭证
    if (this.api) {
      this.api.appId = this.settings.appId;
      this.api.appSecret = this.settings.appSecret;
    }
  }
}
