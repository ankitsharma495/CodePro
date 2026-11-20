import { useCallback, useRef, useState, type PointerEvent } from "react";

type LayoutDirection = "horizontal" | "vertical";
type PaneSizes = [number, number, number];
export type PaneDividerIndex = 0 | 1;

interface ActiveResize {
	index: PaneDividerIndex;
	nextIndex: 1 | 2;
	pointerId: number;
	start: number;
	dimension: number;
	firstSize: number;
	pairSize: number;
	vertical: boolean;
}

export default function usePaneLayout(layout: LayoutDirection) {
	const [sizes, setSizes] = useState<PaneSizes>([1, 1, 1]);
	const activeResize = useRef<ActiveResize | null>(null);

	const tracks = (vertical: boolean) => {
		const panes = sizes.map((size) => `${size}fr`);
		return vertical
			? {
					gridTemplateColumns: "minmax(0, 1fr)",
					gridTemplateRows: panes.join(" 6px "),
				}
			: {
					gridTemplateColumns: panes.join(" 8px "),
					gridTemplateRows: "minmax(0, 1fr)",
				};
	};

	const beginResize = useCallback(
		(index: PaneDividerIndex, event: PointerEvent<HTMLDivElement>) => {
			const workspace = event.currentTarget.parentElement;
			if (!workspace) return;
			const vertical =
				layout === "vertical" ||
				window.matchMedia("(max-width: 600px)").matches;
			const rect = workspace.getBoundingClientRect();
			const start = vertical ? event.clientY : event.clientX;
			const dimension = vertical ? rect.height : rect.width;
			activeResize.current = {
				index,
				nextIndex: index === 0 ? 1 : 2,
				pointerId: event.pointerId,
				start,
				dimension,
				firstSize: sizes[index],
				pairSize: sizes[index] + sizes[index === 0 ? 1 : 2],
				vertical,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
			event.preventDefault();
		},
		[layout, sizes],
	);

	const moveResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
		const resize = activeResize.current;
		if (
			!resize ||
			resize.pointerId !== event.pointerId ||
			resize.dimension === 0
		)
			return;
		const current = resize.vertical ? event.clientY : event.clientX;
		const delta = ((current - resize.start) / resize.dimension) * 3;
		const minSize = resize.pairSize * 0.2;
		const firstSize = Math.max(
			minSize,
			Math.min(resize.pairSize - minSize, resize.firstSize + delta),
		);
		setSizes((previous) => {
			const next: PaneSizes = [...previous];
			next[resize.index] = firstSize;
			next[resize.nextIndex] = resize.pairSize - firstSize;
			return next;
		});
	}, []);

	const endResize = useCallback(() => {
		activeResize.current = null;
	}, []);

	const adjustResize = useCallback(
		(index: PaneDividerIndex, change: number) => {
			setSizes((previous) => {
				const next: PaneSizes = [...previous];
				const nextIndex = index === 0 ? 1 : 2;
				const total = next[index] + next[nextIndex];
				const minSize = total * 0.2;
				const firstSize = Math.max(
					minSize,
					Math.min(total - minSize, next[index] + change),
				);
				next[index] = firstSize;
				next[nextIndex] = total - firstSize;
				return next;
			});
		},
		[],
	);

	return {
		sizes,
		...tracks(layout === "vertical"),
		beginResize,
		moveResize,
		endResize,
		adjustResize,
	};
}
