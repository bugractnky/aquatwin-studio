import React, { lazy, Suspense, useState } from "react";
import App from "./App.jsx";
const ApiWorkspace = lazy(() => import("./ApiWorkspace.jsx"));
export default function SourceApp() {
  const [source, setSource] = useState(() => {
    try {
      return localStorage.getItem("aquatwin-source") === "api" ? "api" : "demo";
    } catch {
      return "demo";
    }
  });
  function select(value) {
    try {
      localStorage.setItem("aquatwin-source", value);
    } catch {}
    setSource(value);
  }
  return source === "demo" ? (
    <App onOpenApi={() => select("api")} />
  ) : (
    <Suspense
      fallback={
        <main className="api-workspace">
          <h1>API çalışma alanı yükleniyor…</h1>
        </main>
      }
    >
      <ApiWorkspace onOpenDemo={() => select("demo")} />
    </Suspense>
  );
}
