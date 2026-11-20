export type EditorLanguage = "html" | "css" | "javascript";

export type EditorCode = Record<EditorLanguage, string>;

export type SaveStatus = "saved" | "saving" | "failed";

export type ConsoleLevel = "log" | "info" | "warn" | "error";

export interface ConsoleEntry {
	id: number;
	level: ConsoleLevel;
	message: string;
	timestamp: number;
}
