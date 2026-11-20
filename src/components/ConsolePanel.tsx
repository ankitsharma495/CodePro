import { useMemo, useState } from "react";
import type { ConsoleEntry } from "../types/editor";

type LevelFilter = "all" | "error" | "warn";
type ConsoleTab = "console" | "problems";

interface ConsolePanelProps {
	entries: ConsoleEntry[];
	onClear: () => void;
	onExplain: (entry: ConsoleEntry) => void;
}

export default function ConsolePanel({
	entries,
	onClear,
	onExplain,
}: ConsolePanelProps) {
	const [filter, setFilter] = useState<LevelFilter>("all");
	const [tab, setTab] = useState<ConsoleTab>("console");
	const [collapsed, setCollapsed] = useState(false);
	const problemEntries = useMemo(
		() =>
			entries.filter(
				(entry) => entry.level === "warn" || entry.level === "error",
			),
		[entries],
	);
	const visibleEntries = entries.filter(
		(entry) => filter === "all" || entry.level === filter,
	);
	const toggleTab = (next: ConsoleTab) => setTab(next);
	const renderEntry = (entry: ConsoleEntry) => (
		<div
			className={`console-row flex items-center justify-between gap-gutter-sm px-gutter-md py-1.5 font-code text-code-sm ${entry.level === "error" ? "bg-error/10" : entry.level === "warn" ? "bg-warning/10" : ""}`}
			key={entry.id}
		>
			<div className="flex min-w-0 items-center gap-gutter-sm">
				{entry.level === "error" || entry.level === "warn" ? (
					<span
						className={`shrink-0 rounded-sm px-1.5 py-0.5 font-label text-label-sm ${entry.level === "error" ? "bg-error text-on-error" : "bg-warning text-on-warning"}`}
					>
						{entry.level === "error" ? "ERR" : "WARN"}
					</span>
				) : (
					<span className="w-8 shrink-0 text-light-on-surface-variant dark:text-dark-on-surface-variant">
						&gt;
					</span>
				)}
				<span className="truncate text-light-on-surface dark:text-dark-on-surface">
					{entry.message}
				</span>
			</div>
			<div className="flex shrink-0 items-center gap-gutter-sm">
				<time
					className="text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums"
					dateTime={new Date(entry.timestamp).toISOString()}
				>
					{new Date(entry.timestamp).toLocaleTimeString()}
				</time>
				{(entry.level === "error" || entry.level === "warn") && (
					<button
						type="button"
						className="rounded border border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low px-gutter-sm py-0.5 font-label text-label-sm hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
						onClick={() => onExplain(entry)}
					>
						Explain with AI
					</button>
				)}
			</div>
		</div>
	);

	return (
		<div
			className="shrink-0 border-t border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container-low flex flex-col"
			aria-label="Console and problems"
		>
			<div className="h-9 shrink-0 px-gutter-md flex items-center justify-between border-b border-light-outline dark:border-dark-outline bg-light-surface-container dark:bg-dark-surface-container">
				<div
					role="tablist"
					aria-label="Console and problems"
					className="flex h-full items-center gap-gutter-md"
				>
					<button
						type="button"
						role="tab"
						aria-selected={tab === "console"}
						className={`h-full inline-flex items-center gap-gutter-xs border-b-2 ${tab === "console" ? "border-light-primary dark:border-dark-primary text-light-on-surface dark:text-dark-on-surface" : "border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant"}`}
						onClick={() => toggleTab("console")}
					>
						<span className="font-label text-label-md">Console</span>
						<span className="rounded-full bg-error px-1.5 py-0.5 font-label text-label-sm tabular-nums text-on-error">
							{entries.filter((entry) => entry.level === "error").length}
						</span>
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={tab === "problems"}
						className={`h-full inline-flex items-center gap-gutter-xs border-b-2 ${tab === "problems" ? "border-light-primary dark:border-dark-primary text-light-on-surface dark:text-dark-on-surface" : "border-transparent text-light-on-surface-variant dark:text-dark-on-surface-variant"}`}
						onClick={() => toggleTab("problems")}
					>
						<span className="font-label text-label-md">Problems</span>
						<span className="rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high px-1.5 py-0.5 font-label text-label-sm tabular-nums text-light-on-surface-variant dark:text-dark-on-surface-variant">
							{problemEntries.length}
						</span>
					</button>
				</div>
				<div className="flex items-center gap-gutter-xs">
					{tab === "console" && (
						<div
							className="hidden sm:inline-flex items-center gap-gutter-xs mr-gutter-xs"
							role="group"
							aria-label="Filter console messages"
						>
							{(["all", "error", "warn"] as LevelFilter[]).map((level) => (
								<button
									key={level}
									type="button"
									aria-pressed={filter === level}
									className={`rounded px-gutter-sm py-0.5 font-label text-label-sm ${filter === level ? "bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface" : "text-light-on-surface-variant dark:text-dark-on-surface-variant"}`}
									onClick={() => setFilter(level)}
								>
									{level === "all"
										? "All"
										: level === "error"
											? "Errors"
											: "Warnings"}
								</button>
							))}
						</div>
					)}
					<button
						type="button"
						className="rounded px-gutter-sm py-0.5 font-label text-label-sm text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
						onClick={onClear}
					>
						Clear
					</button>
					<button
						type="button"
						aria-label={collapsed ? "Expand console" : "Collapse console"}
						aria-expanded={!collapsed}
						className="rounded p-1 text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high dark:hover:bg-dark-surface-container-high"
						onClick={() => setCollapsed((value) => !value)}
					>
						<svg
							className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.75"
							aria-hidden="true"
						>
							<path d="m6 9 6 6 6-6" />
						</svg>
					</button>
				</div>
			</div>
			{!collapsed && (
				<div
					className="h-32 overflow-auto editor-scroll divide-y divide-light-outline dark:divide-dark-outline"
					role="log"
					aria-live="polite"
					aria-relevant="additions text"
				>
					{tab === "console"
						? visibleEntries.map(renderEntry)
						: problemEntries.map(renderEntry)}
					{(tab === "console" ? visibleEntries : problemEntries).length ===
						0 && (
						<div className="px-gutter-md py-gutter-sm text-body-md text-light-on-surface-variant dark:text-dark-on-surface-variant">
							No {tab === "console" ? "console messages" : "problems"}.
						</div>
					)}
				</div>
			)}
		</div>
	);
}
