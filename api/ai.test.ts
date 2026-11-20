import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAIRequest } from "./ai";

const requestBody = {
	action: "explain",
	code: { html: "<main />", css: "", javascript: "" },
	previewError: "ReferenceError: missingValue is not defined",
};

function post(body: unknown, ip: string) {
	return new Request("https://codepro.test/api/ai", {
		method: "POST",
		headers: { "content-type": "application/json", "x-real-ip": ip },
		body: JSON.stringify(body),
	});
}

describe("Vercel AI proxy", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it("validates input and returns an explicit empty-error response", async () => {
		const response = await handleAIRequest(
			post({ ...requestBody, previewError: " " }, "proxy-empty-test"),
		);
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({ error: { code: "empty" } });
	});

	it("streams Groq completion tokens without exposing provider credentials", async () => {
		vi.stubEnv("AI_PROVIDER", "groq");
		vi.stubEnv("GROQ_API_KEY", "unit-test-key");
		vi.stubEnv("AI_MODEL", "openai/gpt-oss-120b");
		const fetchMock = vi.fn(
			async (_url: string | URL | Request, options?: RequestInit) => {
				expect(new Headers(options?.headers).get("authorization")).toBe(
					"Bearer unit-test-key",
				);
				return new Response(
					'data: {"choices":[{"delta":{"content":"Readable "}}]}\n\n' +
						'data: {"choices":[{"delta":{"content":"explanation."}}]}\n\n' +
						"data: [DONE]\n\n",
					{ headers: { "content-type": "text/event-stream" } },
				);
			},
		);
		vi.stubGlobal("fetch", fetchMock);

		const response = await handleAIRequest(
			post(requestBody, "proxy-stream-test"),
		);
		const stream = await response.text();
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		expect(stream).toContain('"token":"Readable "');
		expect(stream).toContain('"token":"explanation."');
		expect(stream).toContain("data: [DONE]");
		expect(stream).not.toContain("unit-test-key");
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("rate limits repeated requests from the same client", async () => {
		const ip = `proxy-rate-test-${Date.now()}`;
		for (let index = 0; index < 6; index += 1) {
			const response = await handleAIRequest(post({ action: "unknown" }, ip));
			expect(response.status).toBe(400);
		}
		const response = await handleAIRequest(post({ action: "unknown" }, ip));
		expect(response.status).toBe(429);
	});

	it("forwards client cancellation to the provider request", async () => {
		vi.stubEnv("AI_PROVIDER", "groq");
		vi.stubEnv("GROQ_API_KEY", "unit-test-key");
		let providerSignal: AbortSignal | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
				providerSignal = options?.signal as AbortSignal;
				return new Response(new ReadableStream<Uint8Array>({ start() {} }), {
					headers: { "content-type": "text/event-stream" },
				});
			}),
		);
		const clientController = new AbortController();
		const request = new Request("https://codepro.test/api/ai", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-real-ip": "proxy-cancel-test",
			},
			body: JSON.stringify(requestBody),
			signal: clientController.signal,
		});

		const response = await handleAIRequest(request);
		clientController.abort();
		expect(providerSignal?.aborted).toBe(true);
		await response.body?.cancel();
	});

	it("rejects oversized payloads before parsing", async () => {
		const response = await handleAIRequest(
			new Request("https://codepro.test/api/ai", {
				method: "POST",
				headers: { "content-length": "70000", "x-real-ip": "proxy-size-test" },
				body: "{}",
			}),
		);
		expect(response.status).toBe(413);
	});
});
