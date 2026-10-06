import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppDataProvider } from "./lib/store";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
);
