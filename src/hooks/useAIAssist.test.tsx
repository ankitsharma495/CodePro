import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useAIAssist from "./useAIAssist";
import type { EditorCode } from "../types/editor";

const code: EditorCode = { html: "<h1>Hi</h1>", css: "", javascript: "" };
const encoder = new TextEncoder();

function streamingResponse(events: string[]) {
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const event of events) controller.enqueue(encoder.encode(event));
			controller.close();
		},
	});
	return new Response(body, {
		headers: { "content-type": "text/event-stream" },
	});
}

function tokenStream(text: string) {
	return streamingResponse([
		...Array.from(
			text,
			(character) => `data: ${JSON.stringify({ token: character })}\n\n`,
		),
		"data: [DONE]\n\n",
	]);
}

describe("useAIAssist", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("enters the empty state without a preview error and makes no request", () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => useAIAssist(code, vi.fn()));

		act(() => result.current.run("explain"));

		expect(result.current.state.status).toBe("empty");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("streams an explanation and reaches success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(tokenStream("Missing variable.")),
		);
		const { result } = renderHook(() => useAIAssist(code, vi.fn()));

		act(() => result.current.run("explain", "ReferenceError"));
		expect(result.current.state.status).toBe("loading");
		await waitFor(() => expect(result.current.state.status).toBe("success"));
		expect(result.current.state.text).toBe("Missing variable.");
	});

	it("classifies rate limits and retries the same request", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						error: { code: "rate_limit", message: "Slow down." },
					}),
					{
						status: 429,
						headers: { "content-type": "application/json" },
					},
				),
			)
			.mockResolvedValueOnce(tokenStream("Try again."));
		vi.stubGlobal("fetch", fetchMock);
		const { result } = renderHook(() => useAIAssist(code, vi.fn()));

		act(() => result.current.run("explain", "ReferenceError"));
		await waitFor(() => expect(result.current.state.status).toBe("error"));
		expect(result.current.state.error?.kind).toBe("rate_limit");
		act(() => result.current.retry());
		await waitFor(() => expect(result.current.state.status).toBe("success"));
		expect(result.current.state.text).toBe("Try again.");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("parses a streamed fix and applies it only after acceptance", async () => {
		const suggestion = {
			html: "<h1>Fixed</h1>",
			css: "h1 { color: green; }",
			javascript: "",
			summary: "Use valid markup.",
		};
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(tokenStream(JSON.stringify(suggestion))),
		);
		const onAccept = vi.fn();
		const { result } = renderHook(() => useAIAssist(code, onAccept));

		act(() => result.current.run("fix"));
		await waitFor(() => expect(result.current.state.status).toBe("success"));
		expect(onAccept).not.toHaveBeenCalled();
		act(() => result.current.acceptSuggestion());
		expect(onAccept).toHaveBeenCalledWith({
			html: suggestion.html,
			css: suggestion.css,
			javascript: suggestion.javascript,
		});
		expect(result.current.state.status).toBe("idle");
	});

	it("cancels an in-flight request and returns to idle", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: RequestInfo | URL, init?: RequestInit) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new DOMException("Aborted", "AbortError")),
						);
					}),
			),
		);
		const { result } = renderHook(() => useAIAssist(code, vi.fn()));

		act(() => result.current.run("explain", "ReferenceError"));
		expect(result.current.state.status).toBe("loading");
		act(() => result.current.cancel());
		expect(result.current.state.status).toBe("idle");
		await waitFor(() => expect(result.current.state.status).toBe("idle"));
	});
});
