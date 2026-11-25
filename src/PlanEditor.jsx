import React, { useState } from "react";
import { Dialog } from "./components.jsx";
import { planPayload, planningRequest, rowsFromPlan } from "./planning.js";

function stationRow(index) {
  return {
    key: crypto.randomUUID(),
    id: `S${String(index).padStart(2, "0")}`,
    name: `İstasyon ${index}`,
    first: "",
    second: "",
    depths: "1, 2, 3",
  };
}

export default function PlanEditor({
  mission,
  currentPlan,
  csrf,
  onSaved,
  onClose,
}) {
  const editing = Boolean(mission);
  const [id] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(mission?.name || "");
  const [source, setSource] = useState(mission?.source || "simulated");
  const [mode, setMode] = useState(
    currentPlan?.plan?.stations[0]?.position.local_x_m != null
      ? currentPlan.plan.stations[0].position.reference_id === "demo-pond-v1"
        ? "demo"
        : "local"
      : currentPlan?.plan
        ? "geo"
        : "demo",
  );
  const [referenceId, setReferenceId] = useState(
    currentPlan?.plan?.stations[0]?.position.reference_id || "",
  );
  const [rows, setRows] = useState(() =>
    currentPlan?.plan ? rowsFromPlan(currentPlan.plan) : [stationRow(1)],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function update(key, field, value) {
    setRows((old) =>
      old.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }
  function changeMode(value) {
    setMode(value);
    setRows((old) => old.map((r) => ({ ...r, first: "", second: "" })));
  }
  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      const plan = planPayload(
        rows,
        mode,
        mode === "demo" ? "demo-pond-v1" : referenceId,
      );
      if (
        source === "device" &&
        (mode === "demo" || referenceId.trim() === "demo-pond-v1")
      )
        throw new Error("Cihaz görevinde şematik demo referansı kullanılamaz.");
      setBusy(true);
      const result = editing
        ? await planningRequest(`/missions/${mission.id}/plan`, {
            method: "PUT",
            csrf,
            body: { expected_revision: currentPlan.revision, plan },
          })
        : await planningRequest("/planned-missions", {
            method: "POST",
            csrf,
            body: { id, name: name.trim(), source, plan },
          });
      onSaved(editing ? mission : result.mission);
    } catch (e) {
      setError(e.message || "Plan kaydedilemedi. Tekrar deneyebilirsiniz.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={editing ? "Görev planını düzenle" : "Yeni görev planı"}
      onClose={() => {
        if (!busy) onClose();
      }}
      className="plan-dialog"
    >
      <form onSubmit={save}>
        <p>
          Bu işlem ölçüm planını kaydeder; botu veya vinci hareket ettirmez.
          Derinliklerin sahada uygunluğu ayrıca doğrulanmalıdır.
        </p>
        <fieldset disabled={busy} className="plan-fields">
          <label>
            Görev adı
            <input
              required
              maxLength={120}
              value={name}
              disabled={editing}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Veri kaynağı
            <select
              value={source}
              disabled={editing}
              onChange={(e) => {
                setSource(e.target.value);
                if (e.target.value === "device" && mode === "demo")
                  changeMode("geo");
              }}
            >
              <option value="simulated">Sentetik görev</option>
              <option value="device">Cihaz görevi</option>
            </select>
          </label>
          <label>
            Konum sistemi
            <select value={mode} onChange={(e) => changeMode(e.target.value)}>
              <option value="demo" disabled={source === "device"}>
                Şematik yerel metre · demo-pond-v1
              </option>
              <option value="local">Referanslı yerel metre</option>
              <option value="geo">Enlem / boylam · WGS84</option>
            </select>
          </label>
          {mode === "local" && (
            <label>
              Yerel koordinat referansı
              <input
                required
                maxLength={120}
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
              />
            </label>
          )}
          <p>
            Konum sistemi değişirse eski sayılar yeni birime çevrilmez; alanlar
            temizlenir. İstasyonlar listelendikleri sırayla planlanır.
          </p>
          {rows.map((row, index) => (
            <fieldset className="plan-station" key={row.key}>
              <legend>İstasyon {index + 1}</legend>
              <div className="plan-grid">
                <label>
                  İstasyon kimliği
                  <input
                    required
                    maxLength={40}
                    value={row.id}
                    onChange={(e) => update(row.key, "id", e.target.value)}
                  />
                </label>
                <label>
                  İstasyon adı
                  <input
                    required
                    maxLength={120}
                    value={row.name}
                    onChange={(e) => update(row.key, "name", e.target.value)}
                  />
                </label>
                <label>
                  {mode !== "geo" ? "X · metre" : "Enlem · derece"}
                  <input
                    required
                    type="number"
                    step="any"
                    value={row.first}
                    onChange={(e) => update(row.key, "first", e.target.value)}
                  />
                </label>
                <label>
                  {mode !== "geo" ? "Kuzey · metre" : "Boylam · derece"}
                  <input
                    required
                    type="number"
                    step="any"
                    value={row.second}
                    onChange={(e) => update(row.key, "second", e.target.value)}
                  />
                </label>
                <label>
                  Hedef derinlikler · metre
                  <input
                    required
                    value={row.depths}
                    placeholder="1, 2, 3"
                    onChange={(e) => update(row.key, "depths", e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn"
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((old) => old.filter((r) => r.key !== row.key))
                }
              >
                İstasyon {index + 1} kaldır
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn"
            disabled={rows.length >= 50}
            onClick={() =>
              setRows((old) => [...old, stationRow(old.length + 1)])
            }
          >
            İstasyon ekle
          </button>
          <div className="plan-actions">
            <button type="submit" className="btn">
              {busy ? "Kaydediliyor…" : "Planı kaydet"}
            </button>
            <button type="button" className="btn subtle" onClick={onClose}>
              Vazgeç
            </button>
          </div>
        </fieldset>
        {error && (
          <div role="alert" className="notice warning">
            {error} Plan korunur; 409 durumunda pencereyi kapatıp güncel planı
            yeniden yükleyin.
          </div>
        )}
      </form>
    </Dialog>
  );
}
