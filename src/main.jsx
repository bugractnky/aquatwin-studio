import React from "react";
import { createRoot } from "react-dom/client";
import App from "./SourceApp.jsx";
import "./style.css";
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal-error">
        <h1>Görünüm yüklenemedi</h1>
        <p>
          Tarayıcıda kaydedilmiş ölçümler otomatik silinmedi. Sayfayı
          yenileyerek geri yüklemeyi deneyin.
        </p>
        <button onClick={() => location.reload()}>Sayfayı yenile</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
