import React from "react";
import ReactDOM from "react-dom/client";
import { UpstreamConfigPage } from "./app.js";

const params = new URLSearchParams(globalThis.location?.search ?? "");
const isAdminMode = params.get("admin") === "1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UpstreamConfigPage
      showConfigCenter={isAdminMode}
      defaultWorkspace={isAdminMode ? "config" : "invocation"}
      requireAdminLogin={isAdminMode}
    />
  </React.StrictMode>,
);
