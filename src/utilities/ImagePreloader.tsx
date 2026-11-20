import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import CircularLoader from "../components/CircularLoader";

interface ImagePreloaderProps {
	images: string[];
	children: ReactNode;
}

const ImagePreloader = ({ images, children }: ImagePreloaderProps) => {
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const imagePromises = images.map((src) => {
			return new Promise<void>((resolve, reject) => {
				const img = new Image();
				img.src = src;
				img.onload = () => resolve();
				img.onerror = reject;
			});
		});

		Promise.all(imagePromises)
			.then(() => {
				setIsLoading(false);
			})
			.catch((error) => {
				console.error("Error preloading images:", error);
				setIsLoading(false);
			});
	}, [images]);

	return isLoading ? <CircularLoader /> : children;
};

export default ImagePreloader;
