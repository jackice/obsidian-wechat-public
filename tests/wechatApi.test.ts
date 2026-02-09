import { describe, it, expect, vi, beforeEach } from "vitest";
import { WechatApi, WechatApiError } from "../src/wechatApi";
import { requestUrl } from "obsidian";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

describe("WechatApi", () => {
	let api: WechatApi;

	beforeEach(() => {
		api = new WechatApi("test_appid", "test_appsecret");
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create instance with valid credentials", () => {
			const api = new WechatApi("appid", "appsecret");
			expect(api.appId).toBe("appid");
			expect(api.appSecret).toBe("appsecret");
		});

		it("should throw error if appId is empty", () => {
			expect(() => new WechatApi("", "appsecret")).toThrow("appId 和 appSecret 不能为空");
		});

		it("should throw error if appSecret is empty", () => {
			expect(() => new WechatApi("appid", "")).toThrow("appId 和 appSecret 不能为空");
		});
	});

	describe("getAccessToken", () => {
		it("should return cached token if valid", async () => {
			(api as any).accessToken = "cached_token";
			(api as any).expiresAt = Date.now() + 60000;

			const token = await api.getAccessToken();
			expect(token).toBe("cached_token");
			expect(requestUrl).not.toHaveBeenCalled();
		});

		it("should fetch new token if expired", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					access_token: "new_token",
					expires_in: 7200,
				},
			} as any);

			(api as any).accessToken = "old_token";
			(api as any).expiresAt = Date.now() - 1000;

			const token = await api.getAccessToken();
			expect(token).toBe("new_token");
			expect((api as any).expiresAt).toBeGreaterThan(Date.now());
		});

		it("should throw WechatApiError on API error", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					errcode: 40001,
					errmsg: "invalid credential",
				},
			} as any);

			await expect(api.getAccessToken()).rejects.toThrow(WechatApiError);
		});
	});

	describe("uploadImage", () => {
		it("should upload image and return url", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					url: "https://example.com/image.jpg",
				},
			} as any);

			(api as any).accessToken = "token";

			const buffer = new ArrayBuffer(100);
			const url = await api.uploadImage(buffer, "test.jpg");
			expect(url).toBe("https://example.com/image.jpg");
		});

		it("should throw WechatApiError on upload failure", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					errcode: 40004,
					errmsg: "invalid media type",
				},
			} as any);

			(api as any).accessToken = "token";

			const buffer = new ArrayBuffer(100);
			await expect(api.uploadImage(buffer, "test.jpg")).rejects.toThrow(WechatApiError);
		});
	});

	describe("uploadCover", () => {
		it("should upload cover and return media_id", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					media_id: "media_123",
				},
			} as any);

			(api as any).accessToken = "token";

			const buffer = new ArrayBuffer(100);
			const mediaId = await api.uploadCover(buffer, "cover.jpg");
			expect(mediaId).toBe("media_123");
		});
	});

	describe("createDraft", () => {
		it("should create draft and return response", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					media_id: "draft_123",
					errcode: 0,
				},
			} as any);

			(api as any).accessToken = "token";

			const response = await api.createDraft("title", "content", "media_id", "digest");
			expect(response.media_id).toBe("draft_123");
		});

		it("should throw WechatApiError on create failure", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					errcode: 40007,
					errmsg: "invalid media_id",
				},
			} as any);

			(api as any).accessToken = "token";

			await expect(api.createDraft("title", "content", "media_id")).rejects.toThrow(WechatApiError);
		});
	});

	describe("getCurrentIP", () => {
		it("should return current IP", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: { ip: "1.2.3.4" },
			} as any);

			const ip = await api.getCurrentIP();
			expect(ip).toBe("1.2.3.4");
		});

		it("should throw error on network failure", async () => {
			vi.mocked(requestUrl).mockRejectedValue(new TypeError("Network error"));

			await expect(api.getCurrentIP()).rejects.toThrow("网络错误");
		});
	});
});

describe("WechatApiError", () => {
	it("should create error with errcode and errmsg", () => {
		const error = new WechatApiError(40001, "invalid credential");
		expect(error.name).toBe("WechatApiError");
		expect(error.errcode).toBe(40001);
		expect(error.errmsg).toBe("invalid credential");
	});

	it("should identify retryable errors", () => {
		const error = new WechatApiError(40001, "invalid credential");
		expect(error.isRetryable()).toBe(true);

		const error2 = new WechatApiError(40004, "invalid media type");
		expect(error2.isRetryable()).toBe(false);
	});
});
