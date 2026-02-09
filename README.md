# WeChat Public Account Sync

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?style=flat&logo=obsidian)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](manifest.json)

An [Obsidian](https://obsidian.md) plugin that allows you to publish Markdown notes directly to WeChat Official Account drafts with automatic image upload and style inlining.

[English](#features) | [中文](#功能特性)

---

## Features

- **One-click Publishing**: Publish your Obsidian notes to WeChat Official Account drafts with a single click or command
- **Image Upload**: Automatically uploads embedded images to WeChat servers and replaces local links with remote URLs
- **Image Compression**: Built-in image compression to optimize file sizes before upload
- **Multiple Themes**: Choose from 4 preset themes (Default, Simple, Tech, Literary) or use custom CSS
- **Preview Mode**: Preview how your content will look before publishing
- **Cover Image Support**: Automatically uses the first image as the article cover
- **IP Whitelist Helper**: Easy IP address retrieval for WeChat API whitelist configuration
- **Markdown Support**: Full support for Obsidian wiki-links (`![[image.png]]`) and standard Markdown image syntax

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to **Community Plugins**
3. Turn off **Safe Mode** if enabled
4. Click **Browse** and search for "WeChat Public Account Sync"
5. Click **Install**
6. Enable the plugin

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/jackice/obsidian-wechat-public/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-wechat-public/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Configuration

### Required Settings

1. **IP Whitelist**: 
   - Click "Get Current IP" to automatically retrieve your public IP
   - Or enable "Use Manual IP" and enter your IP manually
   - Add this IP to your WeChat Official Account's IP whitelist

2. **WeChat API Credentials**:
   - **AppID**: Your WeChat Official Account's AppID
   - **AppSecret**: Your WeChat Official Account's AppSecret
   - Get these from [WeChat Official Account Platform](https://mp.weixin.qq.com/) → Development → Basic Configuration

### Optional Settings

- **Theme**: Select from 4 preset themes or use custom CSS
- **Default Cover**: Set a default cover image Media ID or local file path
- **Image Compression**: Configure compression quality (0.1-1.0) and max width
- **Preview**: Enable/disable preview before publishing

## Usage

### Publishing a Note

1. Open the Markdown note you want to publish
2. Use one of the following methods:
   - Click the **Send** icon in the left sidebar ribbon
   - Use the command palette: `Ctrl/Cmd + P` → "Publish to WeChat Official Account"
3. If preview is enabled, review the content in the preview modal and click "Publish"
4. Wait for the upload to complete
5. Check your WeChat Official Account's draft box for the new article

### Preview Mode

To preview how your content will look:

1. Open a Markdown note
2. Use the command palette: `Ctrl/Cmd + P` → "Preview Publishing Effect"
3. Review the styled HTML in the preview modal

### Supported Markdown Syntax

- **Wiki-links**: `![[image.png]]` or `![[image.png|300x200]]`
- **Standard Markdown**: `![alt text](path/to/image.png)`
- **All standard Markdown**: Headings, lists, code blocks, blockquotes, etc.

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/jackice/obsidian-wechat-public.git
cd obsidian-wechat-public

# Install dependencies
npm install

# Start development mode (watch)
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Run linting
npm run lint

# Run tests
npm test

# Run tests with UI
npm run test:ui
```

### Project Structure

```
.
├── src/
│   ├── main.ts              # Plugin entry point
│   ├── settings.ts          # Settings interface and UI
│   ├── wechatApi.ts         # WeChat API client
│   ├── markdownProcessor.ts # Markdown to HTML conversion
│   ├── imageProcessor.ts    # Image compression and upload
│   └── previewModal.ts      # Preview modal UI
├── tests/                   # Test files
├── manifest.json            # Plugin manifest
└── package.json             # Dependencies and scripts
```

## Troubleshooting

### Common Issues

**"Please configure AppID and AppSecret first"**
- Go to plugin settings and enter your WeChat API credentials

**"IP address not in whitelist"**
- Click "Get Current IP" in settings to get your current IP
- Add this IP to your WeChat Official Account's IP whitelist

**"No images detected in article"**
- WeChat requires a cover image for every article
- Add at least one image to your note, or configure a default cover

**"Image upload failed"**
- Check your internet connection
- Verify your AppID and AppSecret are correct
- Ensure your IP is in the whitelist

### Getting Help

- [Create an Issue](https://github.com/jackice/obsidian-wechat-public/issues) on GitHub
- Check the [WeChat API Documentation](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)

---

## 功能特性

- **一键发布**: 一键将 Obsidian 笔记发布到微信公众号草稿箱
- **图片自动上传**: 自动上传嵌入的图片到微信服务器，替换本地链接为远程 URL
- **图片压缩**: 内置图片压缩功能，优化上传前的文件大小
- **多种主题**: 4 种预设主题（默认、简约、科技、文艺）或自定义 CSS
- **预览模式**: 发布前预览内容效果
- **封面图支持**: 自动使用第一张图片作为文章封面
- **IP 白名单助手**: 轻松获取 IP 地址用于微信 API 白名单配置
- **Markdown 支持**: 完整支持 Obsidian 维基链接（`![[image.png]]`）和标准 Markdown 图片语法

## 安装方法

### 从 Obsidian 社区插件安装

1. 打开 Obsidian 设置
2. 进入**社区插件**
3. 如果启用了安全模式，请关闭
4. 点击**浏览**并搜索"WeChat Public Account Sync"
5. 点击**安装**
6. 启用插件

### 手动安装

1. 从 [GitHub Releases](https://github.com/jackice/obsidian-wechat-public/releases) 下载最新版本
2. 将文件解压到库的 `.obsidian/plugins/obsidian-wechat-public/` 文件夹
3. 重新加载 Obsidian
4. 在设置 → 社区插件中启用插件

## 配置说明

### 必需设置

1. **IP 白名单**:
   - 点击"获取当前 IP"自动获取公网 IP
   - 或启用"使用手动 IP"并手动输入
   - 将此 IP 添加到微信公众号后台的 IP 白名单中

2. **微信 API 凭证**:
   - **AppID**: 微信公众号的 AppID
   - **AppSecret**: 微信公众号的 AppSecret
   - 从 [微信公众平台](https://mp.weixin.qq.com/) → 开发 → 基本配置 获取

### 可选设置

- **主题**: 从 4 种预设主题中选择或使用自定义 CSS
- **默认封面**: 设置默认封面图的 Media ID 或本地文件路径
- **图片压缩**: 配置压缩质量（0.1-1.0）和最大宽度
- **预览**: 启用/禁用发布前的预览

## 使用指南

### 发布笔记

1. 打开要发布的 Markdown 笔记
2. 使用以下任一方法:
   - 点击左侧边栏的**发送**图标
   - 使用命令面板: `Ctrl/Cmd + P` → "发布到微信公众号"
3. 如果启用了预览，在预览模态框中查看内容并点击"发布"
4. 等待上传完成
5. 在微信公众号后台的草稿箱中查看新文章

### 预览模式

预览内容的显示效果:

1. 打开 Markdown 笔记
2. 使用命令面板: `Ctrl/Cmd + P` → "预览发布效果"
3. 在预览模态框中查看带样式的 HTML

### 支持的 Markdown 语法

- **维基链接**: `![[image.png]]` 或 `![[image.png|300x200]]`
- **标准 Markdown**: `![alt text](path/to/image.png)`
- **所有标准 Markdown**: 标题、列表、代码块、引用等

## 开发指南

### 环境要求

- Node.js 16+
- npm 或 yarn

### 项目设置

```bash
# 克隆仓库
git clone https://github.com/jackice/obsidian-wechat-public.git
cd obsidian-wechat-public

# 安装依赖
npm install

# 启动开发模式（监听）
npm run dev
```

### 构建命令

```bash
# 生产构建
npm run build

# 运行代码检查
npm run lint

# 运行测试
npm test

# 运行测试（带界面）
npm run test:ui
```

### 项目结构

```
.
├── src/
│   ├── main.ts              # 插件入口
│   ├── settings.ts          # 设置接口和 UI
│   ├── wechatApi.ts         # 微信 API 客户端
│   ├── markdownProcessor.ts # Markdown 转 HTML
│   ├── imageProcessor.ts    # 图片压缩和上传
│   └── previewModal.ts      # 预览模态框 UI
├── tests/                   # 测试文件
├── manifest.json            # 插件清单
└── package.json             # 依赖和脚本
```

## 故障排除

### 常见问题

**"请先在设置中配置 AppID 和 AppSecret"**
- 进入插件设置，输入微信 API 凭证

**"IP 地址不在白名单中"**
- 在设置中点击"获取当前 IP"获取当前 IP
- 将此 IP 添加到微信公众号后台的 IP 白名单

**"文章中没有检测到图片"**
- 微信要求每篇文章必须有封面图
- 在笔记中添加至少一张图片，或配置默认封面

**"图片上传失败"**
- 检查网络连接
- 确认 AppID 和 AppSecret 正确
- 确保 IP 在白名单中

### 获取帮助

- 在 GitHub 上[创建 Issue](https://github.com/jackice/obsidian-wechat-public/issues)
- 查看 [微信 API 文档](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Obsidian API](https://docs.obsidian.md)
- Uses [markdown-it](https://github.com/markdown-it/markdown-it) for Markdown processing
- Uses [juice](https://github.com/Automattic/juice) for CSS inlining
- Uses [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) for image optimization

## Support

If you find this plugin helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting issues
- 💡 Suggesting features
- 🔧 Contributing code

---

Made with ❤️ for the Obsidian community
