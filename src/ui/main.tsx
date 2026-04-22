import React from "react";
import ReactDOM from "react-dom/client";
// The real page component is added in a later task.
import { UpstreamConfigPage } from "./app.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UpstreamConfigPage />
  </React.StrictMode>,
);
