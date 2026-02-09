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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.previewContainer.empty();
      this.previewContainer.createEl('p', {
        text: `预览加载失败: ${errorMessage}`,
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
