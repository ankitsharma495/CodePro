import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EXTENSION_MAP, INITIAL_CONTENT_MAP } from "../constants";
import type { EditorLanguage } from "../types/editor";
import type { Theme } from "../hooks/useTheme";
import type { AISelectionContext } from "../types/ai";

const LANGUAGE_EXTENSIONS = {
	javascript: [javascript({ jsx: true })],
	html: [html()],
	css: [css()],
};

interface EditorProps {
	language: EditorLanguage;
	value: string;
	onChange: (value: string) => void;
	theme: Theme;
	issue?: Pick<AISelectionContext, "issueLevel" | "issueMessage">;
	onAISelection: (context: AISelectionContext) => void;
	onCursorChange?: (
		language: EditorLanguage,
		line: number,
		column: number,
	) => void;
	activeOnMobile: boolean;
}

const PANE_NAMES: Record<EditorLanguage, string> = {
	html: "index.html",
	css: "styles.css",
	javascript: "script.js",
};

function PaneGlyph({ language }: { language: EditorLanguage }) {
	if (language === "css") {
		return (
			<svg
				className="h-3.5 w-3.5 text-light-on-surface-variant dark:text-dark-on-surface-variant"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				aria-hidden="true"
			>
				<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.65-.75 1.65-1.7 0-.43-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C22 6 17.5 2 12 2Z" />
			</svg>
		);
	}
	if (language === "javascript") {
		return (
			<svg
				className="h-3.5 w-3.5 text-warning"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.75"
				aria-hidden="true"
			>
				<path d="m13 2-3 9h7L9 22l2-9H5l8-11Z" />
			</svg>
		);
	}
	return (
		<svg
			className="h-3.5 w-3.5 text-light-primary dark:text-dark-on-primary-container"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	);
}

function Editor(props: EditorProps) {
	const {
		language,
		value,
		onChange,
		theme,
		issue,
		onAISelection,
		onCursorChange,
		activeOnMobile,
	} = props;
	const containerRef = useRef<HTMLElement | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [selection, setSelection] = useState<{
		code: string;
		top: number;
		left: number;
	} | null>(null);
	const downloadUrl = useMemo(
		() =>
			URL.createObjectURL(
				new Blob([value], { type: `text/${EXTENSION_MAP[language]}` }),
			),
		[value, language],
	);
	useEffect(() => () => URL.revokeObjectURL(downloadUrl), [downloadUrl]);

	const editorTheme = useMemo(() => {
		const dark = theme === "dark";
		const highlight = HighlightStyle.define([
			{ tag: tags.tagName, color: dark ? "#F87171" : "#B91C1C" },
			{ tag: tags.attributeName, color: dark ? "#FBBF24" : "#9A3412" },
			{ tag: tags.string, color: dark ? "#4ADE80" : "#15803D" },
			{ tag: tags.keyword, color: dark ? "#C084FC" : "#6D28D9" },
			{ tag: tags.propertyName, color: dark ? "#38BDF8" : "#0369A1" },
			{ tag: tags.number, color: dark ? "#FDBA74" : "#B45309" },
			{
				tag: tags.comment,
				color: dark ? "#8E97AB" : "#6B7280",
				fontStyle: "italic",
			},
		]);
		return [
			EditorView.theme(
				{
					"&": {
						height: "100%",
						color: dark ? "#E6E8EE" : "#14171D",
						backgroundColor: dark ? "#14171D" : "#FFFFFF",
					},
					".cm-scroller": {
						overflow: "auto",
						fontFamily: '"JetBrains Mono", monospace',
						fontSize: "13px",
						lineHeight: "20px",
					},
					".cm-gutters": {
						backgroundColor: dark ? "#14171D" : "#F9FAFB",
						color: dark ? "#565E70" : "#8B93A4",
						border: "none",
					},
					".cm-activeLine": { backgroundColor: dark ? "#1B1F27" : "#F1F4F9" },
					".cm-activeLineGutter": { color: dark ? "#E6E8EE" : "#14171D" },
					".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
						backgroundColor: dark
							? "rgba(79,70,229,.28)"
							: "rgba(79,70,229,.16)",
					},
					".cm-content": { caretColor: dark ? "#E6E8EE" : "#14171D" },
					".cm-cursor, .cm-dropCursor": {
						borderLeftColor: dark ? "#E6E8EE" : "#14171D",
					},
				},
				{ dark },
			),
			syntaxHighlighting(highlight),
		];
	}, [theme]);

	const handleUpdate = useCallback(
		({ view }: ViewUpdate) => {
			const cursor = view.state.selection.main.head;
			const line = view.state.doc.lineAt(cursor);
			onCursorChange?.(language, line.number, cursor - line.from + 1);
			const selected = view.state.selection.main;
			if (selected.empty) {
				setSelection(null);
				return;
			}
			const text = view.state.sliceDoc(selected.from, selected.to).trim();
			const point = view.coordsAtPos(selected.head);
			const bounds = containerRef.current?.getBoundingClientRect();
			if (!text || !point || !bounds) {
				setSelection(null);
				return;
			}
			setSelection({
				code: text,
				top: Math.max(
					34,
					Math.min(point.bottom - bounds.top + 4, bounds.height - 34),
				),
				left: Math.max(
					8,
					Math.min(point.left - bounds.left, bounds.width - 88),
				),
			});
		},
		[language, onCursorChange],
	);

	const reset = () => {
		onChange(INITIAL_CONTENT_MAP[language]);
		setMenuOpen(false);
	};
	const clear = () => {
		onChange("");
		setMenuOpen(false);
	};

	return (
		<article
			ref={containerRef}
			className={`editor-pane ${activeOnMobile ? "flex" : "hidden"} lg:flex flex-1 flex-col min-h-0 relative`}
		>
			<div className="h-8 shrink-0 px-gutter-md flex items-center justify-between border-b border-light-outline dark:border-dark-outline bg-light-surface-container dark:bg-dark-surface-container">
				<div className="flex items-center gap-gutter-sm min-w-0">
					<PaneGlyph language={language} />
					<span className="font-label text-label-md truncate">
						{PANE_NAMES[language]}
					</span>
				</div>
				<div className="flex items-center gap-gutter-xs">
					<div
						className="relative"
						onMouseEnter={() => setMenuOpen(true)}
						onMouseLeave={() => setMenuOpen(false)}
					>
						<button
							type="button"
							title={`Reset ${PANE_NAMES[language]}`}
							aria-label={`Reset ${PANE_NAMES[language]}`}
							className="pane-reset-btn p-1 rounded text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-primary dark:focus-visible:ring-dark-primary transition-colors duration-state-change"
							onClick={reset}
							onFocus={() => setMenuOpen(true)}
						>
							<svg
								className="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
								<path d="M3 3v5h5" />
							</svg>
						</button>
						{menuOpen && (
							<div className="absolute right-0 top-full z-40 mt-1 w-36 rounded-md border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container dark:bg-dark-surface-container py-1 shadow-lg">
								<button
									type="button"
									className="w-full px-3 py-2 text-left text-body-md hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
									onClick={reset}
								>
									Reset Editor
								</button>
								<button
									type="button"
									className="w-full px-3 py-2 text-left text-body-md hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
									onClick={clear}
								>
									Clear Editor
								</button>
							</div>
						)}
					</div>
					<a
						download={PANE_NAMES[language]}
						href={downloadUrl}
						title={`Download ${PANE_NAMES[language]}`}
						aria-label={`Download ${PANE_NAMES[language]}`}
						className="pane-dl-btn p-1 rounded text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-primary dark:focus-visible:ring-dark-primary transition-colors duration-state-change"
					>
						<svg
							className="h-3.5 w-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.75"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
					</a>
				</div>
			</div>
			<div className="flex-1 min-h-0 overflow-hidden cm-surface">
				<CodeMirror
					value={value}
					height="100%"
					className="h-full editor-scroll font-code text-code-md"
					extensions={LANGUAGE_EXTENSIONS[language]}
					theme={editorTheme}
					onChange={onChange}
					onUpdate={handleUpdate}
				/>
			</div>
			{selection && (
				<button
					type="button"
					className="absolute z-20 px-gutter-sm py-1 rounded bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary shadow-lg font-label text-label-sm"
					style={{ top: selection.top, left: selection.left }}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() =>
						onAISelection({
							language,
							selectedCode: selection.code,
							...(issue ?? {}),
						})
					}
				>
					Ask AI
				</button>
			)}
		</article>
	);
}

export default memo(Editor);
