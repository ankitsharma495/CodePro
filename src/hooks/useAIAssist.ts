import { useCallback, useEffect, useRef, useState } from "react";
import type {
	AIAssistAction,
	AIAssistErrorKind,
	AIAssistRequest,
	AIAssistState,
	AIFixSuggestion,
} from "../types/ai";
import type { EditorCode } from "../types/editor";

const INITIAL_STATE: AIAssistState = {
	status: "idle",
	action: null,
	text: "",
	suggestion: null,
	error: null,
};

class StreamResponseError extends Error {
	kind: AIAssistErrorKind;

	constructor(message: string, kind: AIAssistErrorKind) {
		super(message);
		this.name = "StreamResponseError";
		this.kind = kind;
	}
}

function parseSuggestion(text: string): AIFixSuggestion | null {
	const json = text
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	try {
		const parsed: unknown = JSON.parse(json);
		if (typeof parsed !== "object" || parsed === null) return null;
		const value = parsed as Record<string, unknown>;
		if (
			typeof value.html !== "string" ||
			typeof value.css !== "string" ||
			typeof value.javascript !== "string" ||
			typeof value.summary !== "string"
		) {
			return null;
		}
		return {
			html: value.html,
			css: value.css,
			javascript: value.javascript,
			summary: value.summary,
		};
	} catch {
		return null;
	}
}

function responseErrorKind(status: number, code: string): AIAssistErrorKind {
	if (status === 429 || code === "rate_limit") return "rate_limit";
	if (code === "bad_response" || code === "empty") return "bad_response";
	if (status >= 500) return "server";
	return "bad_response";
}

export default function useAIAssist(
	code: EditorCode,
	onAccept: (code: EditorCode) => void,
) {
	const [state, setState] = useState<AIAssistState>(INITIAL_STATE);
	const abortController = useRef<AbortController | null>(null);
	const previousRequest = useRef<AIAssistRequest | null>(null);
	const lastStartedAt = useRef(0);

	const execute = useCallback(async (request: AIAssistRequest) => {
		const controller = new AbortController();
		abortController.current = controller;
		setState({ ...INITIAL_STATE, status: "loading", action: request.action });
		let responseText = "";

		try {
			const response = await fetch("/api/ai", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(request),
				signal: controller.signal,
			});

			if (!response.ok) {
				const body: unknown = await response.json().catch(() => null);
				const errorObject =
					typeof body === "object" && body !== null
						? (body as { error?: { code?: string; message?: string } }).error
						: undefined;
				const code = errorObject?.code ?? "";
				const message =
					errorObject?.message ?? `AI request failed (${response.status}).`;
				setState({
					status: "error",
					action: request.action,
					text: "",
					suggestion: null,
					error: { kind: responseErrorKind(response.status, code), message },
				});
				return;
			}
			if (!response.body) {
				throw new StreamResponseError(
					"The AI response did not include a stream.",
					"bad_response",
				);
			}

			setState({
				...INITIAL_STATE,
				status: "streaming",
				action: request.action,
			});
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let pending = "";
			let receivedDoneMarker = false;
			const consumeLine = (line: string) => {
				if (!line.startsWith("data:")) return;
				const payload = line.slice(5).trim();
				if (!payload) return;
				if (payload === "[DONE]") {
					receivedDoneMarker = true;
					return;
				}
				let event: unknown;
				try {
					event = JSON.parse(payload);
				} catch {
					throw new StreamResponseError(
						"The AI stream contained invalid data.",
						"bad_response",
					);
				}
				if (typeof event !== "object" || event === null) {
					throw new StreamResponseError(
						"The AI stream returned an invalid response.",
						"bad_response",
					);
				}
				const chunk = event as { token?: unknown; error?: unknown };
				if (typeof chunk.error === "string") {
					throw new StreamResponseError(chunk.error, "server");
				}
				if (typeof chunk.token === "string") {
					responseText += chunk.token;
					setState({
						status: "streaming",
						action: request.action,
						text: responseText,
						suggestion: null,
						error: null,
					});
				}
			};

			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					pending += decoder.decode(value, { stream: true });
					const lines = pending.split(/\r?\n/);
					pending = lines.pop() ?? "";
					for (const line of lines) consumeLine(line);
				}
				pending += decoder.decode();
				if (pending) consumeLine(pending);
			} finally {
				reader.releaseLock();
			}

			if (!receivedDoneMarker || !responseText.trim()) {
				throw new StreamResponseError(
					"The AI response was empty or ended before completion. Retry the request.",
					"bad_response",
				);
			}

			if (request.action === "fix") {
				const suggestion = parseSuggestion(responseText);
				if (!suggestion) {
					throw new StreamResponseError(
						"The AI returned a fix in an unreadable format. Retry the request.",
						"bad_response",
					);
				}
				setState({
					status: "success",
					action: request.action,
					text: responseText,
					suggestion,
					error: null,
				});
			} else {
				setState({
					status: "success",
					action: request.action,
					text: responseText,
					suggestion: null,
					error: null,
				});
			}
		} catch (error) {
			if (controller.signal.aborted) return;
			const kind: AIAssistErrorKind =
				error instanceof StreamResponseError ? error.kind : "network";
			const message =
				error instanceof Error
					? error.message
					: "The network request failed. Check your connection and retry.";
			setState({
				status: "error",
				action: request.action,
				text: responseText,
				suggestion: null,
				error: { kind, message },
			});
		} finally {
			if (abortController.current === controller)
				abortController.current = null;
		}
	}, []);

	const run = useCallback(
		(action: AIAssistAction, previewError?: string) => {
			if (abortController.current) return;
			if (Date.now() - lastStartedAt.current < 500) return;
			if (action === "explain" && !previewError?.trim()) {
				setState({
					...INITIAL_STATE,
					status: "empty",
					action,
				});
				return;
			}
			lastStartedAt.current = Date.now();
			const request: AIAssistRequest = { action, code, previewError };
			previousRequest.current = request;
			void execute(request);
		},
		[code, execute],
	);

	const cancel = useCallback(() => {
		abortController.current?.abort();
		abortController.current = null;
		setState(INITIAL_STATE);
	}, []);

	const retry = useCallback(() => {
		if (abortController.current || !previousRequest.current) return;
		lastStartedAt.current = 0;
		void execute(previousRequest.current);
	}, [execute]);

	const acceptSuggestion = useCallback(() => {
		if (!state.suggestion) return;
		const { html, css, javascript } = state.suggestion;
		onAccept({ html, css, javascript });
		setState(INITIAL_STATE);
	}, [onAccept, state.suggestion]);

	const rejectSuggestion = useCallback(() => setState(INITIAL_STATE), []);

	useEffect(() => () => abortController.current?.abort(), []);

	return {
		state,
		run,
		cancel,
		retry,
		acceptSuggestion,
		rejectSuggestion,
	};
}
