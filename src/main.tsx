import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { ProfilesProvider } from "./components/Profiles";
import { ReviewsProvider } from "./components/Reviews";
import { AppDataProvider } from "./lib/store";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      {(account) => (
        <AppDataProvider account={account}>
          <ProfilesProvider account={account}>
            <ReviewsProvider account={account}>
              <App />
            </ReviewsProvider>
          </ProfilesProvider>
        </AppDataProvider>
      )}
    </AuthGate>
  </StrictMode>,
);
