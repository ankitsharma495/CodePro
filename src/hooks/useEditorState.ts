import { useCallback, useState } from "react";
import useAutosave from "./useAutosave";
import {
	initialCssContent,
	initialHtmlContent,
	initialJsContent,
} from "../constants";
import type { EditorCode, EditorLanguage } from "../types/editor";

const STORAGE_KEYS = {
	html: "codepen-clone-html",
	css: "codepen-clone-css",
	javascript: "codepen-clone-js",
} as const;

const INITIAL_CODE: EditorCode = {
	html: initialHtmlContent,
	css: initialCssContent,
	javascript: initialJsContent,
};

function readCodeFromStorage(): EditorCode {
	try {
		return Object.fromEntries(
			Object.entries(STORAGE_KEYS).map(([language, key]) => {
				const saved = window.localStorage.getItem(key);
				if (!saved) return [language, INITIAL_CODE[language as EditorLanguage]];
				const parsed: unknown = JSON.parse(saved);
				return [
					language,
					typeof parsed === "string"
						? parsed
						: INITIAL_CODE[language as EditorLanguage],
				];
			}),
		) as EditorCode;
	} catch {
		return INITIAL_CODE;
	}
}

export default function useEditorState() {
	const [code, setCode] = useState<EditorCode>(readCodeFromStorage);
	const saveStatus = useAutosave(code);

	const updateCode = useCallback((language: EditorLanguage, value: string) => {
		setCode((current) => ({ ...current, [language]: value }));
	}, []);

	const replaceCode = useCallback(
		(nextCode: EditorCode) => setCode(nextCode),
		[],
	);

	return { code, updateCode, replaceCode, saveStatus };
}
