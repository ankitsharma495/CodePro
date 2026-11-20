import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
} from "react";
import buildPreviewDocument from "../services/previewDocument";
import type { ConsoleEntry, ConsoleLevel, EditorCode } from "../types/editor";

const VALID_LEVELS: ConsoleLevel[] = ["log", "info", "warn", "error"];

export default function usePreviewRunner(
	code: EditorCode,
	iframeRef: RefObject<HTMLIFrameElement | null>,
) {
	const [previewDocument, setPreviewDocument] = useState(() =>
		buildPreviewDocument(code),
	);
	const [entries, setEntries] = useState<ConsoleEntry[]>([]);
	const nextEntryId = useRef(0);

	useEffect(() => {
		const timer = window.setTimeout(
			() => setPreviewDocument(buildPreviewDocument(code)),
			250,
		);
		return () => window.clearTimeout(timer);
	}, [code]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<unknown>) => {
			if (event.source !== iframeRef.current?.contentWindow) return;
			if (typeof event.data !== "object" || event.data === null) return;

			const payload = event.data as Record<string, unknown>;
			if (
				payload.marker !== "__codeproPreview" ||
				!VALID_LEVELS.includes(payload.level as ConsoleLevel) ||
				typeof payload.message !== "string" ||
				typeof payload.timestamp !== "number"
			) {
				return;
			}

			setEntries((current) => [
				...current.slice(-199),
				{
					id: nextEntryId.current++,
					level: payload.level as ConsoleLevel,
					message: payload.message as string,
					timestamp: payload.timestamp as number,
				},
			]);
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [iframeRef]);

	const clearEntries = useCallback(() => setEntries([]), []);
	return { previewDocument, entries, clearEntries };
}
