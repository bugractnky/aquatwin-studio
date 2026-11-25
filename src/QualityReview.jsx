import React, { useEffect, useState } from "react";
import { planningRequest } from "./planning.js";
import { PARAMS } from "./model.js";

export default function QualityReview({ record, operator }) {
  const [data, setData] = useState(null);
  const [calibrations, setCalibrations] = useState([]);
  const [rows, setRows] = useState({});
  const [reviewer, setReviewer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      planningRequest(`/measurements/${record.id}/quality`, {
        signal: controller.signal,
      }),
      planningRequest("/calibrations?limit=200", { signal: controller.signal }),
    ])
      .then(([quality, calibration]) => {
        if (controller.signal.aborted) return;
        setData(quality);
        setCalibrations(calibration.items);
        setReviewer(quality.review?.recorded_by || "");
        setRows(
          Object.fromEntries(
            Object.keys(record.packet.parameters).map((key) => {
              const old = quality.review?.parameters[key];
              return [
                key,
                {
                  status: old?.status || "unreviewed",
                  reason: old?.reason || "",
                  calibration_id: old?.calibration_id || "",
                  useThresholds: !!old?.thresholds,
                  min_samples: old?.thresholds?.min_samples ?? "",
                  min_duration_s: old?.thresholds?.min_duration_s ?? "",
                  max_sd: old?.thresholds?.max_sd ?? "",
                  rationale: old?.thresholds?.rationale || "",
                },
              ];
            }),
          ),
        );
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [record.id, record.packet, attempt]);
  const update = (key, field, value) =>
    setRows((old) => ({ ...old, [key]: { ...old[key], [field]: value } }));
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const parameters = Object.fromEntries(
        Object.entries(rows).map(([key, row]) => [
          key,
          {
            status: row.status,
            reason: row.reason,
            calibration_id: row.calibration_id || null,
            thresholds: row.useThresholds
              ? {
                  min_samples: Number(row.min_samples),
                  min_duration_s: Number(row.min_duration_s),
                  max_sd: Number(row.max_sd),
                  rationale: row.rationale,
                }
              : null,
          },
        ]),
      );
      await planningRequest(`/measurements/${record.id}/quality`, {
        method: "PUT",
        csrf: operator.session.csrf_token,
        body: {
          expected_revision: data.revision,
          recorded_by: reviewer,
          parameters,
        },
      });
      setAttempt((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="quality-review"
      aria-label="Parametre kalite incelemesi"
    >
      <h3>Parametre kalite incelemesi</h3>
      <p>
        Ham ölçüm ve ilk kalite beyanı değişmez. Aşağıdaki değerlendirmeler
        sürümlü saklanır; analiz son değerlendirmeyi kullanır.
      </p>
      <p>
        Örnek sayısı, pencere süresi ve örnek standart sapması ham veriden
        hesaplanır. Eşik girilmediyse stabilite kararı üretilmez. Eşiğin
        karşılanması otomatik ölçüm onayı değildir.
      </p>
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      <button
        className="btn"
        disabled={busy}
        onClick={() => setAttempt((v) => v + 1)}
      >
        Kaliteyi yeniden yükle
      </button>
      {data && (
        <>
          <p>Değerlendirme sürümü {data.revision}</p>
          <form onSubmit={save}>
            <fieldset
              disabled={busy || loading || !operator.session.authenticated}
            >
              <label>
                Kaydı giren kişi (beyan)
                <input
                  required
                  maxLength={120}
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                />
              </label>
              {Object.entries(rows).map(([key, row]) => (
                <fieldset key={key}>
                  <legend>
                    {PARAMS[key].label} ·{" "}
                    {record.packet.parameters[key].sensor_id}
                  </legend>
                  <p>
                    n={data.summaries[key].n} · süre=
                    {data.summaries[key].duration_s ?? "yok"} sn · SD=
                    {data.summaries[key].sample_sd?.toFixed(4) ?? "yok"} ·{" "}
                    {data.summaries[key].stability}
                  </p>
                  <label>
                    Karar · {PARAMS[key].label}
                    <select
                      value={row.status}
                      onChange={(e) => update(key, "status", e.target.value)}
                    >
                      <option value="unreviewed">İncelenmedi</option>
                      <option value="valid">Geçerli</option>
                      <option value="unstable">Kararsız</option>
                      <option value="invalid">Geçersiz</option>
                    </select>
                  </label>
                  <label>
                    Gerekçe · {PARAMS[key].label}
                    <input
                      required
                      maxLength={1000}
                      value={row.reason}
                      onChange={(e) => update(key, "reason", e.target.value)}
                    />
                  </label>
                  <label>
                    Kalibrasyon · {PARAMS[key].label}
                    <select
                      value={row.calibration_id}
                      onChange={(e) =>
                        update(key, "calibration_id", e.target.value)
                      }
                    >
                      <option value="">Bağlanmadı</option>
                      {calibrations
                        .filter(
                          (c) =>
                            c.sensor_id ===
                              record.packet.parameters[key].sensor_id &&
                            c.parameter === key &&
                            c.source === record.packet.source,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id} · {c.outcome} · {c.performed_at}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={row.useThresholds}
                      onChange={(e) =>
                        update(key, "useThresholds", e.target.checked)
                      }
                    />{" "}
                    Beyan edilen stabilite eşiği kullan · {PARAMS[key].label}
                  </label>
                  {row.useThresholds && (
                    <div className="quality-fields">
                      {[
                        ["min_samples", "Asgari örnek sayısı", 2, 1],
                        ["min_duration_s", "Asgari süre (sn)", 0, "any"],
                        [
                          "max_sd",
                          `Azami SD (${PARAMS[key].unit || "birimsiz"})`,
                          0,
                          "any",
                        ],
                      ].map(([field, label, min, step]) => (
                        <label key={field}>
                          {label}
                          <input
                            required
                            type="number"
                            min={min}
                            step={step}
                            value={row[field]}
                            onChange={(e) => update(key, field, e.target.value)}
                          />
                        </label>
                      ))}
                      <label>
                        Eşiğin dayanağı
                        <input
                          required
                          value={row.rationale}
                          onChange={(e) =>
                            update(key, "rationale", e.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                </fieldset>
              ))}
              <button className="btn primary" type="submit">
                Kalite değerlendirmesini kaydet
              </button>
            </fieldset>
          </form>
          {!operator.session.authenticated && (
            <p>Düzenleme için operatör girişi gerekir.</p>
          )}
          <p>
            Kalibrasyon listesinde son 200 kayıt gösterilir. Uygun
            sensör/parametre/kaynak eşleşse bile tarih ve sonuç sunucuda ayrıca
            doğrulanır.
          </p>
          <details>
            <summary>Değerlendirme geçmişi ve ham istatistik özeti</summary>
            <pre className="api-json">{JSON.stringify(data, null, 2)}</pre>
          </details>
        </>
      )}
      {operator.session.authenticated && (
        <CalibrationForm
          record={record}
          csrf={operator.session.csrf_token}
          onSaved={() => {
            planningRequest("/calibrations?limit=200")
              .then((value) => setCalibrations(value.items))
              .catch((e) => setError(e.message));
          }}
        />
      )}
    </section>
  );
}

function CalibrationForm({ record, csrf, onSaved }) {
  const [param, setParam] = useState(Object.keys(record.packet.parameters)[0]);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const performed_at = new Date(form.get("performed")).toISOString();
      const expires_at = form.get("expires")
        ? new Date(form.get("expires")).toISOString()
        : null;
      await planningRequest("/calibrations", {
        method: "POST",
        csrf,
        body: {
          id,
          sensor_id: record.packet.parameters[param].sensor_id,
          parameter: param,
          source: record.packet.source,
          unit: record.packet.parameters[param].unit,
          performed_at,
          expires_at,
          procedure: form.get("procedure"),
          recorded_by: form.get("person"),
          outcome: form.get("outcome"),
          references: [
            {
              reference_value: Number(form.get("reference")),
              observed_value: Number(form.get("observed")),
            },
          ],
        },
      });
      setId(crypto.randomUUID());
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Yeni kalibrasyon kaydı ekle</summary>
      <p>
        Gerçek kalibrasyon yapıldıysa gerçek kayıt girin. Sentetik görevde kayıt
        da sentetik işaretlenir. Buradaki kayıt ölçüm değerlerini otomatik
        düzeltmez. Kaydedilen kayıt değiştirilemez; düzeltme için yeni kayıt
        gerekir.
      </p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Kalibrasyon parametresi
            <select
              value={param}
              onChange={(e) => {
                setParam(e.target.value);
                setId(crypto.randomUUID());
              }}
            >
              {Object.keys(record.packet.parameters).map((p) => (
                <option key={p} value={p}>
                  {PARAMS[p].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Uygulanma zamanı (yerel)
            <input required name="performed" type="datetime-local" />
          </label>
          <label>
            Geçerlilik sonu (yerel, isteğe bağlı)
            <input name="expires" type="datetime-local" />
          </label>
          <label>
            Prosedür ve referans malzeme
            <input required name="procedure" maxLength={2000} />
          </label>
          <label>
            Kalibrasyonu kaydeden (beyan)
            <input required name="person" maxLength={120} />
          </label>
          <label>
            Kalibrasyon sonucu
            <select name="outcome">
              <option value="unreviewed">İncelenmedi</option>
              <option value="pass">Başarılı</option>
              <option value="fail">Başarısız</option>
            </select>
          </label>
          <label>
            Referans değeri
            <input required type="number" step="any" name="reference" />
          </label>
          <label>
            Gözlenen değer
            <input required type="number" step="any" name="observed" />
          </label>
          <button className="btn" type="submit">
            Kalibrasyonu kaydet
          </button>
        </fieldset>
      </form>
    </details>
  );
}
