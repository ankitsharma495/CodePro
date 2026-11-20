import { useCallback, useRef, useState } from "react";
import {
	buildProjectZip,
	buildStandaloneHtml,
	downloadFile,
	readProjectFile,
} from "../services/projectFiles";
import type { EditorCode } from "../types/editor";

export default function useProjectFiles(
	code: EditorCode,
	onImport: (code: EditorCode) => void,
) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [fileError, setFileError] = useState("");

	const downloadHtml = useCallback(() => {
		downloadFile(
			"codepro-project.html",
			buildStandaloneHtml(code),
			"text/html",
		);
	}, [code]);

	const downloadZip = useCallback(async () => {
		try {
			const zip = await buildProjectZip(code);
			downloadFile("codepro-project.zip", zip, "application/zip");
			setFileError("");
		} catch {
			setFileError("Could not create the ZIP download.");
		}
	}, [code]);

	const importFile = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const input = event.currentTarget;
			const file = input.files?.[0];
			if (!file) return;
			try {
				onImport(await readProjectFile(file));
				setFileError("");
			} catch (error) {
				setFileError(
					error instanceof Error
						? error.message
						: "Could not import this file.",
				);
			} finally {
				input.value = "";
			}
		},
		[onImport],
	);

	return { fileInputRef, fileError, downloadHtml, downloadZip, importFile };
}
