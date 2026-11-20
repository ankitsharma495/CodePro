import type { EditorCode } from "./editor";

export type AIAssistAction = "explain" | "fix";
export type AIAssistStatus =
	"idle" | "loading" | "streaming" | "success" | "error" | "empty";
export type AIAssistErrorKind =
	"network" | "rate_limit" | "bad_response" | "server";

export interface AIFixSuggestion {
	html: string;
	css: string;
	javascript: string;
	summary: string;
}

export interface AIAssistError {
	kind: AIAssistErrorKind;
	message: string;
}

export interface AIAssistState {
	status: AIAssistStatus;
	action: AIAssistAction | null;
	text: string;
	suggestion: AIFixSuggestion | null;
	error: AIAssistError | null;
}

export interface AIAssistRequest {
	action: AIAssistAction;
	code: EditorCode;
	previewError?: string;
	selectionContext?: AISelectionContext;
}

export interface AISelectionContext {
	language: keyof EditorCode;
	selectedCode: string;
	issueLevel: "warn" | "error";
	issueMessage: string;
}
