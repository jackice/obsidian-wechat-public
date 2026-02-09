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

	async getCurrentIP(): Promise<string> {
		try {
			const res = await requestUrl({
				url: "https://api.ipify.org?format=json",
				method: "GET",
			});
			return res.json.ip;
		} catch (error) {
			throw new Error(`获取 IP 失败: ${error.message}`);
		}
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