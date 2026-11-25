import React, { useEffect, useState } from "react";
import { planningRequest } from "./planning.js";

export function useOperator() {
  const [session, setSession] = useState({
    enabled: false,
    authenticated: false,
    csrf_token: null,
    loading: true,
    error: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    planningRequest("/operator/session", { signal: controller.signal })
      .then((s) => setSession({ ...s, loading: false, error: "" }))
      .catch((e) => {
        if (!controller.signal.aborted)
          setSession({
            enabled: false,
            authenticated: false,
            csrf_token: null,
            loading: false,
            error: e.message,
          });
      });
    return () => controller.abort();
  }, []);
  return { session, setSession };
}

export default function OperatorAccess({ operator }) {
  const { session, setSession } = operator;
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await planningRequest("/operator/session", {
        method: "POST",
        body: { password },
      });
      setSession({ ...s, loading: false, error: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await planningRequest("/operator/session", {
        method: "DELETE",
        csrf: session.csrf_token,
      });
      setSession({ ...session, authenticated: false, csrf_token: null });
    } catch (e) {
      if (e.status === 401)
        setSession({ ...session, authenticated: false, csrf_token: null });
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel operator-access" aria-label="Operatör oturumu">
      <h2>Görev planlama</h2>
      {session.loading ? (
        <p role="status">Operatör erişimi kontrol ediliyor…</p>
      ) : session.error ? (
        <p role="alert">{session.error}</p>
      ) : !session.enabled ? (
        <p>
          Bu sunucuda görev planlama girişi etkin değil. Sunucu yöneticisinin
          operatör erişimini ayarlaması gerekiyor. Ölçümleri okumaya devam
          edebilirsiniz.
        </p>
      ) : session.authenticated ? (
        <div className="plan-actions">
          <p role="status">Operatör oturumu açık</p>
          <button className="btn" onClick={logout} disabled={busy}>
            Oturumu kapat
          </button>
        </div>
      ) : (
        <form className="plan-actions" onSubmit={submit}>
          <label>
            Operatör parolası
            <input
              type="password"
              required
              maxLength={256}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn" disabled={busy}>
            {busy ? "Giriş yapılıyor…" : "Operatör girişi"}
          </button>
          <p>
            Plan oluşturmak ve düzenlemek için giriş yapın. Cihaz token’ı
            kullanılmaz.
          </p>
        </form>
      )}
      {error && (
        <div role="alert" className="notice warning">
          {error}
        </div>
      )}
    </section>
  );
}
