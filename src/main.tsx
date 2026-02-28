import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./components/settings/ThemeSettings";

registerSW({ immediate: true });
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
