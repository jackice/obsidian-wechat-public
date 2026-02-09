import { requestUrl, RequestUrlParam } from "obsidian";

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
	private useProxy: boolean = false;
	private proxyUrl: string = "";
	private proxyApiKey: string = "";

	constructor(appId: string, appSecret: string, useProxy: boolean = false, proxyUrl: string = "", proxyApiKey: string = "") {
		if (!appId || !appSecret) {
			throw new Error("appId 和 appSecret 不能为空");
		}
		this.appId = appId;
		this.appSecret = appSecret;
		this.useProxy = useProxy;
		this.proxyUrl = proxyUrl;
		this.proxyApiKey = proxyApiKey;
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		const chunkSize = 32768;
		for (let i = 0; i < bytes.length; i += chunkSize) {
			binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as unknown as number[]);
		}
		return btoa(binary);
	}

	private async sendRequest(options: RequestUrlParam): Promise<any> {
		console.log(`[WechatApi] Mode: ${this.useProxy ? 'PROXY' : 'DIRECT'}, proxyUrl: ${this.proxyUrl || 'none'}`);

		if (this.useProxy && this.proxyUrl) {
			const isUpload = options.body instanceof ArrayBuffer;
			const proxyPath = isUpload ? "/api/wechat/upload" : "/api/wechat";
			const proxyUrl = `${this.proxyUrl}${proxyPath}`;

			if (isUpload) {
				const body = options.body as ArrayBuffer;
				const base64Body = this.arrayBufferToBase64(body);
				const multipartBody = JSON.stringify({
					target_url: options.url,
					filename: "upload",
					content_type: options.contentType || "application/octet-stream",
					file: base64Body,
				});

				console.log(`[WechatApi] Upload proxy request: ${proxyUrl}, size: ${base64Body.length}`);

				const proxyOptions: RequestUrlParam = {
					url: proxyUrl,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(this.proxyApiKey ? { "Authorization": `Bearer ${this.proxyApiKey}` } : {}),
					},
					body: multipartBody,
				};

				try {
					const res = await requestUrl(proxyOptions);
					console.log(`[WechatApi] Upload response: ${JSON.stringify(res.json)}`);

					// 代理返回格式: {"data": {...}}
					const responseData = res.json?.data || res.json;
					if (responseData?.errcode && responseData.errcode !== 0) {
						throw new WechatApiError(responseData.errcode, responseData.errmsg, `上传失败: ${responseData.errmsg}`);
					}
					return responseData;
				} catch (error: any) {
					console.error(`[WechatApi] Upload failed: ${error?.status || 'unknown'}, ${error?.message || error}`);
					throw error;
				}
			} else {
				const proxyBody = JSON.stringify({
					target_url: options.url,
					method: options.method || "GET",
					body: options.body,
				});

				console.log(`[WechatApi] Proxy request: ${proxyUrl}`);

				const proxyOptions: RequestUrlParam = {
					url: proxyUrl,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(this.proxyApiKey ? { "Authorization": `Bearer ${this.proxyApiKey}` } : {}),
					},
					body: proxyBody,
				};

				try {
					const res = await requestUrl(proxyOptions);
					console.log(`[WechatApi] Proxy response: ${JSON.stringify(res.json)}`);

					// 代理返回格式: {"data": {...}}
					const responseData = res.json?.data || res.json;
					if (responseData?.errcode && responseData.errcode !== 0) {
						throw new WechatApiError(responseData.errcode, responseData.errmsg, `请求失败: ${responseData.errmsg}`);
					}
					return responseData;
				} catch (error: any) {
					console.error(`[WechatApi] Proxy failed: ${error?.status || 'unknown'}, ${error?.message || error}`);
					throw error;
				}
			}
		} else {
			console.log(`[WechatApi] Direct request: ${options.url}`);
			try {
				const res = await requestUrl(options);
				if (res.json?.errcode && res.json.errcode !== 0) {
					throw new WechatApiError(res.json.errcode, res.json.errmsg, `请求失败: ${res.json.errmsg}`);
				}
				return res.json;
			} catch (error: any) {
				console.error(`[WechatApi] Direct failed: ${error?.status || 'unknown'}`);
				throw error;
			}
		}
	}

	async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.expiresAt) {
			const remaining = Math.round((this.expiresAt - Date.now()) / 1000);
			console.log(`[WechatApi] Using cached token, expires in ${remaining}s`);
			return this.accessToken;
		}

		const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=***`;
		console.log(`[WechatApi] Fetching new token...`);
		const data = await this.sendRequest({ url, method: "GET" }) as AccessTokenResponse;

		if (data.errcode) {
			throw new WechatApiError(
				data.errcode,
				data.errmsg,
				`获取 Token 失败: [${data.errcode}] ${data.errmsg}`,
			);
		}

		this.accessToken = data.access_token;
		this.expiresAt = Date.now() + (data.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000;
		console.log(`[WechatApi] Token fetched, expires in ${data.expires_in}s`);
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
		const uploadUrl = `${url}&access_token=${token}`;
		console.log(`[WechatApi] Uploading: ${filename}, size: ${fileBuffer.byteLength} bytes`);

		return await this.sendRequest({
			url: uploadUrl,
			method: "POST",
			contentType: "application/octet-stream",
			body: fileBuffer,
		}) as WechatApiResponse;
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

		const data = await this.sendRequest({
			url: url,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify({ articles: [article] }),
		}) as CreateDraftResponse;
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
}
