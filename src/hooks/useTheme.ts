import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "codepro-theme";

function readTheme(): Theme {
	try {
		return window.localStorage.getItem(THEME_KEY) === "light"
			? "light"
			: "dark";
	} catch {
		return "dark";
	}
}

export default function useTheme() {
	const [theme, setTheme] = useState<Theme>(readTheme);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		try {
			window.localStorage.setItem(THEME_KEY, theme);
		} catch {
			// Keep the in-memory theme usable when browser storage is unavailable.
		}
	}, [theme]);

	return { theme, setTheme };
}
