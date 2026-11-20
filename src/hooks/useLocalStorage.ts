import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "codepen-clone-";

export default function useLocalStorage<T>(
	key: string,
	initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
	const prefixedKey = PREFIX + key;

	const [value, setValue] = useState<T>(() => {
		const jsonValue = localStorage.getItem(prefixedKey);
		if (jsonValue != null) return JSON.parse(jsonValue) as T;

		if (typeof initialValue === "function") {
			return (initialValue as () => T)();
		} else {
			return initialValue;
		}
	});

	useEffect(() => {
		localStorage.setItem(prefixedKey, JSON.stringify(value));
	}, [prefixedKey, value]);

	return [value, setValue];
}
