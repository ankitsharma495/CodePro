import { describe, expect, it } from "vitest";
import buildPreviewDocument from "./previewDocument";

describe("preview document", () => {
	it("installs the console bridge and includes each pane's content", () => {
		const document = buildPreviewDocument({
			html: "<h1>Preview</h1>",
			css: "h1 { color: red; }",
			javascript: "console.log('hello')",
		});
		expect(document).toContain("__codeproPreview");
		expect(document).toContain("<h1>Preview</h1>");
		expect(document).toContain("h1 { color: red; }");
		expect(document).toContain("console.log('hello')");
	});

	it("escapes closing style and script tags from user code", () => {
		const document = buildPreviewDocument({
			html: "",
			css: "/* </style> */",
			javascript: "const value = '</script>';",
		});
		expect(document).toContain("<\\/style>");
		expect(document).toContain("<\\/script>");
	});
});
