import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initNativePushListeners } from "./lib/nativePush";

// Attach as early as possible so a notification tap that cold-launches the
// app isn't missed while the router is still mounting.
initNativePushListeners();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);

