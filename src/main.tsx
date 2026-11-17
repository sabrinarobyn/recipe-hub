import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { AppDataProvider } from "./lib/store";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      {(account) => (
        <AppDataProvider account={account}>
          <App />
        </AppDataProvider>
      )}
    </AuthGate>
  </StrictMode>,
);
