import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Dialog, RecordsTable } from "./components.jsx";
import { PARAMS, STATIONS, initialMission, legendStops } from "./model.js";
import {
  formatReading,
  getAllPages,
  QUALITY_LABELS,
  sceneRecords,
  toDisplayRecord,
} from "./api.js";
import OperatorAccess, { useOperator } from "./OperatorAccess.jsx";
import PlanEditor from "./PlanEditor.jsx";
import MissionPlan from "./MissionPlan.jsx";
import TelemetryPanel from "./TelemetryPanel.jsx";
import QualityReview from "./QualityReview.jsx";
const Twin = lazy(() => import("./Twin.jsx"));

function usePolledData(path, transform) {
  const [state, setState] = useState({
    data: [],
    loading: true,
    error: "",
    syncedAt: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function read() {
      try {
        const items = await getAllPages(path, controller.signal);
        if (!controller.signal.aborted)
          setState({
            data: items.map(transform),
            error: "",
            loading: false,
            syncedAt: Date.now(),
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((old) => ({ ...old, loading: false, error: error.message }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(read, 5000);
      }
    }
    read();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, transform, attempt]);
  return { ...state, retry: () => setAttempt((v) => v + 1) };
}
const identity = (v) => v;

export default function ApiWorkspace({ onOpenDemo }) {
  const missions = usePolledData("/api/v1/missions", identity);
  const [chosen, setChosen] = useState("");
  const operator = useOperator();
  const [creating, setCreating] = useState(false);
  const [createdMission, setCreatedMission] = useState(null);
  useEffect(() => {
    if (missions.data.length) setChosen((current) => current || missions.data[0].id);
  }, [chosen, missions.data]);
  const mission =
    missions.data.find((m) => m.id === chosen) ||
    (createdMission?.id === chosen ? createdMission : missions.data[0]);
  return (
    <main className="api-workspace">
      <header className="api-heading">
        <div>
          <span className="eyebrow">AquaTwin · kalıcı veri</span>
          <h1>API çalışma alanı</h1>
          <p>
            Görev ve ölçümler PostgreSQL üzerinden okunur. Fiziksel cihaz
            kontrolü yok.
          </p>
        </div>
        <button className="btn" onClick={onOpenDemo}>
          Sentetik demoya dön
        </button>
      </header>
      <OperatorAccess operator={operator} />
      {operator.session.authenticated && (
        <button className="btn" onClick={() => setCreating(true)}>
          Yeni görev oluştur
        </button>
      )}
      {creating && (
        <PlanEditor
          csrf={operator.session.csrf_token}
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            setCreatedMission(created);
            setChosen(created.id);
            missions.retry();
          }}
        />
      )}
      <section className="panel api-controls" aria-label="Veri kaynağı">
        <label>
          Görev
          <select
            value={mission?.id || ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            {!missions.data.length && (
              <option value="">Görev bulunamadı</option>
            )}
            {createdMission &&
              !missions.data.some((m) => m.id === createdMission.id) && (
                <option value={createdMission.id}>{createdMission.name}</option>
              )}
            {missions.data.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.source === "device" ? "Cihaz" : "Sentetik"}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={missions.retry}>
          Görevleri yenile
        </button>
        <span role="status">
          {missions.loading
            ? "API bağlantısı kuruluyor…"
            : missions.error
              ? "API bağlantı sorunu"
              : `${missions.data.length} görev`}
        </span>
      </section>
      {missions.error && (
        <div className="notice warning" role="alert">
          {missions.error} Son başarılı liste korunuyor. Backend'i başlatıp
          yeniden deneyin; demo verisi eklenmez.
        </div>
      )}
      {!missions.loading && !missions.error && !mission && (
        <div className="panel api-empty">
          <h2>Henüz görev yok</h2>
          <p>
            Backend örnek göndericisiyle bir görev ve ölçüm ekleyin. Adımlar
            backend/README.md içinde.
          </p>
        </div>
      )}
      {mission && (
        <MissionData key={mission.id} mission={mission} operator={operator} />
      )}
    </main>
  );
}

function MissionData({ mission, operator }) {
  const measurements = usePolledData(
    `/api/v1/measurements?mission_id=${encodeURIComponent(mission.id)}`,
    toDisplayRecord,
  );
  const [param, setParam] = useState("temp");
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [view, setView] = useState("3d");
  const [cameraCommand, setCameraCommand] = useState(null);
  const [notice, setNotice] = useState("");
  const records = measurements.data;
  const positioned = useMemo(
    () => sceneRecords(records, param),
    [records, param],
  );
  const stations = useMemo(
    () => [...new Set(records.map((r) => r.station))].map((id) => ({ id })),
    [records],
  );
  function choose(record) {
    setSelected(record);
    setDetail(record);
  }
  const selectedStation = STATIONS.some((s) => s.id === selected?.station)
    ? selected.station
    : "S01";
  const theme = document.documentElement.dataset.theme || "light";
  return (
    <>
      <section className="panel api-summary" aria-label="Görev özeti">
        <h2>{mission.name}</h2>
        <p>
          <strong>
            {mission.source === "device"
              ? "Cihaz ölçümleri"
              : "SENTETİK KAYNAK · fiziksel ölçüm değil"}
          </strong>
        </p>
        <p>
          Görev kimliği: <code>{mission.id}</code>
        </p>
        <div role="status">
          {measurements.loading
            ? "Ölçümler yükleniyor…"
            : `${records.length} ölçüm · ${records.filter((r) => r.quality === "ok").length} geçerli`}
          {measurements.syncedAt &&
            ` · API son okuma: ${new Date(measurements.syncedAt).toLocaleTimeString("tr-TR")}`}
        </div>
        <p>
          API 5 saniyede bir sorgulanır. Bu saat cihazın son bağlantı zamanı
          değildir.
        </p>
        <button className="btn" onClick={measurements.retry}>
          Ölçümleri yenile
        </button>
      </section>
      {measurements.error && (
        <div className="notice warning" role="alert">
          {measurements.error} Gösterilenler son başarılı okumadan kalan
          kayıtlar; güncel akış doğrulanamadı.
        </div>
      )}
      {!measurements.loading && !measurements.error && !records.length && (
        <p className="notice info">Bu göreve henüz ölçüm gönderilmedi.</p>
      )}
      <TelemetryPanel key={mission.id} mission={mission} />
      <MissionPlan
        mission={mission}
        records={records}
        measurementsReady={!measurements.loading && !measurements.error}
        operator={operator}
      />
      <section className="panel api-scene">
        <div className="api-controls">
          <label>
            3D parametresi
            <select value={param} onChange={(e) => setParam(e.target.value)}>
              {Object.entries(PARAMS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => setView((v) => (v === "3d" ? "2d" : "3d"))}
          >
            {view === "3d" ? "Üstten görünüm" : "3D görünüm"}
          </button>
          {[
            ["in", "Yakınlaştır"],
            ["out", "Uzaklaştır"],
            ["reset", "Kamerayı sıfırla"],
          ].map(([action, label]) => (
            <button
              className="btn"
              key={action}
              onClick={() => setCameraCommand({ action, id: Date.now() })}
            >
              {label}
            </button>
          ))}
        </div>
        <p>
          {positioned.length} / {records.length} kayıt bu parametreyle sahneye
          yerleştirilebilir. Yalnız demo-pond-v1 koordinatları ve seçili
          parametreyi içeren noktalar gösterilir.
        </p>
        <p>
          Şematik gölet ve istasyonlar gerçek batimetri değildir. Telemetri ayrı
          panelde izlenir; sahnede bot/vinç ve rota gösterilmez. Bu aşamada
          yalnız ölçüm noktaları gösterilir.
        </p>
        <Suspense fallback={<p>3D sahne yükleniyor…</p>}>
          <Twin
            mission={initialMission()}
            records={positioned}
            baseline={[]}
            param={param}
            depth={selected?.depth ?? 1}
            selectedStation={selectedStation}
            selectedRecord={selected}
            onSelectStation={() => {}}
            onSelectRecord={choose}
            view={view}
            mode="value"
            layer="points"
            theme={theme}
            reducedMotion={true}
            cameraCommand={cameraCommand}
            monitoringOnly={true}
          />
        </Suspense>
        <div
          className="api-colorbar"
          aria-hidden="true"
          style={{
            background: `linear-gradient(to right, ${legendStops(param).join(",")})`,
          }}
        />
        <p className="api-legend">
          {PARAMS[param].label}: {PARAMS[param].min}–{PARAMS[param].max}{" "}
          {PARAMS[param].unit} · Cividis. Aralık dışı değerler uç renge
          kırpılır; ham değer tabloda korunur. Geçerli olmayan kayıtlar kırmızı
          işaretlenir.
        </p>
      </section>
      <RecordsTable
        records={records}
        filters={filters}
        setFilters={setFilters}
        onSelect={choose}
        selectedId={selected?.id}
        notify={setNotice}
        missionName={mission.name}
        stationOptions={stations}
        depthOptions={[...new Set(records.map((r) => r.depth))].sort(
          (a, b) => a - b,
        )}
      />
      {notice && <p role="status">{notice}</p>}
      {detail && (
        <Dialog
          title={`${detail.station} · ${detail.depth} m ölçümü`}
          onClose={() => setDetail(null)}
        >
          <p>
            {QUALITY_LABELS[detail.quality]} ·{" "}
            {detail.packet.source === "device" ? "Cihaz" : "Sentetik"}
          </p>
          <p>{detail.reason}</p>
          <dl className="api-details">
            <dt>Ölçüm kimliği</dt>
            <dd>{detail.id}</dd>
            <dt>Ölçüm zamanı · UTC</dt>
            <dd>{detail.time}</dd>
            <dt>Sunucu alım zamanı · UTC</dt>
            <dd>{detail.packet.received_at}</dd>
            <dt>Hedef / gerçek derinlik</dt>
            <dd>
              {detail.packet.target_depth_m} / {detail.depth} m
            </dd>
            <dt>Konum</dt>
            <dd>{JSON.stringify(detail.packet.position)}</dd>
            <dt>Kalibrasyon</dt>
            <dd>{detail.packet.calibration_id || "Belirtilmedi"}</dd>
            {Object.entries(PARAMS).map(([key, p]) => (
              <div key={key}>
                <dt>{p.label}</dt>
                <dd>
                  {formatReading(detail[key], p.digits, p.unit)}
                  {detail.packet.parameters[key] &&
                    ` · ${detail.packet.parameters[key].sensor_id}`}
                </dd>
              </div>
            ))}
            <dt>Ham örnek sayısı</dt>
            <dd>{detail.packet.raw_samples.length}</dd>
          </dl>
          <QualityReview key={detail.id} record={detail} operator={operator} />
          <details>
            <summary>Orijinal API kaydı ve ham örnekler</summary>
            <pre className="api-json">
              {JSON.stringify(detail.packet, null, 2)}
            </pre>
          </details>
        </Dialog>
      )}
    </>
  );
}
