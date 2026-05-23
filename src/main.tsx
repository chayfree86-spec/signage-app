import React from "react";
import { createRoot } from "react-dom/client";
import AdminPage from "./pages/AdminPage";
import ScreenPage from "./pages/ScreenPage";
import "./styles/global.css";

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/screen") {
    return <ScreenPage />;
  }

  return <AdminPage />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
