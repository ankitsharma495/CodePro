import type { AIAssistAction } from "../src/types/ai";
import type { EditorCode } from "../src/types/editor";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CODE_CHARACTERS = 48_000;
const MAX_ERROR_CHARACTERS = 4_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 6;
// This per-instance limit is a lightweight abuse guard; it is not a shared quota across serverless instances.
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const encoder = new TextEncoder();

interface ValidRequest {
	action: AIAssistAction;
	code: EditorCode;
	previewError?: string;
}

function jsonResponse(status: number, code: string, message: string) {
	return new Response(JSON.stringify({ error: { code, message } }), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
			...(status === 429 ? { "retry-after": "60" } : {}),
		},
	});
}

async function readLimitedBody(request: Request): Promise<unknown> {
	const declaredLength = Number(request.headers.get("content-length") ?? 0);
	if (declaredLength > MAX_BODY_BYTES)
		throw new RangeError("Request body is too large.");
	if (!request.body) throw new SyntaxError("Request body is required.");

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			byteLength += value.byteLength;
			if (byteLength > MAX_BODY_BYTES) {
				await reader.cancel();
				throw new RangeError("Request body is too large.");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function isValidRequest(value: unknown): value is ValidRequest {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	if (candidate.action !== "explain" && candidate.action !== "fix")
		return false;
	if (typeof candidate.code !== "object" || candidate.code === null)
		return false;
	const code = candidate.code as Record<string, unknown>;
	if (
		!["html", "css", "javascript"].every((key) => typeof code[key] === "string")
	) {
		return false;
	}
	if (
		candidate.previewError !== undefined &&
		typeof candidate.previewError !== "string"
	) {
		return false;
	}
	return true;
}

function isRateLimited(key: string, now = Date.now()) {
	for (const [entryKey, bucket] of rateBuckets) {
		if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS)
			rateBuckets.delete(entryKey);
	}
	const current = rateBuckets.get(key);
	if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
		if (!current && rateBuckets.size >= 5_000) return true;
		rateBuckets.set(key, { count: 1, windowStart: now });
		return false;
	}
	if (current.count >= RATE_LIMIT_REQUESTS) return true;
	current.count += 1;
	return false;
}

function buildMessages(request: ValidRequest) {
	const source = JSON.stringify(request.code);
	if (request.action === "explain") {
		return [
			{
				role: "system",
				content:
					"You are a concise frontend debugging assistant. Explain the supplied runtime error in plain language, identify the likely cause using only the provided code, and suggest a focused next step. Do not claim certainty when the code does not prove the cause.",
			},
			{
				role: "user",
				content: `Preview error:\n${request.previewError}\n\nCurrent HTML, CSS, and JavaScript:\n${source}`,
			},
		];
	}
	return [
		{
			role: "system",
			content:
				'Repair the frontend code while preserving its intent. Return only one valid JSON object with string fields "html", "css", "javascript", and "summary". Do not wrap the JSON in Markdown fences or include commentary outside it.',
		},
		{
			role: "user",
			content: `Preview error (if any):\n${request.previewError ?? "None provided"}\n\nCurrent HTML, CSS, and JavaScript:\n${source}`,
		},
	];
}

function createStreamingResponse(
	upstream: Response,
	abortController: AbortController,
) {
	if (!upstream.body)
		return jsonResponse(
			502,
			"provider_error",
			"The AI provider returned no stream.",
		);
	const providerReader = upstream.body.getReader();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const decoder = new TextDecoder();
			let pending = "";
			const sendError = (message: string) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
				);
			};
			const processFrame = (frame: string) => {
				const data = frame
					.split(/\r?\n/)
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice(5).trim())
					.join("\n");
				if (!data || data === "[DONE]") return;
				const event: unknown = JSON.parse(data);
				if (typeof event !== "object" || event === null) return;
				const choices = (
					event as { choices?: Array<{ delta?: { content?: unknown } }> }
				).choices;
				const token = choices?.[0]?.delta?.content;
				if (typeof token === "string" && token.length > 0) {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
					);
				}
			};

			try {
				while (true) {
					const { value, done } = await providerReader.read();
					if (done) break;
					pending += decoder.decode(value, { stream: true });
					const frames = pending.split(/\r?\n\r?\n/);
					pending = frames.pop() ?? "";
					for (const frame of frames) processFrame(frame);
				}
				pending += decoder.decode();
				if (pending.trim()) processFrame(pending);
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			} catch (error) {
				if (!abortController.signal.aborted) {
					sendError(
						error instanceof Error
							? error.message
							: "The AI stream ended unexpectedly.",
					);
					controller.close();
				}
			} finally {
				providerReader.releaseLock();
			}
		},
		async cancel() {
			abortController.abort();
			await providerReader.cancel();
		},
	});

	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
			"x-accel-buffering": "no",
		},
	});
}

export async function handleAIRequest(request: Request): Promise<Response> {
	if (request.method !== "POST") {
		return jsonResponse(405, "method_not_allowed", "Use POST for AI requests.");
	}

	const ip =
		request.headers.get("x-real-ip") ??
		request.headers.get("x-forwarded-for") ??
		"unknown";
	if (isRateLimited(ip.split(",")[0]?.trim() ?? "unknown")) {
		return jsonResponse(
			429,
			"rate_limit",
			"Too many AI requests. Try again in a minute.",
		);
	}

	let rawBody: unknown;
	try {
		rawBody = await readLimitedBody(request);
	} catch (error) {
		if (error instanceof RangeError)
			return jsonResponse(413, "payload_too_large", error.message);
		return jsonResponse(400, "bad_request", "Request body must be valid JSON.");
	}
	if (!isValidRequest(rawBody)) {
		return jsonResponse(
			400,
			"bad_request",
			"Provide an action and HTML, CSS, and JavaScript strings.",
		);
	}
	const codeSize =
		rawBody.code.html.length +
		rawBody.code.css.length +
		rawBody.code.javascript.length;
	if (codeSize > MAX_CODE_CHARACTERS) {
		return jsonResponse(
			413,
			"payload_too_large",
			"The project code exceeds the 48,000 character limit.",
		);
	}
	if (rawBody.action === "explain" && !rawBody.previewError?.trim()) {
		return jsonResponse(
			422,
			"empty",
			"There is no preview error to explain yet.",
		);
	}
	if ((rawBody.previewError?.length ?? 0) > MAX_ERROR_CHARACTERS) {
		return jsonResponse(
			413,
			"payload_too_large",
			"The preview error is too long.",
		);
	}

	const provider = process.env.AI_PROVIDER ?? "groq";
	const apiKey =
		provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
	const model =
		process.env.AI_MODEL ??
		(provider === "groq" ? "openai/gpt-oss-120b" : undefined);
	if (provider !== "groq" && provider !== "openai") {
		return jsonResponse(
			500,
			"configuration",
			"AI_PROVIDER must be groq or openai.",
		);
	}
	if (!apiKey || !model) {
		return jsonResponse(
			503,
			"configuration",
			"The AI provider is not configured on the server.",
		);
	}

	const abortController = new AbortController();
	request.signal.addEventListener("abort", () => abortController.abort(), {
		once: true,
	});
	const endpoint =
		provider === "groq"
			? "https://api.groq.com/openai/v1/chat/completions"
			: "https://api.openai.com/v1/chat/completions";
	let upstream: Response;
	try {
		upstream = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages: buildMessages(rawBody),
				stream: true,
				max_completion_tokens: 4096,
			}),
			signal: abortController.signal,
		});
	} catch {
		if (abortController.signal.aborted)
			return new Response(null, { status: 499 });
		return jsonResponse(
			502,
			"provider_error",
			"Could not connect to the AI provider.",
		);
	}

	if (!upstream.ok) {
		if (upstream.status === 429) {
			return jsonResponse(
				429,
				"rate_limit",
				"The AI provider is rate limited. Try again shortly.",
			);
		}
		if (upstream.status === 401 || upstream.status === 403) {
			return jsonResponse(
				503,
				"configuration",
				"The server-side AI provider key was rejected.",
			);
		}
		return jsonResponse(
			502,
			"provider_error",
			"The AI provider could not complete this request.",
		);
	}
	return createStreamingResponse(upstream, abortController);
}

export default { fetch: handleAIRequest };
