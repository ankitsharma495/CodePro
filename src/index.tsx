import React from "react";
import ReactDOM from "react-dom/client";
import "./index.scss";
import App from "./components/App";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element was not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
