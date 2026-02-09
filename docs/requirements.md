号接口有一个巨大的坑——**IP 白名单**。用户必须登录微信后台，将自己当前的 IP 地址加入白名单才能调用接口。你的插件可能需要提示用户这一点，或者提供一个“获取当前 IP”的功能。

```typescript
import { requestUrl, RequestUrlParam } from "obsidian";

export class WeChatApi {
	appId: string;
	appSecret: string;
	accessToken: string = "";
	expiresAt: number = 0;

	constructor(appId: string, appSecret: string) {
		this.appId = appId;
		this.appSecret = appSecret;
	}

	// 1. 获取 Access Token
	async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.expiresAt) {
			return this.accessToken;
		}

		const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
		const req: RequestUrlParam = { url: url, method: "GET" };

		const res = await requestUrl(req);
		const data = res.json;

		if (data.errcode) throw new Error(`WeChat Error: ${data.errmsg}`);

		this.accessToken = data.access_token;
		this.expiresAt = Date.now() + (data.expires_in - 200) * 1000; // 提前一点过期
		return this.accessToken;
	}

	// 2. 上传图片到微信服务器
	// Obsidian 的图片是本地文件，需要读取为 ArrayBuffer 并上传
	async uploadImage(
		imageBuffer: ArrayBuffer,
		filename: string,
	): Promise<string> {
		const token = await this.getAccessToken();
		const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`;

		// 这里构建 multipart/form-data 比较麻烦，建议使用第三方库或手动构建 boundary
		// 为了简化，这里仅展示伪代码逻辑
		const formData = this.createFormData(imageBuffer, filename);

		const req: RequestUrlParam = {
			url: url,
			method: "POST",
			body: formData.body,
			contentType: formData.contentType,
		};

		const res = await requestUrl(req);
		// 返回 media_id 或 url (用于正文使用的是 url，用于封面可能需要 media_id)
		return res.json.url;
	}

	// 3. 推送草稿
	async pushDraft(title: string, content: string, thumbMediaId: string) {
		const token = await this.getAccessToken();
		const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;

		const body = {
			articles: [
				{
					title: title,
					content: content, // 这里必须是处理好的 HTML
					thumb_media_id: thumbMediaId, // 必须有一张封面图
					// ... 其他字段
				},
			],
		};

		await requestUrl({
			url: url,
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	// 辅助函数：构建 Multipart Form Data (核心难点)
	// 你可能需要找一个简单的 npm 包来做这个，或者手动拼接 Buffer
	createFormData(
		buffer: ArrayBuffer,
		filename: string,
	): { body: ArrayBuffer; contentType: string } {
		// 实现略，需要按照 HTTP 协议拼接 boundary
		return { body: buffer, contentType: "" };
	}
}
```

#### 第三步：Markdown 转 HTML (Content Processor)

微信公众号的文章排版很大程度上依赖于“内联样式”。

1.  **解析 Markdown**: 使用 `markdown-it`。
2.  **查找并替换图片**:
    - 扫描 Markdown 中的 `![[image.png]]` 或 `![](image.png)`。
    - 使用 `this.app.vault.readBinary` 读取本地文件。
    - 调用 `WeChatApi.uploadImage` 上传。
    - 将 Markdown 中的本地路径替换为微信返回的 `http://mmbiz.qpic.cn/...` 链接。
3.  **内联样式**:
    - 定义一套基础 CSS（类似于 typora 的主题）。
    - 使用 `juice` 将 CSS 合并到 HTML 标签的 `style` 属性中。

```typescript
import MarkdownIt from "markdown-it";
import juice from "juice";

export async function processMarkdown(
	markdown: string,
	vault: any,
	api: WeChatApi,
): Promise<string> {
	const md = new MarkdownIt({ html: true });

	// 1. 处理图片 (这里需要正则匹配并循环上传)
	// 伪代码:
	// const images = extractImages(markdown);
	// for (let img of images) {
	//    const buffer = await vault.readBinary(img.file);
	//    const wechatUrl = await api.uploadImage(buffer, img.name);
	//    markdown = markdown.replace(img.originalPath, wechatUrl);
	// }

	// 2. 转 HTML
	let html = md.render(markdown);

	// 3. 内联样式 (你可以让用户在设置里自定义 CSS)
	const css = `
        h1 { font-size: 24px; color: #333; border-bottom: 2px solid #42b983; padding-bottom: 10px; }
        p { font-size: 16px; line-height: 1.6; color: #333; }
        img { max-width: 100%; border-radius: 4px; }
        pre { background: #f6f8fa; padding: 10px; border-radius: 5px; }
    `;

	html = juice.inlineContent(html, css);

	return html;
}
```

#### 第四步：整合逻辑 (main.ts)

在 `main.ts` 中注册一个 Ribbon Icon 或者 Command：

```typescript
// ... imports

export default class MyPlugin extends Plugin {
	// ... setup

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "publish-to-wechat",
			name: "Publish to WeChat Draft",
			editorCallback: async (editor, view) => {
				const content = editor.getValue();
				const title = view.file.basename;

				new Notice("开始处理文章...");

				try {
					const api = new WeChatApi(
						this.settings.appId,
						this.settings.appSecret,
					);

					// 1. 处理正文和图片
					const htmlContent = await processMarkdown(
						content,
						this.app.vault,
						api,
					);

					// 2. 上传封面 (这一步通常需要用户指定一张图片，或者自动取第一张)
					// const thumbId = ...

					// 3. 推送
					// await api.pushDraft(title, htmlContent, thumbId);

					new Notice("推送成功！请去公众号后台查看草稿箱。");
				} catch (e) {
					new Notice("推送失败: " + e.message);
					console.error(e);
				}
			},
		});
	}
}
```

### 4. 遇到的主要坑与解决方案

你在开发过程中一定会遇到以下问题，提前知晓可以少走弯路：

1.  **IP 白名单问题**:

    - **现象**: 调用 `getAccessToken` 报错，提示 IP 不在白名单。
    - **解决**: 你无法自动解决。必须在插件设置页写清楚：“请将以下 IP [用户当前公网IP] 添加到微信公众号后台的白名单中”。
    - 或者，如果你有服务器资源，可以搭建一个中间代理服务器（Proxy），插件请求你的服务器，你的服务器（固定IP）去请求微信。但这样成本较高。

2.  **图片防盗链**:

    - 微信的图片如果在非微信环境下（比如 Obsidian 的预览模式）可能无法显示。
    - **解决**: 这是一个单向过程（Obsidian -> 微信），只要推送到微信后台能看就行，不需要在 Obsidian 里回显微信的 URL。

3.  **Multipart/form-data 构建**:

    - Node.js 环境下构建 `FormData` 上传文件相对简单，但在 Obsidian 插件环境（Electron 前端环境）有时会受限。
    - 建议研究 `obsidian-imgur-plugin` 的源码，看看它是如何处理图片上传的二进制流的。

4.  **封面图 (Thumb Media ID)**:
    - 微信草稿接口**强制**要求有一张封面图。
    - **策略**: 你的插件可以检测文章内的第一张图片，将其单独上传到微信素材库（`material/add_material`），拿到 `media_id` 后作为封面。如果文章没图片，可以设置一张默认图。

### 5. 参考资源

除了你提到的 `note-to-mp`，你还可以参考以下开源项目来学习具体实现细节：

- **Markdown 渲染**: 查阅 [obsidian-html](https://github.com/obsidian-html/obsidian-html) 了解如何深入处理 Obsidian 特有的语法（如 Callouts, WikiLinks）。
- **图片上传**: 查阅 [obsidian-image-auto-upload-plugin](https://github.com/renmu123/obsidian-image-auto-upload-plugin) 了解如何读取 Vault 图片并上传。

### 总结

开发这个插件的路线图：

1.  **跑通鉴权**：先写一个简单的脚本，用你的 AppID 能拿到 Token。
2.  **跑通文字**：把简单的 "Hello World" HTML 推送到草稿箱。
3.  **攻克图片**：这是最难的一关，实现了本地图片转微信 URL，插件就成功了 80%。
4.  **美化样式**：引入 Juice 和自定义 CSS，让文章变得好看。

祝你开发顺利！如果有具体的代码报错，欢迎随时贴出来讨论。这是一个非常棒的想法！将 Obsidian 的内容无缝同步到微信公众号（WeChat Official Account）可以极大地提高写作和发布的效率。

基于 `obsidian-sample-plugin` 开发这样一个插件，你需要解决几个核心的技术挑战：**Markdown 转 HTML（带微信样式）**、**图片上传与替换**、以及 **微信接口鉴权与调用**。

下面是一个分步骤的开发指南，帮助你构建这个插件的雏形。

### 1. 项目初始化

首先，基于官方模版创建项目：

```bash
git clone https://github.com/obsidianmd/obsidian-sample-plugin my-wechat-plugin
cd my-wechat-plugin
npm install
```

你需要安装一些额外的依赖库来处理 Markdown 和 CSS 内联（微信公众号不支持外部 CSS 类，必须内联样式）：

```bash
npm install markdown-it markdown-it-image-size juice --save
```

- `markdown-it`: 将 Markdown 转换为 HTML。
- `juice`: 将 CSS 样式内联到 HTML 标签中（关键步骤，否则发出去的文章没有排版）。

### 2. 核心架构设计

你的插件主要需要包含以下几个模块：

1.  **SettingsTab**: 用于配置 AppID 和 AppSecret。
2.  **WeChatApiAdapter**: 封装与微信服务器通信的逻辑（获取 Token、上传图片、新建草稿）。
3.  **MarkdownProcessor**: 处理 Markdown 文本，提取图片，转换 HTML，内联 CSS。
4.  **Main**: 注册命令和界面入口。

### 3. 关键代码实现

#### 第一步：设置界面 (Settings)

在 `main.ts` 中添加设置，让用户输入微信公众号后台获取的 `AppID` 和 `AppSecret`。

```typescript
interface WeChatPluginSettings {
	appId: string;
	appSecret: string;
}

const DEFAULT_SETTINGS: WeChatPluginSettings = {
	appId: "",
	appSecret: "",
};

// ... 在 SettingTab 中添加输入框 ...
```

#### 第二步：处理微信 API (WeChatApiAdapter)

这是最复杂的部分。你需要使用 Obsidian 提供的 `requestUrl` 方法（它可以绕过部分浏览器 CORS 限制）。

**注意：** 微信公众

构建一个完整的 Obsidian 插件涉及多个文件。为了让你能够直接上手，我将代码拆分为几个模块：**主入口**、**设置界面**、**微信 API 交互**、**Markdown 处理器**。

请按照以下步骤操作。

### 1. 准备工作

确保你的开发环境已经准备好（安装了 Node.js 和 Git）。

```bash
# 1. 创建插件目录（假设你在 .obsidian/plugins/ 目录下）
mkdir obsidian-wechat-public
cd obsidian-wechat-public

# 2. 初始化项目
npm init -y

# 3. 安装必要的依赖
npm install obsidian
npm install markdown-it juice
npm install -D typescript tslib @types/node @types/markdown-it
```

### 2. 配置文件 (`tsconfig.json`)

在根目录创建 `tsconfig.json`：

```json
{
	"compilerOptions": {
		"baseUrl": ".",
		"inlineSourceMap": true,
		"inlineSources": true,
		"module": "CommonJS",
		"target": "ES6",
		"allowJs": true,
		"noImplicitAny": true,
		"moduleResolution": "node",
		"importHelpers": true,
		"lib": ["DOM", "ES6", "ES2015"]
	},
	"include": ["**/*.ts"]
}
```

### 3. 项目清单 (`manifest.json`)

在根目录创建 `manifest.json`：

```json
{
	"id": "obsidian-wechat-public",
	"name": "WeChat Public Account Sync",
	"version": "1.0.0",
	"minAppVersion": "0.15.0",
	"description": "Publish Obsidian notes to WeChat Official Account drafts.",
	"author": "Your Name",
	"authorUrl": "https://github.com/yourname",
	"isDesktopOnly": true
}
```

### 4. 核心代码实现

我们将代码拆分为 4 个文件，请在 `src` 文件夹下创建这些文件（如果没有 src 文件夹，直接放在根目录也行，但要在 tsconfig 里对应好，这里假设所有 `.ts` 文件都在根目录）。

#### 文件 1: `settings.ts` (设置界面)

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import WechatPlugin from "./main";

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
		containerEl.createEl("p", {
			text: "注意：请确保你的电脑 IP 已加入公众号后台的白名单中。",
		});

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
	}
}
```

#### 文件 2: `wechatApi.ts` (微信接口逻辑 - 核心难点)

这里实现了 Token 缓存和手写 Multipart 上传（为了兼容 Obsidian 环境）。

```typescript
import { requestUrl, RequestUrlParam, Notice } from "obsidian";

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

	// 上传正文图片（不占用永久素材配额，只返回 URL）
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

	// 上传封面图（必须是永久素材或临时素材，返回 media_id）
	async uploadCover(
		fileBuffer: ArrayBuffer,
		filename: string,
	): Promise<string> {
		const token = await this.getAccessToken();
		// 这里使用新增永久素材接口
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
			digest: digest, // 摘要，可选
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

	// 手动构建 Multipart Body (适配 Obsidian Electron 环境)
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

#### 文件 3: `processor.ts` (Markdown 转 HTML)

这里定义了默认样式，并处理 Markdown 转 HTML 及内联样式。

```typescript
import MarkdownIt from "markdown-it";
import juice from "juice";
import { TFile, Vault } from "obsidian";
import { WechatApi } from "./wechatApi";

// 微信公众号基础样式
const DEFAULT_CSS = `
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
`;

export class MarkdownProcessor {
	vault: Vault;
	api: WechatApi;

	constructor(vault: Vault, api: WechatApi) {
		this.vault = vault;
		this.api = api;
	}

	async process(
		content: string,
		sourceFile: TFile,
	): Promise<{ html: string; coverMediaId: string | null }> {
		const md = new MarkdownIt({ html: true });

		// 1. 提取并替换图片
		// 匹配 ![[image.png]] 和 ![](image.png)
		const wikiImgRegex = /!\[\[(.*?)\]\]/g;
		const mdImgRegex = /!\[(.*?)\]\((.*?)\)/g;

		// 临时存储替换对，避免多次正则混乱
		const replacements: { original: string; newUrl: string }[] = [];
		let firstImageBuffer: ArrayBuffer | null = null;
		let firstImageName: string = "";

		// 处理 WikiLink ![[...]]
		let match;
		while ((match = wikiImgRegex.exec(content)) !== null) {
			const originalTag = match[0];
			const fileName = match[1].split("|")[0]; // 处理 ![[img.png|100]] 这种情况
			const file = this.vault.getAbstractFileByPath(
				this.resolvePath(fileName, sourceFile),
			);

			if (file instanceof TFile) {
				const buffer = await this.vault.readBinary(file);
				// 保存第一张图作为封面
				if (!firstImageBuffer) {
					firstImageBuffer = buffer;
					firstImageName = fileName;
				}

				try {
					const wechatUrl = await this.api.uploadImage(
						buffer,
						fileName,
					);
					replacements.push({
						original: originalTag,
						newUrl: `<img src="${wechatUrl}" />`,
					});
				} catch (e) {
					console.error(`Failed to upload ${fileName}`, e);
				}
			}
		}

		// 处理 Markdown Link ![](...)
		// (类似逻辑，省略部分细节，主要展示 WikiLink 为主，逻辑相同)

		// 执行替换
		for (const item of replacements) {
			content = content.replace(item.original, item.newUrl);
		}

		// 2. 渲染 HTML
		let html = md.render(content);

		// 3. 内联 CSS 样式
		html = juice(html, { extraCss: DEFAULT_CSS });

		// 4. 上传封面 (如果有图片)
		let coverMediaId = null;
		if (firstImageBuffer) {
			try {
				coverMediaId = await this.api.uploadCover(
					firstImageBuffer,
					firstImageName,
				);
			} catch (e) {
				console.error("Cover upload failed", e);
			}
		}

		return { html, coverMediaId };
	}

	// 简单的路径解析帮助函数
	private resolvePath(fileName: string, sourceFile: TFile): string {
		// Obsidian 的文件查找逻辑比较复杂，这里简化处理：
		// 1. 尝试直接通过 metadataCache 查找 (需要 App 实例，这里简化)
		// 2. 假设图片和笔记在同一目录，或者根目录
		// 实际开发建议使用 app.metadataCache.getFirstLinkpathDest

		// 为了代码独立性，这里使用简单假设：用户输入的是相对路径或文件名
		// 如果你的图片在附件文件夹，可能需要遍历查找
		const file = this.vault.getFiles().find((f) => f.name === fileName);
		return file ? file.path : fileName;
	}
}
```

#### 文件 4: `main.ts` (主入口)

```typescript
import { Plugin, Notice, Editor, MarkdownView } from "obsidian";
import { WechatPluginSettingTab } from "./settings";
import { WechatApi } from "./wechatApi";
import { MarkdownProcessor } from "./processor";

interface WechatPluginSettings {
	appId: string;
	appSecret: string;
}

const DEFAULT_SETTINGS: WechatPluginSettings = {
	appId: "",
	appSecret: "",
};

export default class WechatPlugin extends Plugin {
	settings: WechatPluginSettings;
	api: WechatApi;

	async onload() {
		await this.loadSettings();
		this.api = new WechatApi(this.settings.appId, this.settings.appSecret);

		this.addSettingTab(new WechatPluginSettingTab(this.app, this));

		this.addCommand({
			id: "publish-to-wechat-draft",
			name: "发布到微信公众号草稿箱",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.publishCurrentNote(view);
			},
		});
	}

	async publishCurrentNote(view: MarkdownView) {
		const notice = new Notice("正在准备发布...", 0); // 0 表示不自动消失
		try {
			const content = view.editor.getValue();
			const title = view.file?.basename || "未命名文章";

			// 1. 初始化处理器
			const processor = new MarkdownProcessor(this.app.vault, this.api);

			notice.setMessage("正在处理图片和样式...");

			// 2. 转换 Markdown 并上传图片
			const { html, coverMediaId } = await processor.process(
				content,
				view.file!,
			);

			if (!coverMediaId) {
				// 如果文章没图片，需要一张默认图的 media_id，这里演示抛出错误提醒
				// 实际使用建议在设置里放一个默认封面的 media_id
				throw new Error(
					"文章中没有检测到图片，无法作为封面。微信草稿必须要有封面图。",
				);
			}

			notice.setMessage("正在推送草稿...");

			// 3. 提交草稿
			await this.api.createDraft(title, html, coverMediaId);

			notice.setMessage("✅ 发布成功！请前往公众号后台查看。");
			setTimeout(() => notice.hide(), 5000);
		} catch (error) {
			console.error(error);
			notice.setMessage(`❌ 发布失败: ${error.message}`);
			setTimeout(() => notice.hide(), 10000);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
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

### 5. 编译与安装

1.  **编译代码**：
    在项目根目录运行：

    ```bash
    npm run build
    ```

    (如果你使用了官方模版，`package.json` 里应该有 `build` 命令，通常是 `tsc` 或者 `esbuild`。如果没有，运行 `npx tsc` 也可以，但最好配置 `esbuild` 进行打包)。

    _建议的 `package.json` script 配置（使用 esbuild 打包成单文件）：_

    ```json
    "scripts": {
      "build": "esbuild main.ts --bundle --platform=node --target=es2018 --external:obsidian --format=cjs --outfile=main.js",
      "dev": "esbuild main.ts --bundle --platform=node --target=es2018 --external:obsidian --format=cjs --outfile=main.js --watch"
    }
    ```

    需要安装 esbuild: `npm install -D esbuild`。

2.  **加载插件**：

    - 编译成功后，你会得到 `main.js` 和 `manifest.json`。
    - 确保这两个文件在你的 Obsidian 仓库的 `.obsidian/plugins/obsidian-wechat-public/` 目录下。
    - 打开 Obsidian -> 设置 -> 第三方插件 -> 刷新 -> 开启 "WeChat Public Account Sync"。

3.  **配置**：
    - 在插件设置页填入 AppID 和 AppSecret。
    - **重要**：去微信公众号后台 -> 设置与开发 -> 基本配置 -> IP白名单，把你的电脑当前外网 IP 填进去（百度 "IP" 查看）。

### 6. 使用限制与优化方向

这份代码实现了一个 MVP（最小可行性产品）：

1.  **图片查找逻辑**：目前 `processor.ts` 里的 `resolvePath` 是简化的，如果你的图片放在非常深的子目录且没用绝对路径引用，可能找不到。可以使用 `this.app.metadataCache.getFirstLinkpathDest(fileName, sourceFile.path)` 来精确查找。
2.  **封面图**：目前默认取文章第一张图。如果文章没图会报错。你可以优化逻辑：如果没有图，使用设置里填写的“默认封面MediaID”。
3.  **样式**：`DEFAULT_CSS` 只是基础样式，你可以根据自己的喜好修改 CSS 字符串，或者让它读取 Obsidian 的 CSS 片段。

希望这份代码能帮你快速把插件跑起来！
