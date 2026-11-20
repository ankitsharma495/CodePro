import { describe, expect, it } from "vitest";
import {
	EXTENSION_MAP,
	INITIAL_CONTENT_MAP,
	initialCssContent,
	initialHtmlContent,
	initialJsContent,
} from "./index";

describe("editor starter content", () => {
	it("provides initial content and download extensions for every pane", () => {
		expect(INITIAL_CONTENT_MAP).toEqual({
			html: initialHtmlContent,
			css: initialCssContent,
			javascript: initialJsContent,
		});
		expect(EXTENSION_MAP).toEqual({
			html: "html",
			css: "css",
			javascript: "js",
		});
	});
});
