# Obsidian 微信公众号插件 - 设计文档

**日期**: 2026-02-09
**版本**: 1.0.0
**状态**: 已确认

## 1. 项目概述

开发一个 Obsidian 插件，将 Markdown 笔记一键发布到微信公众号草稿箱。插件将处理图片上传、Markdown 到 HTML 转换、CSS 样式内联等核心功能，并提供增强的预览、图片处理和自定义样式功能。

## 2. 功能需求

### 2.1 核心功能
- [x] 微信 API 鉴权（Access Token 管理，带缓存和自动续期）
- [x] 图片上传到微信服务器（支持 multipart/form-data 构建）
- [x] Markdown 转 HTML（使用 markdown-it）
- [x] CSS 样式内联（使用 juice）
- [x] 创建草稿到公众号后台

### 2.2 增强功能
- [x] IP 白名单支持（自动获取公网 IP + 手动输入）
- [x] 预设 CSS 主题选择
- [x] 自定义 CSS 文件支持
- [x] 封面图智能处理（第一张图 → 默认封面）
- [x] 图片压缩
- [x] 图片格式转换（HEIC → JPEG/PNG）
- [x] 图片尺寸调整（限制最大宽度）
- [x] 批量上传优化（进度条显示）
- [x] Modal 预览功能（转换前预览 HTML 效果）

### 2.3 额外特性
- [x] 支持 WikiLink 图片格式 `![[image.png]]`
- [x] 支持标准 Markdown 图片格式 `![](image.png)`
- [x] 支持图片尺寸语法 `![[image.png|120x80]]`
- [x] 文件嵌入支持（引用或正文模式）
- [x] 数学公式支持（LaTeX 和 AsciiMath）
- [x] 代码高亮支持
- [x] 错误处理和用户友好提示

## 3. 系统架构

### 3.1 模块划分

```
obsidian-wechat-public/
├── src/
│   ├── main.ts                 # 主入口
│   ├── settings.ts             # 设置管理
│   ├── wechatApi.ts            # 微信 API 交互
│   ├── markdownProcessor.ts     # Markdown 处理
│   ├── imageProcessor.ts        # 图片处理
│   ├── previewModal.ts         # 预览 Modal
│   └── utils/
│       ├── ip.ts               # IP 获取工具
│       └── multipart.ts        # multipart/form-data 构建
└── package.json
```

### 3.2 核心模块

#### 3.2.1 WeChatApiAdapter
封装所有微信 API 交互：
- `getAccessToken()` - 获取并缓存 Access Token
- `uploadImage(buffer, filename)` - 上传图片，返回 URL
- `uploadCover(buffer, filename)` - 上传封面，返回 media_id
- `createDraft(title, content, thumbMediaId)` - 创建草稿
- `getCurrentIP()` - 获取当前公网 IP
- `buildMultipartBody()` - 构建 multipart/form-data

#### 3.2.2 MarkdownProcessor
处理 Markdown 到 HTML 转换：
- `process(content, sourceFile)` - 主处理方法
- `extractImages(content)` - 提取图片
- `uploadImages(images)` - 批量上传图片
- `replaceImageLinks(content, replacements)` - 替换图片链接
- `renderHtml(content)` - 渲染 HTML
- `inlineStyles(html)` - 内联 CSS 样式
- `determineCover(uploadedImages)` - 确定封面图

#### 3.2.3 ImageProcessor
处理图片增强功能：
- `processImages(images, onProgress)` - 批量处理图片
- `compressImage(buffer, quality)` - 压缩图片
- `convertFormat(buffer, format)` - 格式转换
- `resizeImage(buffer, maxWidth)` - 尺寸调整
- `uploadToWeChat(buffer, filename)` - 上传到微信

#### 3.2.4 SettingsManager
管理插件设置：
- `loadSettings()` - 加载设置
- `saveSettings()` - 保存设置
- `resetSettings()` - 重置为默认值
- `validateSettings()` - 验证设置有效性

#### 3.2.5 MainPlugin
插件主入口：
- 注册命令和 Ribbon 图标
- 协调各模块工作
- 显示进度通知
- 错误处理

## 4. 数据流

### 4.1 发布流程

```
用户点击"发布到微信公众号"
    ↓
读取当前笔记内容
    ↓
验证配置（AppID、AppSecret、IP 白名单）
    ↓
初始化 MarkdownProcessor
    ↓
提取图片列表
    ↓
ImageProcessor 处理图片（压缩、转换、调整尺寸）
    ↓
批量上传图片（显示进度）
    ↓
替换本地图片路径为微信 URL
    ↓
转换 Markdown 为 HTML（markdown-it）
    ↓
加载 CSS（预设主题或自定义文件）
    ↓
内联 CSS 样式（juice）
    ↓
确定封面图（第一张图 → 默认封面）
    ↓
WeChatApiAdapter 创建草稿
    ↓
显示成功/失败通知
```

### 4.2 预览流程

```
用户点击"预览发布效果"
    ↓
读取当前笔记内容
    ↓
处理图片（不上传，使用占位符或本地预览）
    ↓
转换 Markdown 为 HTML
    ↓
内联 CSS 样式
    ↓
显示 PreviewModal
    ↓
用户检查预览效果
    ↓
用户点击"确认发布" → 执行发布流程
或
用户点击"取消" → 关闭 Modal
```

## 5. 技术栈

### 5.1 核心依赖
- `obsidian` - Obsidian 插件 API
- `markdown-it` - Markdown 解析和 HTML 生成
- `juice` - CSS 样式内联

### 5.2 可选依赖
- `browser-image-compression` - 图片压缩
- `pica` - 图片尺寸调整
- `heic2any` - HEIC 格式转换

### 5.3 TypeScript 配置
- 严格模式：`strict: true`
- 目标：ES6+
- 模块：CommonJS（Obsidian 要求）

## 6. 设置配置

### 6.1 设置接口

```typescript
interface WeChatPluginSettings {
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
```

### 6.2 默认设置

```typescript
const DEFAULT_SETTINGS: WeChatPluginSettings = {
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
```

## 7. 错误处理

### 7.1 错误分类

#### 配置错误
- AppID/AppSecret 未配置
- IP 不在白名单中
- 默认封面未设置

#### API 错误
- Access Token 获取失败
- 图片上传失败
- 草稿创建失败

#### 图片处理错误
- 图片格式不支持
- 图片压缩失败
- 图片尺寸调整失败

#### 文件处理错误
- 图片文件未找到
- Markdown 解析失败
- CSS 文件读取失败

### 7.2 错误处理策略

**多层错误处理**：
1. 第一层：配置验证（发布前检查）
2. 第二层：API 调用错误处理（显示具体错误和解决方案）
3. 第三层：图片处理错误（单张图片失败不影响其他）
4. 第四层：用户友好提示（简洁信息 + 控制台详细日志）

**错误提示示例**：
- "请先在设置中配置 AppID 和 AppSecret"
- "获取 Token 失败：IP 不在白名单，请将 [当前IP] 添加到公众号后台"
- "图片上传失败：3/10 图片上传成功，7 张失败"
- "草稿创建失败：封面图未设置，请确保文章中有图片或配置了默认封面"

## 8. UI 设计

### 8.1 预览 Modal

**布局**：
- 顶部：标题和说明
- 中部：HTML 预览区域（使用 iframe 或直接渲染）
- 底部：按钮组（"确认发布"、"取消"、"刷新"）

**交互**：
- 点击"刷新"重新处理当前笔记
- 点击"取消"关闭 Modal
- 点击"确认发布"执行发布流程

### 8.2 设置页面

**分组**：
1. 微信 API 配置
   - AppID 输入框
   - AppSecret 输入框
   - 获取 IP 按钮
   - 当前 IP 显示
   - 手动 IP 输入框
   - 使用手动 IP 开关

2. 样式配置
   - 预设主题下拉菜单
   - 自定义 CSS 文件路径输入框
   - 浏览文件按钮

3. 封面图配置
   - 默认封面 Media ID 输入框
   - 默认封面文件路径输入框
   - 浏览文件按钮

4. 图片处理
   - 启用图片压缩开关
   - 压缩质量滑块（0.1-1.0）
   - 最大宽度输入框

5. 预览设置
   - 启用预览开关
   - 预览模式选择（快速/完整）

## 9. 测试计划

### 9.1 单元测试
- [ ] WeChatApiAdapter 各方法测试
- [ ] MarkdownProcessor 图片提取和替换测试
- [ ] ImageProcessor 图片处理测试
- [ ] SettingsManager 加载和保存测试

### 9.2 集成测试
- [ ] 完整发布流程测试
- [ ] 预览流程测试
- [ ] 图片上传和替换测试
- [ ] CSS 内联测试

### 9.3 用户界面测试
- [ ] 设置页面交互测试
- [ ] 预览 Modal 交互测试
- [ ] 进度通知测试
- [ ] 错误提示测试

## 10. 性能优化

### 10.1 图片处理优化
- 批量上传，支持并发（限制并发数，例如 3）
- 图片压缩使用 Web Worker（避免阻塞 UI）
- 图片尺寸调整使用 GPU 加速（如果浏览器支持）

### 10.2 缓存优化
- Access Token 缓存（2小时有效期）
- 已上传图片缓存（避免重复上传相同图片）
- Markdown 解析结果缓存（相同内容不重复解析）

### 10.3 用户体验优化
- 显示处理进度（例如："正在处理图片 3/10..."）
- 支持取消操作（中断长时间运行的任务）
- 错误重试机制（自动重试失败的图片上传，最多 3 次）

## 11. 安全考虑

### 11.1 凭证安全
- AppSecret 不明文显示（使用密码输入框）
- AppSecret 不记录到日志
- 插件数据目录权限保护

### 11.2 数据安全
- 图片上传使用 HTTPS
- API 调用使用 HTTPS
- 不泄露用户笔记内容到第三方服务

## 12. 扩展性

### 12.1 未来可能的扩展
- 支持多个公众号账号
- 支持发布到知乎、掘金等其他平台
- 支持文章定时发布
- 支持文章统计分析
- 支持文章评论同步

### 12.2 架构设计考虑
- 模块化设计，易于扩展新功能
- 插件化架构，支持第三方扩展
- 配置驱动，易于添加新选项

## 13. 总结

本设计文档定义了 Obsidian 微信公众号插件的完整架构和功能实现方案。插件采用模块化设计，分为 5 个核心模块，实现了从 Markdown 笔记到微信公众号草稿的完整发布流程。设计考虑了用户体验、错误处理、性能优化和安全等多个方面，为后续开发提供了清晰的指导。
