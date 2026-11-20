import type {
	AIAssistAction,
	AIAssistState,
	AISelectionContext,
} from "../types/ai";
import type { EditorCode } from "../types/editor";
import type { PointerEvent } from "react";
import { useMemo, useState } from "react";

interface AIAssistantPanelProps {
	code: EditorCode;
	context: AISelectionContext;
	width: number;
	onResizeStart: (event: PointerEvent<HTMLDivElement>) => void;
	onResizeMove: (event: PointerEvent<HTMLDivElement>) => void;
	onResizeEnd: () => void;
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
	context,
	width,
	onResizeStart,
	onResizeMove,
	onResizeEnd,
	state,
	onExplain,
	onSuggestFix,
	onCancel,
	onRetry,
	onAccept,
	onReject,
	onClose,
}: AIAssistantPanelProps) {
	const [selectedFile, setSelectedFile] = useState<keyof EditorCode>(
		context.language,
	);
	const [showSuggestedCode, setShowSuggestedCode] = useState(true);
	const isActive = state.status === "loading" || state.status === "streaming";
	const line = context.selectedCode || "No code selection";
	// Keep the file tabs stable while the streamed suggestion is unchanged.
	const changedFiles = useMemo(() => {
		if (!state.suggestion) return [];
		return (Object.keys(state.suggestion) as Array<keyof EditorCode>).filter(
			(file) => state.suggestion?.[file] !== code[file],
		);
	}, [code, state.suggestion]);
	const activeFile = changedFiles.includes(selectedFile)
		? selectedFile
		: (changedFiles[0] ?? context.language);
	return (
		<aside
			id="ai-assistant-panel"
			aria-labelledby="ai-panel-title"
			style={{ width, maxWidth: "100%" }}
			className="fixed bottom-6 right-0 top-12 z-30 flex w-[400px] max-w-full flex-col border-l border-light-outline-variant bg-light-surface-container-low shadow-2xl dark:border-dark-outline-variant dark:bg-dark-surface-container-low"
		>
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize AI panel"
				tabIndex={0}
				className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize hover:bg-light-primary dark:hover:bg-dark-primary"
				onPointerDown={onResizeStart}
				onPointerMove={onResizeMove}
				onPointerUp={onResizeEnd}
				onPointerCancel={onResizeEnd}
				onKeyDown={(event) => {
					if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
						event.preventDefault();
					}
				}}
			/>
			<header className="flex items-start justify-between border-b border-light-outline bg-light-surface-container px-gutter-lg py-gutter-md dark:border-dark-outline dark:bg-dark-surface-container">
				<div>
					<h2 id="ai-panel-title" className="font-title text-title-md">
						AI troubleshooting
					</h2>
					<p className="font-label text-label-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
						{context.language.toUpperCase()} selection
						{context.issueLevel ? ` · ${context.issueLevel}` : ""}
					</p>
				</div>
				<button
					type="button"
					aria-label="Close AI assistant"
					className="rounded p-1 text-light-on-surface-variant hover:bg-light-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
					onClick={onClose}
				>
					<svg
						className="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</header>
			<div className="flex flex-1 flex-col gap-gutter-md overflow-auto editor-scroll p-gutter-lg">
				<div className="rounded-md border border-light-outline bg-light-surface-container p-gutter-md dark:border-dark-outline dark:bg-dark-surface-container">
					<p
						className={`mb-gutter-sm font-body text-body-md ${context.issueLevel === "error" ? "text-error" : context.issueLevel === "warn" ? "text-warning" : "text-light-on-surface-variant dark:text-dark-on-surface-variant"}`}
					>
						{context.issueMessage ??
							"Select code to ask for a focused explanation or fix."}
					</p>
					<pre className="overflow-x-auto font-code text-code-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
						{line}
					</pre>
				</div>
				<div className="flex items-center gap-gutter-sm">
					<button
						type="button"
						disabled={isActive || !context.issueMessage}
						className="h-8 flex-1 rounded border border-light-outline bg-light-surface-container-low px-gutter-md font-label text-label-md hover:bg-light-surface-container-high disabled:opacity-50 dark:border-dark-outline dark:bg-dark-surface-container-low dark:hover:bg-dark-surface-container-high"
						onClick={onExplain}
					>
						Explain error
					</button>
					<button
						type="button"
						disabled={isActive}
						className="h-8 flex-1 rounded bg-light-primary px-gutter-md font-label text-label-md text-light-on-primary hover:opacity-90 disabled:opacity-50 dark:bg-dark-primary dark:text-dark-on-primary"
						onClick={onSuggestFix}
					>
						Suggest fix
					</button>
				</div>
				{isActive && (
					<button
						type="button"
						className="self-start rounded border border-light-outline px-gutter-md py-1 font-label text-label-md dark:border-dark-outline"
						onClick={onCancel}
					>
						Cancel request
					</button>
				)}
				{state.status === "idle" && (
					<div className="rounded-md border border-light-outline p-gutter-md font-body text-body-md text-light-on-surface-variant dark:border-dark-outline dark:text-dark-on-surface-variant">
						Ask for an explanation or a suggested code fix for the selected
						line.
					</div>
				)}
				{state.status === "empty" && (
					<div className="rounded-md border border-light-outline p-gutter-md font-body text-body-md text-light-on-surface-variant dark:border-dark-outline dark:text-dark-on-surface-variant">
						Capture a preview warning or error before asking for an explanation.
					</div>
				)}
				{(state.status === "loading" || state.status === "streaming") && (
					<div className="flex flex-col gap-gutter-sm rounded-md border border-light-outline bg-light-surface-container p-gutter-md dark:border-dark-outline dark:bg-dark-surface-container">
						<p className="font-label text-label-md text-light-primary dark:text-dark-on-primary-container">
							{state.status === "loading"
								? "Connecting to assistant…"
								: `Streaming ${actionLabel(state.action).toLowerCase()}…`}
						</p>
						{state.text && (
							<pre className="whitespace-pre-wrap font-code text-code-sm">
								{state.text}
							</pre>
						)}
					</div>
				)}
				{state.status === "error" && (
					<div
						role="alert"
						className="flex items-center justify-between gap-gutter-sm rounded-md border border-error/50 bg-error/10 p-gutter-md"
					>
						<span className="font-body text-body-md text-error">
							{state.error?.message}
						</span>
						<button
							type="button"
							className="h-7 rounded border border-error px-gutter-sm font-label text-label-sm text-error"
							onClick={onRetry}
						>
							Retry
						</button>
					</div>
				)}
				{state.status === "success" &&
					state.action === "explain" &&
					state.text && (
						<div
							className="whitespace-pre-wrap rounded-md border border-light-outline p-gutter-md font-body text-body-md dark:border-dark-outline"
							role="status"
						>
							{state.text}
						</div>
					)}
				{state.suggestion && (
					<section
						className="flex flex-col gap-gutter-sm"
						aria-label="Suggested code diff"
					>
						<p className="rounded-md border border-light-outline bg-light-surface-container p-gutter-md font-body text-body-md dark:border-dark-outline dark:bg-dark-surface-container">
							{state.suggestion.summary}
						</p>
						{changedFiles.length > 0 ? (
							<>
								<div
									className="flex flex-wrap gap-1"
									role="tablist"
									aria-label="Changed files"
								>
									{changedFiles.map((file) => (
										<button
											key={file}
											type="button"
											role="tab"
											aria-selected={activeFile === file}
											className={`rounded px-gutter-md py-1 font-code text-code-sm ${activeFile === file ? "bg-light-primary text-light-on-primary dark:bg-dark-primary dark:text-dark-on-primary" : "bg-light-surface-container-high text-light-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"}`}
											onClick={() => setSelectedFile(file)}
										>
											{file === "javascript"
												? "script.js"
												: file === "html"
													? "index.html"
													: "styles.css"}
										</button>
									))}
								</div>
								<div className="flex items-center justify-between gap-gutter-sm">
									<p className="font-label text-label-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
										{showSuggestedCode ? "Suggested code" : "Current code"}
									</p>
									<div
										className="flex rounded-md border border-light-outline p-0.5 dark:border-dark-outline"
										aria-label="Code version"
									>
										<button
											type="button"
											aria-pressed={!showSuggestedCode}
											className={`rounded px-gutter-sm py-1 font-label text-label-sm ${!showSuggestedCode ? "bg-light-surface-container-high dark:bg-dark-surface-container-high" : ""}`}
											onClick={() => setShowSuggestedCode(false)}
										>
											Current
										</button>
										<button
											type="button"
											aria-pressed={showSuggestedCode}
											className={`rounded px-gutter-sm py-1 font-label text-label-sm ${showSuggestedCode ? "bg-success/15 text-success" : ""}`}
											onClick={() => setShowSuggestedCode(true)}
										>
											Suggested
										</button>
									</div>
								</div>
								<pre
									className="max-h-80 min-h-32 overflow-auto rounded-md border border-light-outline bg-light-surface-container p-gutter-md font-code text-code-sm leading-relaxed text-light-on-surface dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-on-surface"
									role="tabpanel"
									aria-label={`${activeFile} ${showSuggestedCode ? "suggested" : "current"} code`}
								>
									<code>
										{showSuggestedCode
											? state.suggestion[activeFile]
											: code[activeFile]}
									</code>
								</pre>
							</>
						) : (
							<p className="rounded-md border border-light-outline p-gutter-md font-body text-body-md text-light-on-surface-variant dark:border-dark-outline dark:text-dark-on-surface-variant">
								No code changes were suggested.
							</p>
						)}
						<div className="flex items-center gap-gutter-sm pt-gutter-xs">
							<button
								type="button"
								className="h-8 flex-1 rounded bg-light-primary font-label text-label-md text-light-on-primary hover:opacity-90 dark:bg-dark-primary dark:text-dark-on-primary"
								onClick={onAccept}
							>
								Accept fix
							</button>
							<button
								type="button"
								className="h-8 flex-1 rounded border border-light-outline bg-light-surface-container-low font-label text-label-md hover:bg-light-surface-container-high dark:border-dark-outline dark:bg-dark-surface-container-low dark:hover:bg-dark-surface-container-high"
								onClick={onReject}
							>
								Reject fix
							</button>
						</div>
					</section>
				)}
			</div>
		</aside>
	);
}
