import {
	Fragment,
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent,
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
import type { EditorCode, EditorLanguage, ConsoleEntry } from "../types/editor";
import type { AISelectionContext } from "../types/ai";

const AIAssistantPanel = lazy(() => import("./AIAssistantPanel"));
type LayoutDirection = "horizontal" | "vertical";
type PreviewWidth = "375px" | "768px" | "100%";

function Icon({
	name,
	className = "h-4 w-4",
}: {
	name: string;
	className?: string;
}) {
	const paths: Record<string, React.ReactNode> = {
		code: (
			<>
				<polyline points="16 18 22 12 16 6" />
				<polyline points="8 6 2 12 8 18" />
			</>
		),
		share: (
			<>
				<circle cx="18" cy="5" r="3" />
				<circle cx="6" cy="12" r="3" />
				<circle cx="18" cy="19" r="3" />
				<path d="m8.6 13.5 6.8 4m0-11-6.8 4" />
			</>
		),
		layout: (
			<>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M12 3v18" />
			</>
		),
		sun: (
			<>
				<circle cx="12" cy="12" r="4" />
				<path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
			</>
		),
		moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
		download: (
			<>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<path d="m7 10 5 5 5-5M12 15V3" />
			</>
		),
		file: (
			<>
				<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
				<path d="M14 2v6h6" />
			</>
		),
		import: (
			<>
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<path d="m17 8-5-5-5 5m5-5v12" />
			</>
		),
		ai: (
			<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
		),
		refresh: (
			<>
				<path d="M21 12a9 9 0 0 0-15.7-6L3 8" />
				<path d="M3 3v5h5M3 12a9 9 0 0 0 15.7 6L21 16" />
				<path d="M16 16h5v5" />
			</>
		),
		phone: (
			<>
				<rect x="5" y="2" width="14" height="20" rx="2" />
				<path d="M12 18h.01" />
			</>
		),
		tablet: (
			<>
				<rect x="4" y="2" width="16" height="20" rx="2" />
				<path d="M12 18h.01" />
			</>
		),
		desktop: (
			<>
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<path d="M8 21h8m-4-4v4" />
			</>
		),
		close: <path d="m18 6-12 12M6 6l12 12" />,
		search: (
			<>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</>
		),
		chevron: <path d="m6 9 6 6 6-6" />,
	};
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{paths[name]}
		</svg>
	);
}

function App() {
	const { code, updateCode, replaceCode, saveStatus } = useEditorState();
	const { theme, setTheme } = useTheme();
	const [layout, setLayout] = useState<LayoutDirection>("horizontal");
	const paneLayout = usePaneLayout("vertical");
	const [mobileTab, setMobileTab] = useState<EditorLanguage>("html");
	const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("100%");
	const [showPreviewEmpty, setShowPreviewEmpty] = useState(false);
	const [previewRevision, setPreviewRevision] = useState(0);
	const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
	const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
	const [aiContext, setAIContext] = useState<AISelectionContext | null>(null);
	const [aiPanelWidth, setAIPanelWidth] = useState(400);
	const [toast, setToast] = useState<{
		message: string;
		error?: boolean;
	} | null>(null);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [paletteQuery, setPaletteQuery] = useState("");
	const [cursor, setCursor] = useState({
		language: "HTML",
		line: 1,
		column: 1,
	});
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const { previewDocument, entries, clearEntries } = usePreviewRunner(
		code,
		iframeRef,
	);
	const removeStaleShareHash = useCallback(() => {
		if (window.location.hash.startsWith("#code="))
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}${window.location.search}`,
			);
	}, []);
	const showToast = useCallback(
		(message: string, error = false) => setToast({ message, error }),
		[],
	);
	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 2600);
		return () => window.clearTimeout(timer);
	}, [toast]);
	const handleImport = useCallback(
		(importedCode: EditorCode) => {
			replaceCode(importedCode);
			removeStaleShareHash();
			showToast("Project imported.");
		},
		[removeStaleShareHash, replaceCode, showToast],
	);
	const handleAIApply = useCallback(
		(suggestion: EditorCode) => {
			replaceCode(suggestion);
			removeStaleShareHash();
			showToast("Suggested fix applied.");
		},
		[removeStaleShareHash, replaceCode, showToast],
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
				showToast("Project restored from share link.");
			})
			.catch((error: unknown) => {
				if (active)
					showToast(
						error instanceof Error
							? error.message
							: "This share link could not be opened.",
						true,
					);
			});
		return () => {
			active = false;
		};
	}, [replaceCode, showToast]);
	const updatePane = useCallback(
		(language: EditorLanguage, value: string) => {
			updateCode(language, value);
			removeStaleShareHash();
		},
		[removeStaleShareHash, updateCode],
	);
	const handleShare = useCallback(async () => {
		try {
			const nextShareUrl = await encodeShareLink(code);
			window.history.replaceState(null, "", nextShareUrl);
			await navigator.clipboard.writeText(nextShareUrl);
			showToast("Share link copied to clipboard.");
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Could not create or copy the share link.",
				true,
			);
		}
	}, [code, showToast]);
	const latestIssue = useMemo(
		() =>
			[...entries]
				.reverse()
				.find((entry) => entry.level === "warn" || entry.level === "error"),
		[entries],
	);
	const openAIForSelection = useCallback(
		(context: AISelectionContext) => {
			cancelAIAssist();
			setAIContext(context);
			setIsAIPanelOpen(true);
		},
		[cancelAIAssist],
	);
	const openAIForIssue = useCallback(
		(entry?: ConsoleEntry) => {
			const issue = entry ?? latestIssue;
			openAIForSelection({
				language: "javascript",
				selectedCode: "",
				...(issue
					? {
							issueLevel: issue.level as "warn" | "error",
							issueMessage: issue.message,
						}
					: {}),
			});
		},
		[latestIssue, openAIForSelection],
	);
	const closeAIPanel = useCallback(() => {
		cancelAIAssist();
		setIsAIPanelOpen(false);
		setAIContext(null);
	}, [cancelAIAssist]);
	const openAIAssistant = useCallback(() => {
		if (!aiContext) openAIForIssue();
		else setIsAIPanelOpen(true);
	}, [aiContext, openAIForIssue]);
	const handleCursorChange = useCallback(
		(language: EditorLanguage, line: number, column: number) => {
			setCursor({
				language:
					language === "javascript" ? "JavaScript" : language.toUpperCase(),
				line,
				column,
			});
		},
		[],
	);
	const resizeAIRef = useRef(false);
	const startResizeAI = useCallback((event: PointerEvent<HTMLDivElement>) => {
		resizeAIRef.current = true;
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	}, []);
	const moveResizeAI = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (!resizeAIRef.current) return;
		setAIPanelWidth(
			Math.min(
				window.innerWidth - 24,
				Math.max(320, window.innerWidth - event.clientX),
			),
		);
	}, []);
	const stopResizeAI = useCallback(() => {
		resizeAIRef.current = false;
	}, []);
	const runCommand = useCallback(
		(command: string) => {
			setPaletteOpen(false);
			setPaletteQuery("");
			if (command === "theme") setTheme(theme === "dark" ? "light" : "dark");
			if (command === "layout")
				setLayout((current) =>
					current === "horizontal" ? "vertical" : "horizontal",
				);
			if (command === "share") void handleShare();
			if (command === "download") downloadHtml();
			if (command === "ai") openAIAssistant();
			if (command === "clear") clearEntries();
		},
		[clearEntries, downloadHtml, handleShare, openAIAssistant, setTheme, theme],
	);
	useEffect(() => {
		const handleShortcut = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setPaletteOpen(true);
			}
			if (event.key === "Escape") {
				setPaletteOpen(false);
				setDownloadMenuOpen(false);
				if (isAIPanelOpen) closeAIPanel();
			}
		};
		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, [closeAIPanel, isAIPanelOpen]);
	const panes = [
		{ language: "html" as const, label: "index.html", value: code.html },
		{ language: "css" as const, label: "styles.css", value: code.css },
		{
			language: "javascript" as const,
			label: "script.js",
			value: code.javascript,
		},
	];
	const commands = [
		{ key: "theme", label: "Toggle Dark / Light Theme", shortcut: "T" },
		{ key: "layout", label: "Change Workspace Layout", shortcut: "L" },
		{ key: "share", label: "Share Project Link" },
		{ key: "download", label: "Download HTML" },
		{ key: "ai", label: "Open AI Assistant" },
		{ key: "clear", label: "Clear Console" },
	].filter((item) =>
		item.label.toLowerCase().includes(paletteQuery.toLowerCase()),
	);

	return (
		<div
			id="app-shell"
			className="min-h-[1024px] flex flex-col bg-light-surface dark:bg-dark-surface"
		>
			<header className="h-12 shrink-0 px-gutter-md flex items-center justify-between gap-gutter-md border-b border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low">
				<div className="flex min-w-0 items-center gap-gutter-md">
					<div className="flex shrink-0 items-center gap-gutter-sm">
						<div className="h-7 w-7 rounded flex items-center justify-center border border-light-outline dark:border-dark-outline bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-primary dark:text-dark-on-primary-container">
							<Icon name="code" />
						</div>
						<span className="font-title text-title-md tracking-tight">
							CodePro
						</span>
					</div>
					<span
						className="h-4 w-px shrink-0 bg-light-outline-variant dark:bg-dark-outline-variant"
						aria-hidden="true"
					/>
					<span className="hidden truncate font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant sm:inline">
						Loader Example
					</span>
					<div
						className="hidden shrink-0 items-center gap-1.5 rounded border border-light-outline dark:border-dark-outline bg-light-surface-container dark:bg-dark-surface-container px-gutter-sm py-gutter-xs sm:inline-flex"
						role="status"
						aria-live="polite"
						aria-label={`Save status: ${saveStatus}`}
					>
						<span
							className={`h-2 w-2 shrink-0 rounded-full ${saveStatus === "saved" ? "bg-success" : saveStatus === "saving" ? "bg-warning" : "bg-error"}`}
						/>
						<span className="font-label text-label-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
							{saveStatus === "saving"
								? "Saving…"
								: saveStatus === "failed"
									? "Failed"
									: "Saved"}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-gutter-sm">
					<div className="flex items-center gap-gutter-xs">
						<button
							type="button"
							title="Share project link"
							aria-label="Share project link"
							className="inline-flex h-8 w-8 items-center justify-center rounded border border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
							onClick={() => void handleShare()}
						>
							<Icon name="share" />
						</button>
						<button
							type="button"
							title="Toggle split / stacked layout"
							aria-label="Toggle layout"
							className="inline-flex h-8 w-8 items-center justify-center rounded border border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
							onClick={() =>
								setLayout((current) =>
									current === "horizontal" ? "vertical" : "horizontal",
								)
							}
						>
							<Icon name="layout" />
						</button>
						<button
							type="button"
							title="Switch dark / light theme"
							aria-label="Toggle theme"
							className="inline-flex h-8 w-8 items-center justify-center rounded border border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
							onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
						>
							<Icon name={theme === "dark" ? "sun" : "moon"} />
						</button>
						<div className="relative">
							<button
								type="button"
								title="Download HTML or ZIP"
								aria-label="Download options"
								aria-haspopup="true"
								aria-expanded={downloadMenuOpen}
								aria-controls="menu-download"
								className="inline-flex h-8 items-center gap-gutter-xs rounded border border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low px-gutter-sm text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
								onClick={() => setDownloadMenuOpen((open) => !open)}
							>
								<Icon name="download" />
								<Icon name="chevron" className="h-3.5 w-3.5" />
							</button>
							{downloadMenuOpen && (
								<ul
									id="menu-download"
									role="menu"
									className="absolute right-0 z-40 mt-gutter-xs w-44 rounded-md border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container dark:bg-dark-surface-container py-gutter-xs shadow-lg"
								>
									<li>
										<button
											role="menuitem"
											type="button"
											className="flex w-full items-center gap-gutter-sm px-gutter-md py-gutter-sm text-left hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
											onClick={() => {
												downloadHtml();
												setDownloadMenuOpen(false);
											}}
										>
											<Icon name="file" />
											Download HTML
										</button>
									</li>
									<li>
										<button
											role="menuitem"
											type="button"
											className="flex w-full items-center gap-gutter-sm px-gutter-md py-gutter-sm text-left hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
											onClick={() => {
												void downloadZip();
												setDownloadMenuOpen(false);
											}}
										>
											<Icon name="file" />
											Download ZIP
										</button>
									</li>
								</ul>
							)}
						</div>
						<button
							type="button"
							title="Import file"
							aria-label="Import file"
							className="inline-flex h-8 w-8 items-center justify-center rounded border border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
							onClick={() => fileInputRef.current?.click()}
						>
							<Icon name="import" />
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".html,.htm,.zip"
							className="sr-only"
							aria-label="Import HTML or ZIP project"
							onChange={importFile}
						/>
					</div>
					<span
						className="h-5 w-px bg-light-outline dark:bg-dark-outline"
						aria-hidden="true"
					/>
					<button
						type="button"
						aria-expanded={isAIPanelOpen}
						aria-controls="ai-assistant-panel"
						className="inline-flex h-8 items-center gap-gutter-sm rounded bg-light-primary px-gutter-md text-light-on-primary hover:opacity-90 dark:bg-dark-primary dark:text-dark-on-primary"
						onClick={openAIAssistant}
					>
						<Icon name="ai" className="h-3.5 w-3.5" />
						<span className="font-label text-label-lg">AI Assistant</span>
					</button>
				</div>
			</header>

			<main
				id="workspace-grid"
				className={`flex-1 min-h-0 overflow-hidden grid grid-cols-1 ${layout === "horizontal" ? "lg:grid-cols-12" : "layout-stacked lg:grid-cols-1"}`}
			>
				<section
					aria-label="Code editors"
					className={`flex min-h-0 flex-col border-b border-light-outline bg-light-surface-container-low dark:border-dark-outline dark:bg-dark-surface-container-low ${layout === "horizontal" ? "lg:col-span-6 lg:border-b-0 lg:border-r" : "lg:col-span-1 lg:border-b lg:border-r-0"}`}
				>
					<div
						role="tablist"
						aria-label="Editor files"
						className="flex shrink-0 items-center gap-gutter-xs border-b border-light-outline bg-light-surface-container px-gutter-sm dark:border-dark-outline dark:bg-dark-surface-container lg:hidden"
					>
						{panes.map((pane) => (
							<button
								key={pane.language}
								type="button"
								role="tab"
								aria-selected={mobileTab === pane.language}
								className={`inline-flex items-center gap-1.5 border-b-2 px-gutter-md py-gutter-sm font-label text-label-md ${mobileTab === pane.language ? "border-light-primary text-light-on-surface dark:border-dark-primary dark:text-dark-on-surface" : "border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant"}`}
								onClick={() => setMobileTab(pane.language)}
							>
								{pane.label}
							</button>
						))}
					</div>
					<div
						className="editor-stack grid flex-1 min-h-0"
						style={{ gridTemplateRows: paneLayout.gridTemplateRows }}
					>
						{panes.map((pane, index) => (
							<Fragment key={pane.language}>
								<Editor
									language={pane.language}
									value={pane.value}
									onChange={(value) => updatePane(pane.language, value)}
									theme={theme}
									issue={
										latestIssue
											? {
													issueLevel: latestIssue.level as "warn" | "error",
													issueMessage: latestIssue.message,
												}
											: undefined
									}
									onAISelection={openAIForSelection}
									onCursorChange={handleCursorChange}
									activeOnMobile={mobileTab === pane.language}
								/>
								{index < 2 && (
									<div
										role="separator"
										aria-orientation="horizontal"
										aria-label={`Resize ${pane.label} and ${panes[index + 1]?.label} panes`}
										aria-valuemin={20}
										aria-valuemax={80}
										aria-valuenow={50}
										tabIndex={0}
										className="group hidden h-1.5 shrink-0 cursor-row-resize items-center justify-center bg-light-outline transition-colors hover:bg-light-primary focus-visible:bg-light-primary dark:bg-dark-outline dark:hover:bg-dark-primary lg:flex"
										onPointerDown={(event) =>
											paneLayout.beginResize(index as PaneDividerIndex, event)
										}
										onPointerMove={paneLayout.moveResize}
										onPointerUp={paneLayout.endResize}
										onPointerCancel={paneLayout.endResize}
										onKeyDown={(event) => {
											if (
												event.key === "ArrowUp" ||
												event.key === "ArrowDown"
											) {
												event.preventDefault();
												paneLayout.adjustResize(
													index as PaneDividerIndex,
													event.key === "ArrowDown" ? 0.1 : -0.1,
												);
											}
										}}
									>
										<span className="h-0.5 w-8 rounded-full bg-light-outline-variant group-hover:bg-white dark:bg-dark-outline-variant" />
									</div>
								)}
							</Fragment>
						))}
					</div>
				</section>

				<section
					aria-label="Preview and console"
					className={`flex min-h-0 flex-col bg-light-surface dark:bg-dark-surface ${layout === "horizontal" ? "lg:col-span-6" : "lg:col-span-1"}`}
				>
					<div className="h-8 shrink-0 border-b border-light-outline bg-light-surface-container px-gutter-md dark:border-dark-outline dark:bg-dark-surface-container flex items-center justify-between">
						<div className="flex items-center gap-gutter-sm">
							<span className="font-label text-label-md">Preview</span>
							<button
								type="button"
								className="rounded border border-light-outline px-gutter-xs py-0.5 font-label text-label-sm text-light-on-surface-variant hover:text-light-on-surface dark:border-dark-outline dark:text-dark-on-surface-variant dark:hover:text-dark-on-surface"
								onClick={() => setShowPreviewEmpty((empty) => !empty)}
							>
								{showPreviewEmpty ? "Live preview" : "Empty state"}
							</button>
						</div>
						<div className="flex items-center gap-gutter-sm">
							<div
								role="group"
								aria-label="Preview viewport size"
								className="inline-flex items-center rounded border border-light-outline bg-light-surface-container-low p-0.5 dark:border-dark-outline dark:bg-dark-surface-container-low"
							>
								{(["375px", "768px", "100%"] as PreviewWidth[]).map((size) => (
									<button
										key={size}
										type="button"
										aria-label={`${size === "100%" ? "Desktop" : size === "375px" ? "Mobile" : "Tablet"} viewport`}
										title={`${size === "100%" ? "Desktop" : size === "375px" ? "Mobile" : "Tablet"} viewport (${size})`}
										className={`rounded-sm p-1 ${previewWidth === size ? "bg-light-surface-container-high text-light-on-surface dark:bg-dark-surface-container-high dark:text-dark-on-surface" : "text-light-on-surface-variant dark:text-dark-on-surface-variant"}`}
										onClick={() => setPreviewWidth(size)}
									>
										<Icon
											name={
												size === "375px"
													? "phone"
													: size === "768px"
														? "tablet"
														: "desktop"
											}
											className="h-3.5 w-3.5"
										/>
									</button>
								))}
							</div>
							<button
								type="button"
								title="Refresh preview"
								aria-label="Refresh preview"
								className="rounded p-1 text-light-on-surface-variant hover:bg-light-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
								onClick={() => setPreviewRevision((revision) => revision + 1)}
							>
								<Icon name="refresh" className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					<div className="flex flex-1 min-h-[260px] items-center justify-center overflow-auto bg-light-surface p-gutter-md dark:bg-dark-surface">
						<div
							className="flex h-full min-h-[220px] w-full flex-col items-center justify-center rounded-md border border-light-outline bg-light-surface-container-low p-gutter-xl text-center transition-opacity dark:border-dark-outline dark:bg-dark-surface-container-low"
							style={{ maxWidth: previewWidth }}
						>
							{showPreviewEmpty ? (
								<div className="flex flex-col items-center gap-gutter-sm">
									<div className="flex h-10 w-10 items-center justify-center rounded-md border border-light-outline bg-light-surface-container text-light-on-surface-variant dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-on-surface-variant">
										<svg
											className="h-5 w-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.75"
											aria-hidden="true"
										>
											<rect width="18" height="18" x="3" y="3" rx="2" />
											<path d="M3 9h18M9 21V9" />
										</svg>
									</div>
									<p className="font-body text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
										Add HTML markup to see a live preview here.
									</p>
								</div>
							) : (
								<iframe
									key={previewRevision}
									ref={iframeRef}
									srcDoc={previewDocument}
									title="Live code preview"
									sandbox="allow-scripts"
									className="h-full min-h-[220px] w-full border-0 bg-white"
								/>
							)}
						</div>
					</div>
					<ConsolePanel
						entries={entries}
						onClear={clearEntries}
						onExplain={openAIForIssue}
					/>
				</section>
			</main>

			<footer className="flex h-6 shrink-0 items-center justify-between border-t border-light-outline bg-light-surface-container px-gutter-md text-light-on-surface-variant dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-on-surface-variant select-none">
				<div className="flex items-center gap-gutter-md font-label text-label-sm tabular-nums">
					<span>
						Ln {cursor.line}, Col {cursor.column}
					</span>
					<span>{cursor.language}</span>
					<span className="hidden sm:inline">2 spaces</span>
					<span className="hidden md:inline">
						{layout === "horizontal" ? "Split" : "Stacked"}
					</span>
					<span className="inline-flex items-center gap-1">
						<span
							className={`h-1.5 w-1.5 rounded-full ${saveStatus === "saved" ? "bg-success" : saveStatus === "saving" ? "bg-warning" : "bg-error"}`}
						/>
						{saveStatus === "saving"
							? "Saving…"
							: saveStatus === "failed"
								? "Failed"
								: "Saved"}
					</span>
				</div>
				<button
					type="button"
					className="inline-flex items-center gap-1 rounded px-1 font-label text-label-sm hover:text-light-on-surface dark:hover:text-dark-on-surface"
					onClick={() => setPaletteOpen(true)}
				>
					<kbd className="font-code text-[11px]">⌘K</kbd>
					<span>Commands</span>
				</button>
			</footer>

			{isAIPanelOpen && aiContext && (
				<Suspense
					fallback={
						<aside className="fixed bottom-6 right-0 top-12 z-30 w-[400px] max-w-full border-l border-light-outline-variant bg-light-surface-container-low p-gutter-lg shadow-2xl dark:border-dark-outline-variant dark:bg-dark-surface-container-low">
							Loading AI assistant…
						</aside>
					}
				>
					<AIAssistantPanel
						code={code}
						context={aiContext}
						width={aiPanelWidth}
						onResizeStart={startResizeAI}
						onResizeMove={moveResizeAI}
						onResizeEnd={stopResizeAI}
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

			{paletteOpen && (
				<div
					className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-gutter-lg pt-20"
					role="dialog"
					aria-modal="true"
					aria-label="Command palette"
					onClick={() => setPaletteOpen(false)}
				>
					<div
						className="w-full max-w-md overflow-hidden rounded-md border border-light-outline-variant bg-light-surface-container shadow-2xl dark:border-dark-outline-variant dark:bg-dark-surface-container"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="flex items-center gap-gutter-sm border-b border-light-outline px-gutter-md py-gutter-sm dark:border-dark-outline">
							<Icon
								name="search"
								className="h-4 w-4 text-light-on-surface-variant dark:text-dark-on-surface-variant"
							/>
							<input
								autoFocus
								type="text"
								placeholder="Type a command…"
								className="w-full border-0 bg-transparent p-0 font-body text-body-md focus:ring-0"
								value={paletteQuery}
								onChange={(event) => setPaletteQuery(event.target.value)}
							/>
							<kbd className="font-code text-[11px]">ESC</kbd>
						</div>
						<ul className="max-h-64 divide-y divide-light-outline/40 overflow-auto py-gutter-xs font-body text-body-md dark:divide-dark-outline/40">
							{commands.map((item) => (
								<li key={item.key}>
									<button
										type="button"
										className="cmd-item flex w-full items-center justify-between px-gutter-md py-gutter-sm text-left hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
										onClick={() => runCommand(item.key)}
									>
										<span>{item.label}</span>
										{item.shortcut && (
											<kbd className="font-code text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
												{item.shortcut}
											</kbd>
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{(toast || fileError) && (
				<div
					className="fixed bottom-9 right-gutter-lg z-50 flex max-w-[min(28rem,calc(100vw-2rem))] items-center gap-gutter-sm rounded-md border border-light-outline-variant bg-light-surface-container px-gutter-md py-gutter-sm text-light-on-surface shadow-lg dark:border-dark-outline-variant dark:bg-dark-surface-container dark:text-dark-on-surface"
					role={toast?.error || fileError ? "alert" : "status"}
					aria-live="polite"
				>
					<span
						className={`h-2 w-2 shrink-0 rounded-full ${toast?.error || fileError ? "bg-error" : "bg-success"}`}
					/>
					<span className="font-body text-body-md">
						{toast?.message ?? fileError}
					</span>
				</div>
			)}
		</div>
	);
}

export default App;
