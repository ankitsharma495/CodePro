import { useState } from "react";
import type { ConsoleEntry, ConsoleLevel } from "../types/editor";

type LevelFilter = "all" | ConsoleLevel;

interface ConsolePanelProps {
	entries: ConsoleEntry[];
	onClear: () => void;
}

export default function ConsolePanel({ entries, onClear }: ConsolePanelProps) {
	const [filter, setFilter] = useState<LevelFilter>("all");
	const visibleEntries = entries.filter(
		(entry) => filter === "all" || entry.level === filter,
	);

	return (
		<section className="console-panel" aria-label="Preview console">
			<div className="console-toolbar">
				<h2>Console</h2>
				<label>
					<span className="visually-hidden">Filter console by level</span>
					<select
						value={filter}
						onChange={(event) => setFilter(event.target.value as LevelFilter)}
					>
						<option value="all">All levels</option>
						<option value="log">Log</option>
						<option value="info">Info</option>
						<option value="warn">Warning</option>
						<option value="error">Error</option>
					</select>
				</label>
				<button type="button" onClick={onClear}>
					Clear
				</button>
			</div>
			<div
				className="console-output"
				role="log"
				aria-live="polite"
				aria-relevant="additions text"
			>
				{visibleEntries.length === 0 ? (
					<p className="console-empty">No preview messages yet.</p>
				) : (
					visibleEntries.map((entry) => (
						<div
							className={`console-entry level-${entry.level}`}
							key={entry.id}
						>
							<time dateTime={new Date(entry.timestamp).toISOString()}>
								{new Date(entry.timestamp).toLocaleTimeString()}
							</time>
							<span className="console-level">{entry.level}</span>
							<pre>{entry.message}</pre>
						</div>
					))
				)}
			</div>
		</section>
	);
}
