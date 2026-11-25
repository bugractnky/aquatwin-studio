import React, { useEffect, useRef, useState } from "react";
import { planningRequest } from "./planning.js";
import { PARAMS, dataColor } from "./model.js";

const defaults = {
  parameter: "temp",
  reference: "demo-pond-v1",
  start: "",
  end: "",
  depth: "1",
  depthScale: "1",
  radius: "20",
  power: "2",
  xmin: "-40",
  xmax: "40",
  ymin: "-24",
  ymax: "24",
  x: "0",
  north: "0",
  comparison: "",
};
export default function AnalysisPanel({ mission, missions }) {
  const [form, setForm] = useState(defaults);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  async function calculate(event) {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const xmin = Number(form.xmin),
        xmax = Number(form.xmax),
        ymin = Number(form.ymin),
        ymax = Number(form.ymax);
      if (!(xmin < xmax && ymin < ymax))
        throw new Error("Izgara alt sınırları üst sınırlardan küçük olmalı.");
      const points = [
        {
          x_m: Number(form.x),
          north_m: Number(form.north),
          depth_m: Number(form.depth),
        },
      ];
      for (let y = 0; y < 11; y++)
        for (let x = 0; x < 11; x++)
          points.push({
            x_m: xmin + ((xmax - xmin) * x) / 10,
            north_m: ymin + ((ymax - ymin) * y) / 10,
            depth_m: Number(form.depth),
          });
      const body = {
        mission_id: mission.id,
        parameter: form.parameter,
        reference_id: form.reference,
        start: form.start ? new Date(form.start).toISOString() : null,
        end: form.end ? new Date(form.end).toISOString() : null,
        depth_scale: Number(form.depthScale),
        power: Number(form.power),
        radius_m: Number(form.radius),
        points,
      };
      const [current, comparison] = await Promise.all([
        planningRequest("/analysis", {
          method: "POST",
          body,
          signal: controller.signal,
        }),
        form.comparison
          ? planningRequest("/analysis", {
              method: "POST",
              body: { ...body, mission_id: form.comparison },
              signal: controller.signal,
            })
          : Promise.resolve(null),
      ]);
      if (!controller.signal.aborted)
        setResult({
          current,
          comparison,
          bounds: { xmin, xmax, ymin, ymax },
          comparisonName: missions.find((m) => m.id === form.comparison)?.name,
        });
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const current = result?.current;
  const point = current?.predictions[0];
  const baseline = result?.comparison?.predictions[0];
  return (
    <section className="panel analysis-panel" aria-label="API ölçüm analizi">
      <h2>API ölçüm analizi</h2>
      <p>
        Yalnız seçilen görevin kayıtları kullanılır. Son parametre
        değerlendirmesi, yoksa ilk kalite beyanı geçerli olmalı. Son deneme
        geçersizse eski geçerli kayda dönülmez. GNSS dönüşümü yoktur; referanslı
        yerel metre koordinatları gerekir.
      </p>
      <form onSubmit={calculate}>
        <fieldset disabled={busy} className="analysis-fields">
          <label>
            Analiz parametresi
            <select
              value={form.parameter}
              onChange={(e) => update("parameter", e.target.value)}
            >
              {Object.entries(PARAMS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Analiz koordinat referansı
            <input
              required
              maxLength={120}
              value={form.reference}
              onChange={(e) => update("reference", e.target.value)}
            />
          </label>
          <label>
            Başlangıç zamanı (yerel, boş=tüm görev)
            <input
              type="datetime-local"
              value={form.start}
              onChange={(e) => update("start", e.target.value)}
            />
          </label>
          <label>
            Bitiş zamanı (yerel, boş=tüm görev)
            <input
              type="datetime-local"
              value={form.end}
              onChange={(e) => update("end", e.target.value)}
            />
          </label>
          {[
            ["depth", "Analiz derinliği (m)", 0],
            ["depthScale", "Derinlik mesafe çarpanı", 0.001],
            ["radius", "Destek yarıçapı (m)", 0.001],
            ["power", "IDW kuvveti", 1],
            ["xmin", "Izgara X alt sınırı (m)"],
            ["xmax", "Izgara X üst sınırı (m)"],
            ["ymin", "Izgara kuzey alt sınırı (m)"],
            ["ymax", "Izgara kuzey üst sınırı (m)"],
            ["x", "Sorgu X (m)"],
            ["north", "Sorgu kuzey (m)"],
          ].map(([key, label, min]) => (
            <label key={key}>
              {label}
              <input
                required
                type="number"
                step="any"
                min={min}
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
              />
            </label>
          ))}
          <label>
            Karşılaştırılacak görev
            <select
              value={form.comparison}
              onChange={(e) => update("comparison", e.target.value)}
            >
              <option value="">Karşılaştırma yok</option>
              {missions
                .filter(
                  (m) => m.id !== mission.id && m.source === mission.source,
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="btn primary" type="submit">
            {busy ? "Analiz hesaplanıyor…" : "API analizini hesapla"}
          </button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      {!result && !busy && !error && (
        <p>
          Analiz henüz hesaplanmadı. Harita sınırları varsayılan olarak şematik
          demo alanıdır; gerçek gölet geometrisi değildir.
        </p>
      )}
      {current && (
        <>
          <p>
            <strong>
              {current.source === "simulated"
                ? "SENTETİK VERİ ANALİZİ"
                : "Cihaz kayıtlarının analizi"}
            </strong>{" "}
            · {current.observations.length} gözlem · {current.algorithm}
          </p>
          <p>
            Destek dışı hücreler boş bırakılır. İstatistiksel belirsizlik
            hesaplanmaz. Yarıçap ve derinlik çarpanı kullanıcı tercihidir; saha
            doğrulanmış model değildir.
          </p>
          <p>
            Sorgu: {point.x_m}, {point.north_m}, {point.depth_m} m ·{" "}
            <strong>
              {point.value === null
                ? "Tahmin yok"
                : `${point.value.toFixed(3)} ${current.unit}`}
            </strong>{" "}
            · {point.kind} · {point.neighbors} destek noktası
          </p>
          {result.comparison && (
            <p>
              Karşılaştırma: {result.comparisonName} ·{" "}
              {baseline.value === null
                ? "Tahmin yok"
                : `${baseline.value.toFixed(3)} ${current.unit}`}{" "}
              · fark (seçili−karşılaştırma):{" "}
              {point.value !== null && baseline.value !== null
                ? (point.value - baseline.value).toFixed(3)
                : "Hesaplanamadı"}
              . Görev verileri birbirine karıştırılmaz.
            </p>
          )}
          <p>
            İstasyon bazında dışarıda bırakma: {current.validation.evaluated}/
            {current.validation.total} gözlem değerlendirildi · RMSE{" "}
            {current.validation.rmse === null
              ? "Hesaplanamadı"
              : current.validation.rmse.toFixed(3)}{" "}
            {current.unit}. Bu sonuç saha doğrulaması değildir.
          </p>
          <FieldPlot data={current} bounds={result.bounds} />
          <h3>Ölçülen derinlik profilleri</h3>
          <p>
            Tablo doğrudan gözlemleri gösterir; profil değerleri interpolasyon
            değildir. Kalibrasyon bağlantısı olmayan değerler kalibre edilmiş
            sayılmaz.
          </p>
          <MeasuredProfile data={current} />
          <div className="analysis-table">
            <table>
              <thead>
                <tr>
                  <th>İstasyon</th>
                  <th>Hedef / gerçek m</th>
                  <th>Ölçülen değer</th>
                  <th>Zaman UTC</th>
                  <th>Kalite kaynağı / kalibrasyon</th>
                </tr>
              </thead>
              <tbody>
                {current.observations.map((o) => (
                  <tr key={o.id}>
                    <td>{o.station_id}</td>
                    <td>
                      {o.target_depth_m} / {o.depth_m}
                    </td>
                    <td>
                      {o.value} {current.unit}
                    </td>
                    <td>{o.measured_at}</td>
                    <td>
                      {o.quality_source} / {o.calibration_id || "Bağlanmadı"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>
              Son hesaplamanın ayarları, gözlemleri ve destek maskesi
            </summary>
            <pre className="api-json">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}
function FieldPlot({ data, bounds }) {
  const p = data.settings.parameter;
  const x = (v) => 30 + ((v - bounds.xmin) / (bounds.xmax - bounds.xmin)) * 440;
  const y = (v) =>
    290 - ((v - bounds.ymin) / (bounds.ymax - bounds.ymin)) * 260;
  const measured = data.observations.filter(
    (o) =>
      Math.abs(o.depth_m - data.settings.points[0].depth_m) < 1e-6 &&
      o.x_m >= bounds.xmin &&
      o.x_m <= bounds.xmax &&
      o.north_m >= bounds.ymin &&
      o.north_m <= bounds.ymax,
  );
  return (
    <figure className="analysis-field">
      <svg
        viewBox="0 0 500 330"
        role="img"
        aria-label="IDW tahmin ızgarası ve seçilen derinlikteki ölçüm noktaları"
      >
        <rect x="5" y="5" width="490" height="320" fill="var(--surface-alt)" />
        {data.predictions.slice(1).map((v, i) =>
          v.value === null ? null : (
            <rect
              key={i}
              x={x(v.x_m) - 17}
              y={y(v.north_m) - 10}
              width="34"
              height="20"
              fill={dataColor(v.value, p)}
            >
              <title>
                {v.kind}: {v.value} {data.unit}; X={v.x_m}, kuzey={v.north_m}
              </title>
            </rect>
          ),
        )}
        {measured.map((o) => (
          <circle
            key={o.id}
            cx={x(o.x_m)}
            cy={y(o.north_m)}
            r="5"
            fill={dataColor(o.value, p)}
            stroke="var(--text)"
            strokeWidth="2"
          >
            <title>
              Ölçüm {o.station_id}: {o.value} {data.unit}
            </title>
          </circle>
        ))}
        <text x="30" y="319" fill="var(--text)">
          X: {bounds.xmin}…{bounds.xmax} m · kuzey: {bounds.ymin}…{bounds.ymax}{" "}
          m
        </text>
      </svg>
      <figcaption>
        Dikdörtgenler: destekli tahmin ızgarası · çemberler: tam seçilen
        derinlikteki ölçümler. Cividis, {PARAMS[p].min}–{PARAMS[p].max}{" "}
        {PARAMS[p].unit}; uç dışı renkler kırpılır, ham değerler tabloda
        korunur. Gerçek kıyı/dip haritası değildir.
      </figcaption>
    </figure>
  );
}

function MeasuredProfile({ data }) {
  const stations = [...new Set(data.observations.map((o) => o.station_id))];
  const [chosen, setChosen] = useState("");
  const station = stations.includes(chosen) ? chosen : stations[0];
  const observations = data.observations
    .filter((o) => o.station_id === station)
    .sort((a, b) => a.depth_m - b.depth_m);
  if (!observations.length) return <p>Profil için geçerli gözlem yok.</p>;
  const lo = Math.min(...observations.map((o) => o.value)),
    hi = Math.max(...observations.map((o) => o.value));
  const deepest = Math.max(1, ...observations.map((o) => o.depth_m));
  const x = (v) => 60 + ((v - lo) / Math.max(1, hi - lo)) * 330;
  const y = (d) => 30 + (d / deepest) * 220;
  return (
    <figure className="analysis-field">
      <label>
        Profil istasyonu
        <select value={station} onChange={(e) => setChosen(e.target.value)}>
          {stations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <svg
        viewBox="0 0 460 290"
        role="img"
        aria-label={`${station} ölçülen derinlik profili`}
      >
        <path d="M50 20V255H420" fill="none" stroke="var(--text)" />
        {observations.map((o) => (
          <g key={o.id}>
            <circle
              cx={x(o.value)}
              cy={y(o.depth_m)}
              r="5"
              fill={dataColor(o.value, data.settings.parameter)}
              stroke="var(--text)"
            />
            <text
              x={x(o.value) + 8}
              y={y(o.depth_m) - 6}
              fill="var(--text)"
              fontSize="11"
            >
              {o.depth_m} m · {o.value.toFixed(2)}
            </text>
          </g>
        ))}
        <text x="60" y="280" fill="var(--text)">
          {data.settings.parameter}: {lo}…{hi} {data.unit} · derinlik aşağı
          artar
        </text>
      </svg>
      <figcaption>
        Yalnız doğrudan gözlem noktaları; noktalar arasında ölçülmüş veri
        varsayılmaz.
      </figcaption>
    </figure>
  );
}
