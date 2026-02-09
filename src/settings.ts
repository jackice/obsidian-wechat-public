import { PluginSettingTab, App, Setting, Notice } from "obsidian";
import WechatPlugin from "./main";
import { ThemeType, isValidTheme } from "./markdownProcessor";

export interface WeChatPluginSettings {
  appId: string;
  appSecret: string;
  currentIP: string;
  manualIP: string;
  useManualIP: boolean;
  theme: ThemeType;
  customCssFile: string;
  defaultCoverMediaId: string;
  defaultCoverFile: string;
  enableImageCompression: boolean;
  compressionQuality: number;
  maxWidth: number;
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
            if (isValidTheme(value)) {
              this.plugin.settings.theme = value;
              await this.plugin.saveSettings();
            }
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
            this.plugin.settings.previewMode = value as 'quick' | 'full';
            await this.plugin.saveSettings();
          }),
      );
  }
}
