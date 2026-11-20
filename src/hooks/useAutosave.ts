import { useEffect, useState } from "react";
import type { EditorCode, SaveStatus } from "../types/editor";

const STORAGE_KEYS = {
	html: "codepen-clone-html",
	css: "codepen-clone-css",
	javascript: "codepen-clone-js",
} as const;

export default function useAutosave(code: EditorCode, delay = 600) {
	const [outcome, setOutcome] = useState<{
		code: EditorCode;
		status: Exclude<SaveStatus, "saving">;
	}>({ code, status: "saved" });

	useEffect(() => {
		const timer = window.setTimeout(() => {
			try {
				for (const language of Object.keys(STORAGE_KEYS) as Array<
					keyof EditorCode
				>) {
					window.localStorage.setItem(
						STORAGE_KEYS[language],
						JSON.stringify(code[language]),
					);
				}
				setOutcome({ code, status: "saved" });
			} catch {
				setOutcome({ code, status: "failed" });
			}
		}, delay);

		return () => window.clearTimeout(timer);
	}, [code, delay]);

	return outcome.code === code ? outcome.status : "saving";
}
