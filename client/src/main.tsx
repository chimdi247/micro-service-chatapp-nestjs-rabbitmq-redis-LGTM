import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "@/App";
import { AuthProvider } from "@/context/auth-context";
import { UserDirectoryProvider } from "@/context/user-directory-context";

import "@/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UserDirectoryProvider>
          <App />
        </UserDirectoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
