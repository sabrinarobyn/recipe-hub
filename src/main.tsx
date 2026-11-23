import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { ProfilesProvider } from "./components/Profiles";
import { AppDataProvider } from "./lib/store";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      {(account) => (
        <AppDataProvider account={account}>
          <ProfilesProvider account={account}>
            <App />
          </ProfilesProvider>
        </AppDataProvider>
      )}
    </AuthGate>
  </StrictMode>,
);
