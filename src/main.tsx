import React from "react";
import { createRoot } from "react-dom/client";
import AdminPage from "./pages/AdminPage";
import ScreenPage from "./pages/ScreenPage";
import "./styles/global.css";

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const searchParams = new URLSearchParams(window.location.search);

  if (pathname === "/screen" || searchParams.get("screen") === "1") {
    return <ScreenPage />;
  }

  return <AdminPage />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
