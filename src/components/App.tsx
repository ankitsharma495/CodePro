import {
	Fragment,
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import Editor from "./Editor";
import ConsolePanel from "./ConsolePanel";
import useAIAssist from "../hooks/useAIAssist";
import useEditorState from "../hooks/useEditorState";
import usePreviewRunner from "../hooks/usePreviewRunner";
import useProjectFiles from "../hooks/useProjectFiles";
import usePaneLayout, { type PaneDividerIndex } from "../hooks/usePaneLayout";
import useTheme from "../hooks/useTheme";
import { encodeShareLink, decodeShareHash } from "../services/shareLink";
import { imageSources } from "../assets/images";
import ImagePreloader from "../utilities/ImagePreloader";
import type { EditorCode } from "../types/editor";
import type { AISelectionContext } from "../types/ai";

const AIAssistantPanel = lazy(() => import("./AIAssistantPanel"));

type LayoutDirection = "horizontal" | "vertical";

function App() {
	const { code, updateCode, replaceCode, saveStatus } = useEditorState();
	const { theme, setTheme } = useTheme();
	const [layout, setLayout] = useState<LayoutDirection>("horizontal");
	const paneLayout = usePaneLayout(layout);
	const [shareNotice, setShareNotice] = useState("");
	const [shareError, setShareError] = useState("");
	const [shareUrl, setShareUrl] = useState("");
	const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
	const [aiContext, setAIContext] = useState<AISelectionContext | null>(null);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const { previewDocument, entries, clearEntries } = usePreviewRunner(
		code,
		iframeRef,
	);
	const removeStaleShareHash = useCallback(() => {
		if (window.location.hash.startsWith("#code=")) {
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}${window.location.search}`,
			);
		}
	}, []);
	const handleImport = useCallback(
		(importedCode: typeof code) => {
			replaceCode(importedCode);
			setShareUrl("");
			setShareNotice("");
			removeStaleShareHash();
		},
		[removeStaleShareHash, replaceCode],
	);
	const handleAIApply = useCallback(
		(suggestion: EditorCode) => {
			replaceCode(suggestion);
			setShareUrl("");
			setShareNotice("");
			removeStaleShareHash();
		},
		[removeStaleShareHash, replaceCode],
	);
	const aiAssist = useAIAssist(code, handleAIApply);
	const cancelAIAssist = aiAssist.cancel;
	const { fileInputRef, fileError, downloadHtml, downloadZip, importFile } =
		useProjectFiles(code, handleImport);

	useEffect(() => {
		if (!window.location.hash.startsWith("#code=")) return;
		let active = true;
		decodeShareHash(window.location.hash)
			.then((sharedCode) => {
				if (!active) return;
				replaceCode(sharedCode);
				setShareError("");
				setShareNotice("Project restored from share link.");
			})
			.catch((error: unknown) => {
				if (active) {
					setShareError(
						error instanceof Error
							? error.message
							: "This share link could not be opened.",
					);
				}
			});
		return () => {
			active = false;
		};
	}, [replaceCode]);

	const updateHtml = useCallback(
		(value: string) => {
			updateCode("html", value);
			setShareUrl("");
			setShareNotice("");
			removeStaleShareHash();
		},
		[removeStaleShareHash, updateCode],
	);
	const updateCss = useCallback(
		(value: string) => {
			updateCode("css", value);
			setShareUrl("");
			setShareNotice("");
			removeStaleShareHash();
		},
		[removeStaleShareHash, updateCode],
	);
	const updateJavascript = useCallback(
		(value: string) => {
			updateCode("javascript", value);
			setShareUrl("");
			setShareNotice("");
			removeStaleShareHash();
		},
		[removeStaleShareHash, updateCode],
	);

	const handleShare = useCallback(async () => {
		setShareNotice("Creating share link…");
		setShareError("");
		try {
			const nextShareUrl = await encodeShareLink(code);
			setShareUrl(nextShareUrl);
			window.history.replaceState(null, "", nextShareUrl);
			try {
				await navigator.clipboard.writeText(nextShareUrl);
				setShareNotice("Share link copied to clipboard.");
			} catch {
				setShareNotice("Share link ready. Copy it from the field below.");
			}
		} catch (error) {
			setShareNotice("");
			setShareError(
				error instanceof Error
					? error.message
					: "Could not create or copy the share link.",
			);
		}
	}, [code]);

	const dismissShareError = () => {
		setShareError("");
		if (window.location.hash.startsWith("#code=")) {
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}${window.location.search}`,
			);
		}
	};
	const latestPreviewIssue = useMemo(() => {
		const entry = [...entries]
			.reverse()
			.find(
				(candidate) =>
					candidate.level === "error" || candidate.level === "warn",
			);
		return entry
			? {
					issueLevel: entry.level as "warn" | "error",
					issueMessage: entry.message,
				}
			: undefined;
	}, [entries]);
	const openAIForSelection = useCallback(
		(context: AISelectionContext) => {
			cancelAIAssist();
			setAIContext(context);
			setIsAIPanelOpen(true);
		},
		[cancelAIAssist],
	);
	const closeAIPanel = useCallback(() => {
		cancelAIAssist();
		setIsAIPanelOpen(false);
		setAIContext(null);
	}, [cancelAIAssist]);
	const openAIAssistant = useCallback(() => {
		setAIContext(
			(current) =>
				current ?? {
					language: "javascript",
					selectedCode: "",
					...(latestPreviewIssue ?? {}),
				},
		);
		setIsAIPanelOpen(true);
	}, [latestPreviewIssue]);

	return (
		<ImagePreloader images={imageSources}>
			<main className={`app-shell theme-${theme}`}>
				<header className="app-toolbar">
					<a className="app-brand" href="/" aria-label="CodePro home">
						CodePro
					</a>
					<div className="toolbar-actions">
						<span
							className={`save-status status-${saveStatus}`}
							role="status"
							aria-live="polite"
						>
							{saveStatus === "saving" && "Saving…"}
							{saveStatus === "saved" && "Saved"}
							{saveStatus === "failed" && "Save failed"}
						</span>
						<button type="button" onClick={handleShare}>
							Share
						</button>
						<button
							type="button"
							aria-expanded={isAIPanelOpen}
							aria-controls="ai-assistant-panel"
							onClick={openAIAssistant}
						>
							AI assistant
						</button>
						<button
							type="button"
							aria-pressed={layout === "horizontal"}
							onClick={() => setLayout("horizontal")}
						>
							Horizontal layout
						</button>
						<button
							type="button"
							aria-pressed={layout === "vertical"}
							onClick={() => setLayout("vertical")}
						>
							Vertical layout
						</button>
						<button
							type="button"
							aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
							onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
						>
							{theme === "dark" ? "Light theme" : "Dark theme"}
						</button>
						<button type="button" onClick={downloadHtml}>
							Download HTML
						</button>
						<button type="button" onClick={() => void downloadZip()}>
							Download ZIP
						</button>
						<button type="button" onClick={() => fileInputRef.current?.click()}>
							Import file
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".html,.htm,.zip"
							className="visually-hidden"
							aria-label="Import HTML or ZIP project"
							onChange={importFile}
						/>
					</div>
				</header>

				{(shareNotice || shareError || fileError) && (
					<div
						className={
							shareError || fileError ? "app-notice notice-error" : "app-notice"
						}
					>
						<p
							role={shareError || fileError ? "alert" : "status"}
							aria-live="polite"
						>
							{shareError || fileError || shareNotice}
						</p>
						{shareError && (
							<button type="button" onClick={dismissShareError}>
								Dismiss
							</button>
						)}
						{shareUrl && (
							<input
								className="share-link-field"
								aria-label="Shareable project link"
								readOnly
								value={shareUrl}
								onFocus={(event) => event.currentTarget.select()}
							/>
						)}
					</div>
				)}

				<section
					className={`editor-workspace layout-${layout}`}
					aria-label="Code editors"
					style={{
						gridTemplateColumns: paneLayout.gridTemplateColumns,
						gridTemplateRows: paneLayout.gridTemplateRows,
					}}
				>
					{[
						{
							language: "html" as const,
							title: "HTML",
							value: code.html,
							onChange: updateHtml,
							animation: 0.6,
						},
						{
							language: "css" as const,
							title: "CSS",
							value: code.css,
							onChange: updateCss,
							animation: 0.55,
						},
						{
							language: "javascript" as const,
							title: "JS",
							value: code.javascript,
							onChange: updateJavascript,
							animation: 0.5,
						},
					].map((pane, index) => (
						<Fragment key={pane.language}>
							<Editor
								language={pane.language}
								displayName={pane.title}
								value={pane.value}
								onChange={pane.onChange}
								animationQueue={pane.animation}
								theme={theme}
								flexWeight={paneLayout.sizes[index] ?? 1}
								issue={latestPreviewIssue}
								onAISelection={openAIForSelection}
							/>
							{index < 2 && (
								<div
									className="pane-resizer"
									role="separator"
									aria-orientation={
										layout === "vertical" ||
										window.matchMedia("(max-width: 600px)").matches
											? "horizontal"
											: "vertical"
									}
									aria-label={`Resize ${pane.title} and ${index === 0 ? "CSS" : "JS"} panes`}
									aria-valuemin={20}
									aria-valuemax={80}
									aria-valuenow={Math.round(
										((paneLayout.sizes[index] ?? 1) /
											((paneLayout.sizes[index] ?? 1) +
												(paneLayout.sizes[index + 1] ?? 1))) *
											100,
									)}
									tabIndex={0}
									onPointerDown={(event) =>
										paneLayout.beginResize(index as PaneDividerIndex, event)
									}
									onPointerMove={paneLayout.moveResize}
									onPointerUp={paneLayout.endResize}
									onPointerCancel={paneLayout.endResize}
									onKeyDown={(event) => {
										const vertical =
											layout === "vertical" ||
											window.matchMedia("(max-width: 600px)").matches;
										const forward = vertical ? "ArrowDown" : "ArrowRight";
										const backward = vertical ? "ArrowUp" : "ArrowLeft";
										if (event.key === forward || event.key === backward) {
											event.preventDefault();
											paneLayout.adjustResize(
												index as PaneDividerIndex,
												event.key === forward ? 0.1 : -0.1,
											);
										}
									}}
								/>
							)}
						</Fragment>
					))}
				</section>

				<section className="preview-section" aria-label="Live preview">
					<h2>Preview</h2>
					<div className="iframe-container">
						<iframe
							ref={iframeRef}
							srcDoc={previewDocument}
							title="Live code preview"
							sandbox="allow-scripts"
						/>
					</div>
				</section>
				{isAIPanelOpen && aiContext && (
					<Suspense
						fallback={
							<div className="ai-modal-loading">Loading AI assistant…</div>
						}
					>
						<AIAssistantPanel
							code={code}
							context={aiContext}
							state={aiAssist.state}
							onExplain={() =>
								aiAssist.run(
									"explain",
									aiContext.issueMessage
										? `${aiContext.issueLevel ?? "issue"}: ${aiContext.issueMessage}`
										: undefined,
									aiContext,
								)
							}
							onSuggestFix={() =>
								aiAssist.run(
									"fix",
									aiContext.issueMessage
										? `${aiContext.issueLevel ?? "issue"}: ${aiContext.issueMessage}`
										: undefined,
									aiContext,
								)
							}
							onCancel={aiAssist.cancel}
							onRetry={aiAssist.retry}
							onAccept={aiAssist.acceptSuggestion}
							onReject={aiAssist.rejectSuggestion}
							onClose={closeAIPanel}
						/>
					</Suspense>
				)}
				<ConsolePanel entries={entries} onClear={clearEntries} />
			</main>
		</ImagePreloader>
	);
}

export default App;
