// React Imports
import { memo, useCallback, useEffect, useRef, useState } from "react";
// CodeMirror & its Plugin Imports
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { xcodeDark, xcodeLight } from "@uiw/codemirror-theme-xcode";
import type { ViewUpdate } from "@codemirror/view";
// Icon Imports
import {
	ResetIcon,
	ExpandIcon,
	DownloadIcon,
	FallbackResetIcon,
	FallbackExpandIcon,
	FallbackDownloadIcon,
} from "../assets/images";
// Other Imports
import { EXTENSION_MAP, INITIAL_CONTENT_MAP } from "../constants";
import { testUserAgentForMobileDevice } from "../utilities/utilFunctions";
import type { EditorLanguage } from "../types/editor";
import type { Theme } from "../hooks/useTheme";
import type { AISelectionContext } from "../types/ai";

// Language configuration for CodeMirror component based on langauage
const LANG_CONFIG_MAP = {
	javascript: [javascript({ jsx: true })],
	html: [html({})],
	css: [css()],
};

interface EditorProps {
	language: EditorLanguage;
	displayName: string;
	value: string;
	onChange: (value: string) => void;
	animationQueue: number;
	theme: Theme;
	flexWeight: number;
	issue?: Pick<AISelectionContext, "issueLevel" | "issueMessage">;
	onAISelection: (context: AISelectionContext) => void;
}

// Each pane keeps its CodeMirror instance; memo skips updates when a sibling pane changes.
export default memo(function Editor(props: EditorProps) {
	const {
		language,
		displayName,
		value,
		onChange,
		animationQueue,
		theme,
		flexWeight,
		issue,
		onAISelection,
	} = props;

	// Create a BLOB file for making the content in the editor downloadable
	const file = new Blob([value], { type: `text/${EXTENSION_MAP[language]}` });

	const [isMobile] = useState(testUserAgentForMobileDevice);
	// state to collapse/expand editor
	const [openEditor, setOpenEditor] = useState(() => !isMobile);
	// state to show toolbar button's icons on hover or show always
	const [toolBarButtonsHover, setToolBarButtonsHover] = useState(
		() => isMobile,
	);
	// state to open/close reset dropdown
	const [showResetDropdown, setShowResetDropdown] = useState(false);
	const editorContainerRef = useRef<HTMLDivElement | null>(null);
	const [selectedCode, setSelectedCode] = useState<{
		code: string;
		top: number;
		left: number;
	} | null>(null);
	const handleEditorUpdate = useCallback(({ view }: ViewUpdate) => {
		const selection = view.state.selection.main;
		if (selection.empty) {
			setSelectedCode(null);
			return;
		}
		const text = view.state.sliceDoc(selection.from, selection.to).trim();
		const position = view.coordsAtPos(selection.head);
		const container = editorContainerRef.current;
		if (!text || !position || !container) {
			setSelectedCode(null);
			return;
		}
		const bounds = container.getBoundingClientRect();
		setSelectedCode({
			code: text,
			top: Math.max(
				0,
				Math.min(position.bottom - bounds.top + 4, bounds.height - 36),
			),
			left: Math.max(
				8,
				Math.min(position.left - bounds.left, bounds.width - 92),
			),
		});
	}, []);

	useEffect(() => {
		const handleWindowClick = (event: MouseEvent) => {
			const target = event.target;
			if (
				target instanceof Element &&
				!target.closest("#reset-button, #reset-dropdown")
			) {
				setShowResetDropdown(false);
			}
		};

		window.addEventListener("click", handleWindowClick);
		return () => window.removeEventListener("click", handleWindowClick);
	}, []);

	// Functions to manipulate the content of editor
	const handleChange = (nextValue: string) => onChange(nextValue);

	const handleResetEditor = () => onChange(INITIAL_CONTENT_MAP[language]);

	const handleClearEditor = () => onChange("");

	// Functions to show/hide toolbar buttons on hover
	const handleOnMouseEnterOnToolBarButtons = () =>
		!isMobile && setToolBarButtonsHover(true);

	const handleOnMouseExitFromToolBarButtons = () =>
		!isMobile && setToolBarButtonsHover(false);

	// Functions to show/hide dropdown on hover - Desktop devices
	const handleOnResetButtonHover = () => {
		if (!isMobile) {
			setShowResetDropdown(true);
			handleOnMouseEnterOnToolBarButtons();
		}
	};

	const handleOnResetButtonHoverExit = () => {
		if (!isMobile) {
			setShowResetDropdown(false);
			handleOnMouseExitFromToolBarButtons();
		}
	};

	// Functions to show/hide dropdown on click - Mobile devices
	const handleResetButtonClick = () => isMobile && setShowResetDropdown(true);

	const handleDropdownItemClick = (onClick: () => void) => {
		onClick();
		handleOnResetButtonHoverExit();
	};

	return (
		<div
			ref={editorContainerRef}
			style={{
				animation: `${animationQueue}s ease-out 0s 1 slideInLeft`,
				flex: `${flexWeight} 1 0%`,
			}}
			className={`editor-container ${openEditor ? "" : "collapsed"}`}
		>
			<div className="editor-toolbar">
				<div className="editor-title" title={displayName}>
					{displayName}
				</div>
				<div>
					<div className="editor-buttons-container">
						<button type="button" className="editor-button">
							<img
								id="reset-button"
								width="17px"
								height="17px"
								className="editor-icon reset-icon"
								alt="Reset icon"
								title="Reset editor"
								src={toolBarButtonsHover ? ResetIcon : FallbackResetIcon}
								onClick={handleResetButtonClick}
								onMouseEnter={handleOnResetButtonHover}
								onMouseLeave={handleOnResetButtonHoverExit}
							/>
							<div
								id="reset-dropdown"
								className={`reset-dropdown ${showResetDropdown ? "expanded" : ""}`}
								onMouseEnter={handleOnResetButtonHover}
								onMouseLeave={handleOnResetButtonHoverExit}
							>
								<div
									className="reset-dropdown-item"
									onClick={() => handleDropdownItemClick(handleResetEditor)}
								>
									Reset Editor
								</div>
								<div
									className="reset-dropdown-item"
									onClick={() => handleDropdownItemClick(handleClearEditor)}
								>
									Clear Editor
								</div>
							</div>
						</button>
						<button type="button" className="editor-button">
							{/* Wrapping img tag with anchor tag with target set to _blank to download the file on click of the icon button */}
							<a
								download={`file.${EXTENSION_MAP[language]}`}
								target="_blank"
								rel="noreferrer"
								href={URL.createObjectURL(file)}
								style={{
									textDecoration: "inherit",
									color: "inherit",
								}}
							>
								<img
									width="17px"
									height="17px"
									className="editor-icon download-icon"
									alt="Download icon"
									title={`Download ${language} file`}
									src={
										toolBarButtonsHover ? DownloadIcon : FallbackDownloadIcon
									}
									onMouseEnter={handleOnMouseEnterOnToolBarButtons}
									onMouseLeave={handleOnMouseExitFromToolBarButtons}
								/>
							</a>
						</button>
						<button
							type="button"
							className="editor-button"
							onClick={() => setOpenEditor((prevOpen) => !prevOpen)}
						>
							<img
								width="17px"
								height="17px"
								className="editor-icon expand-icon"
								alt="Expand/Minimise icon"
								title="Expand/Minimise"
								src={toolBarButtonsHover ? ExpandIcon : FallbackExpandIcon}
								onMouseEnter={handleOnMouseEnterOnToolBarButtons}
								onMouseLeave={handleOnMouseExitFromToolBarButtons}
							/>
						</button>
					</div>
				</div>
			</div>

			{/* CodeMirror Editor with its configurations */}
			<CodeMirror
				value={value}
				height="100%"
				className="code-mirror-wrapper"
				extensions={LANG_CONFIG_MAP[language]}
				theme={theme === "dark" ? xcodeDark : xcodeLight}
				onChange={handleChange}
				onUpdate={handleEditorUpdate}
			/>
			{selectedCode && (
				<button
					type="button"
					className="editor-ai-trigger"
					style={{ top: selectedCode.top, left: selectedCode.left }}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() =>
						onAISelection({
							language,
							selectedCode: selectedCode.code,
							...(issue ?? {}),
						})
					}
				>
					Ask AI
				</button>
			)}
		</div>
	);
});
