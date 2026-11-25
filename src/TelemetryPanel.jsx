import React, { useEffect, useState } from "react";
import { planningRequest } from "./planning.js";
import { depthText, reportStatus, STAGES } from "./telemetry.js";

const timestamp = (value) =>
  new Date(value).toLocaleString("tr-TR", { timeZone: "UTC" }) + " UTC";

export default function TelemetryPanel({ mission }) {
  const [state, setState] = useState({
    data: null,
    error: "",
    loading: true,
    readAt: null,
  });
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function read() {
      try {
        const [telemetry, events] = await Promise.all([
          planningRequest(`/missions/${mission.id}/telemetry`, {
            signal: controller.signal,
          }),
          planningRequest(`/missions/${mission.id}/events?limit=20`, {
            signal: controller.signal,
          }),
        ]);
        if (!controller.signal.aborted)
          setState({
            data: { telemetry, events },
            loading: false,
            error: "",
            readAt: performance.now(),
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
  }, [mission.id, attempt]);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed =
    state.readAt === null ? 0 : Math.max(0, now - state.readAt) / 1000;
  return (
    <section
      className="panel telemetry-panel"
      aria-label="Telemetri ve görev olayları"
    >
      <div className="api-controls">
        <h2>Telemetri ve görev olayları</h2>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
          Telemetriyi yenile
        </button>
      </div>
      <p>
        {mission.source === "simulated"
          ? "SENTETİK TELEMETRİ · fiziksel cihaz değil."
          : "Cihaz tarafından bildirilen durum; fiziksel doğrulama değildir."}{" "}
        Motor komutu gönderilmez.
      </p>
      <p>
        5 saniyede bir okunur. 15/60 saniye eşikleri geçici yazılım
        tercihleridir; bağlantı kesildiğinin fiziksel kanıtı değildir.
      </p>
      {state.loading && <p role="status">Telemetri yükleniyor…</p>}
      {state.error && (
        <p className="notice warning" role="alert">
          Telemetri API erişimi doğrulanamadı. {state.error} Son başarılı
          kayıtlar korunuyor; güncel kabul etmeyin.
        </p>
      )}
      {state.data && (
        <>
          <p>
            Sunucu değerlendirme zamanı:{" "}
            {timestamp(state.data.telemetry.server_time)}
          </p>
          {!state.data.telemetry.items.length && (
            <p>Henüz telemetri yok. Cihaz durumu bilinmiyor.</p>
          )}
          <div className="telemetry-devices">
            {state.data.telemetry.items.map((report) => {
              const status = reportStatus(report, elapsed);
              const usable = report.validity === "valid";
              return (
                <article className="telemetry-device" key={report.device_id}>
                  <h3>{report.device_id}</h3>
                  <p
                    className={`notice ${state.error ? "warning" : status.tone}`}
                  >
                    {state.error
                      ? "API erişimi yok · son bilinen rapor"
                      : status.label}
                    {status.age !== null &&
                      ` · rapor yaşı ${Math.floor(status.age)} sn`}
                  </p>
                  <p>
                    {usable
                      ? "Cihaz raporu: geçerli"
                      : "Cihaz raporu: geçersiz · alanlar kullanılmıyor"}{" "}
                    · {report.validity_reason}
                  </p>
                  <dl className="api-details">
                    <dt>Son bildirilen vinç aşaması</dt>
                    <dd>
                      {usable
                        ? STAGES[report.winch_stage] || "Bilinmiyor"
                        : "Bilinmiyor"}
                    </dd>
                    <dt>Hedef / gerçek derinlik</dt>
                    <dd>
                      {usable
                        ? `${depthText(report.target_depth_m)} / ${depthText(report.actual_depth_m)}`
                        : "Bilinmiyor"}
                    </dd>
                    <dt>İstasyon</dt>
                    <dd>
                      {usable
                        ? report.station_id || "Bilinmiyor"
                        : "Bilinmiyor"}
                    </dd>
                    <dt>Hata kodu</dt>
                    <dd>{report.error_code || "Bildirilmedi"}</dd>
                    <dt>Cihaz zamanı</dt>
                    <dd>{timestamp(report.observed_at)}</dd>
                    <dt>Sunucu alım zamanı</dt>
                    <dd>{timestamp(report.received_at)}</dd>
                    <dt>Oturum / sıra</dt>
                    <dd className="telemetry-id">
                      {report.session_id} / {report.sequence}
                    </dd>
                  </dl>
                  <details>
                    <summary>Orijinal telemetri kaydı ve konum</summary>
                    <pre className="api-json">
                      {JSON.stringify(report, null, 2)}
                    </pre>
                  </details>
                </article>
              );
            })}
          </div>
          <h3>Görev olayları</h3>
          <p>
            Son {state.data.events.items.length} / {state.data.events.total}{" "}
            olay · cihaz zamanına göre en yeni önce. Olaylar telemetri
            güncelliğini yenilemez.
          </p>
          {!state.data.events.items.length && <p>Henüz görev olayı yok.</p>}
          <ol className="telemetry-events">
            {state.data.events.items.map((event) => (
              <li key={event.id}>
                <strong>
                  {event.severity} · {event.kind}
                </strong>{" "}
                — {event.message}
                <div>
                  {event.device_id} · {timestamp(event.observed_at)} ·{" "}
                  {event.source === "simulated" ? "Sentetik" : "Cihaz"}
                </div>
                {event.station_id && <div>İstasyon: {event.station_id}</div>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
