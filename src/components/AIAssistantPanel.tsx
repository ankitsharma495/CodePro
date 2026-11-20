import type { AIAssistAction, AIAssistState } from "../types/ai";
import type { EditorCode } from "../types/editor";

interface AIAssistantPanelProps {
	code: EditorCode;
	state: AIAssistState;
	onExplain: () => void;
	onSuggestFix: () => void;
	onCancel: () => void;
	onRetry: () => void;
	onAccept: () => void;
	onReject: () => void;
	onClose: () => void;
}

function actionLabel(action: AIAssistAction | null) {
	return action === "fix" ? "Suggested fix" : "Error explanation";
}

export default function AIAssistantPanel({
	code,
	state,
	onExplain,
	onSuggestFix,
	onCancel,
	onRetry,
	onAccept,
	onReject,
	onClose,
}: AIAssistantPanelProps) {
	const isActive = state.status === "loading" || state.status === "streaming";

	return (
		<aside
			id="ai-assistant-panel"
			className="ai-panel"
			aria-label="AI troubleshooting assistant"
		>
			<header className="ai-panel-header">
				<div>
					<h2>AI troubleshooting</h2>
					<p>
						Your configured AI provider analyzes the current code and preview
						output.
					</p>
				</div>
				<button type="button" aria-label="Close AI assistant" onClick={onClose}>
					Close
				</button>
			</header>
			<div className="ai-actions">
				<button type="button" disabled={isActive} onClick={onExplain}>
					Explain error
				</button>
				<button type="button" disabled={isActive} onClick={onSuggestFix}>
					Suggest fix
				</button>
				{isActive && (
					<button type="button" onClick={onCancel}>
						Cancel
					</button>
				)}
			</div>

			<p className="ai-status" role="status" aria-live="polite">
				{state.status === "idle" &&
					"Ask for an explanation or a suggested code fix."}
				{state.status === "empty" &&
					"No preview error captured yet. Run code that produces an error, then choose Explain error."}
				{state.status === "loading" && "Sending your request…"}
				{state.status === "streaming" &&
					`Streaming ${actionLabel(state.action).toLowerCase()}…`}
				{state.status === "success" && `${actionLabel(state.action)} ready.`}
				{state.status === "error" &&
					`Request failed (${state.error?.kind.replace("_", " ") ?? "unknown error"}).`}
			</p>

			{state.error && (
				<div className="ai-error" role="alert">
					<p>{state.error.message}</p>
					<button type="button" onClick={onRetry}>
						Retry
					</button>
				</div>
			)}

			{state.action === "explain" && state.text && (
				<div className="ai-response" aria-live="polite">
					{state.text}
				</div>
			)}

			{state.action === "fix" && state.status === "streaming" && (
				<pre className="ai-streaming-response" aria-live="polite">
					{state.text}
				</pre>
			)}

			{state.suggestion && (
				<section className="ai-diff" aria-label="Suggested code diff">
					<p>{state.suggestion.summary}</p>
					<div className="ai-diff-columns">
						<article>
							<h3>Current code</h3>
							<pre>{JSON.stringify(code, null, 2)}</pre>
						</article>
						<article>
							<h3>Suggested code</h3>
							<pre>
								{JSON.stringify(
									{
										html: state.suggestion.html,
										css: state.suggestion.css,
										javascript: state.suggestion.javascript,
									},
									null,
									2,
								)}
							</pre>
						</article>
					</div>
					<div className="ai-diff-actions">
						<button type="button" onClick={onAccept}>
							Accept fix
						</button>
						<button type="button" onClick={onReject}>
							Reject fix
						</button>
					</div>
				</section>
			)}
		</aside>
	);
}
