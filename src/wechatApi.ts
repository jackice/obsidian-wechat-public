import { requestUrl, RequestUrlParam, Notice } from "obsidian";

const TOKEN_EXPIRY_BUFFER_SECONDS = 200;
const BOUNDARY_PREFIX = "----ObsidianWechatBoundary";

interface WechatApiResponse {
	errcode: number;
	errmsg: string;
}

interface AccessTokenResponse extends WechatApiResponse {
	access_token: string;
	expires_in: number;
}

interface UploadImageResponse extends WechatApiResponse {
	url: string;
}

interface UploadCoverResponse extends WechatApiResponse {
	media_id: string;
}

interface CreateDraftResponse extends WechatApiResponse {
	media_id: string;
}

export class WechatApiError extends Error {
	errcode: number;
	errmsg: string;

	constructor(errcode: number, errmsg: string, message?: string) {
		super(message || `WeChat API Error [${errcode}]: ${errmsg}`);
		this.name = "WechatApiError";
		this.errcode = errcode;
		this.errmsg = errmsg;
	}

	isRetryable(): boolean {
		const retryableCodes = [-1, 40001, 42001, 42002, 42007];
		return retryableCodes.includes(this.errcode);
	}
}

export class WechatApi {
	appId: string;
	appSecret: string;
	private accessToken: string = "";
	private expiresAt: number = 0;

	constructor(appId: string, appSecret: string) {
		if (!appId || !appSecret) {
			throw new Error("appId 和 appSecret 不能为空");
		}
		this.appId = appId;
		this.appSecret = appSecret;
	}

	async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.expiresAt) {
			return this.accessToken;
		}

		const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
		const res = await requestUrl({ url, method: "GET" });
		const data = res.json as AccessTokenResponse;

		if (data.errcode) {
			throw new WechatApiError(
				data.errcode,
				data.errmsg,
				`获取 Token 失败: [${data.errcode}] ${data.errmsg}`,
			);
		}

		this.accessToken = data.access_token;
		this.expiresAt = Date.now() + (data.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000;
		return this.accessToken;
	}

	async uploadImage(
		fileBuffer: ArrayBuffer,
		filename: string,
	): Promise<string> {
		const url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg`;
		const res = await this.uploadMedia(url, fileBuffer, filename) as UploadImageResponse;
		if (res.errcode)
			throw new WechatApiError(res.errcode, res.errmsg, `图片上传失败: ${res.errmsg}`);
		return res.url;
	}

	async uploadCover(
		fileBuffer: ArrayBuffer,
		filename: string,
	): Promise<string> {
		const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?type=image`;
		const res = await this.uploadMedia(url, fileBuffer, filename) as UploadCoverResponse;
		if (res.errcode)
			throw new WechatApiError(res.errcode, res.errmsg, `封面上传失败: ${res.errmsg}`);
		return res.media_id;
	}

	private async uploadMedia(
		url: string,
		fileBuffer: ArrayBuffer,
		filename: string,
	): Promise<WechatApiResponse> {
		const token = await this.getAccessToken();
		const { body, boundary } = this.buildMultipartBody(
			fileBuffer,
			filename,
			"media",
			"image/jpeg",
		);

		const res = await requestUrl({
			url: `${url}&access_token=${token}`,
			method: "POST",
			contentType: `multipart/form-data; boundary=${boundary}`,
			body: body,
		});

		return res.json as WechatApiResponse;
	}

	async createDraft(
		title: string,
		content: string,
		thumbMediaId: string,
		digest: string = "",
	): Promise<CreateDraftResponse> {
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

		const data = res.json as CreateDraftResponse;
		if (data.errcode)
			throw new WechatApiError(data.errcode, data.errmsg, `草稿创建失败: ${data.errmsg}`);
		return data;
	}

	async getCurrentIP(): Promise<string> {
		try {
			const res = await requestUrl({
				url: "https://api.ipify.org?format=json",
				method: "GET",
			});
			return res.json.ip;
		} catch (error) {
			if (error instanceof TypeError) {
				throw new Error(`网络错误: ${error.message}`);
			}
			if (error && typeof error === "object" && "status" in error) {
				throw new Error(`HTTP 错误: ${error.status}`);
			}
			throw new Error(`获取 IP 失败: ${error}`);
		}
	}

	private buildMultipartBody(
		fileBuffer: ArrayBuffer,
		filename: string,
		fieldName: string,
		mimeType: string = "image/jpeg",
	) {
		const boundary =
			BOUNDARY_PREFIX +
			Math.random().toString(36).substring(2);
		const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
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
