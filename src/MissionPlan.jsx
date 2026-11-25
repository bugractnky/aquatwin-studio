import React, { useEffect, useMemo, useState } from "react";
import PlanEditor from "./PlanEditor.jsx";
import { comparePlan, planningRequest } from "./planning.js";

export default function MissionPlan({
  mission,
  records,
  measurementsReady,
  operator,
}) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [attempt, setAttempt] = useState(0),
    [editing, setEditing] = useState(null),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function load() {
      try {
        const data = await planningRequest(`/missions/${mission.id}/plan`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted)
          setState({ loading: false, data, error: "" });
      } catch (e) {
        if (!controller.signal.aborted)
          setState((old) => ({ ...old, loading: false, error: e.message }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(load, 5000);
      }
    }
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [mission.id, attempt]);
  const comparison = useMemo(
    () => comparePlan(state.data?.plan, records),
    [state.data, records],
  );
  return (
    <section
      className="panel mission-plan"
      aria-label="Kaydedilmiş görev planı"
    >
      <div className="plan-actions">
        <h2>Ölçüm planı</h2>
        <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
          Planı yenile
        </button>
      </div>
      {state.loading && <p role="status">Plan yükleniyor…</p>}
      {state.error && (
        <p role="alert" className="notice warning">
          {state.error} Son okunan plan güncel olmayabilir; düzenleme kapalı.
        </p>
      )}
      {saved && <p role="status">Plan kaydedildi.</p>}
      {state.data && (
        <>
          <p>
            {state.data.plan
              ? `Plan sürümü ${state.data.revision} · ${state.data.plan.stations.length} istasyon`
              : "Bu görev için kaydedilmiş bir plan yok. Önceki ölçümler korunur."}
          </p>
          {state.data.locked ? (
            <p>
              Plan kilitli: ölçüm kaydı veya ayrılmış simülasyon çalışması var. Farklı plan için yeni
              görev oluşturun.
            </p>
          ) : (
            operator.session.authenticated && (
              <button
                className="btn"
                disabled={Boolean(state.error)}
                onClick={() => {
                  setEditing(state.data);
                  setSaved(false);
                }}
              >
                {state.data.plan ? "Planı düzenle" : "Bu göreve plan ekle"}
              </button>
            )
          )}
          {state.data.plan && (
            <>
              <p>
                Bu plan fiziksel bir hareket başlatmaz. Kayıt eşleştirmesi
                istasyon kimliği ve hedef derinliğe göredir; konum ve derinlik
                doğruluğu onayı değildir.
              </p>
              {!measurementsReady && (
                <p className="notice warning">
                  Ölçümler güncel olarak alınamadı; aşağıdaki kayıt
                  karşılaştırması doğrulanamadı.
                </p>
              )}
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Plan ve ölçüm karşılaştırması"
              >
                <table>
                  <caption>Planlanan hedefler ve kayıt durumu</caption>
                  <thead>
                    <tr>
                      <th>İstasyon</th>
                      <th>Planlanan konum</th>
                      <th>Hedef derinlik</th>
                      <th>Kayıt durumu</th>
                      <th>Ölçülen derinlikler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.targets.map((t) => (
                      <tr key={`${t.station.station_id}-${t.depth}`}>
                        <th scope="row">
                          {t.station.station_id} · {t.station.name}
                        </th>
                        <td>
                          {t.station.position.local_x_m != null
                            ? `x ${t.station.position.local_x_m}, kuzey ${t.station.position.local_north_m} m · ${t.station.position.reference_id}`
                            : `${t.station.position.latitude}, ${t.station.position.longitude} · WGS84`}
                        </td>
                        <td>{t.depth} m</td>
                        <td>
                          {measurementsReady ? t.status : "Doğrulanamadı"}
                          {t.matches.length > 0 &&
                            ` · ${t.matches.length} kayıt`}
                        </td>
                        <td>
                          {t.matches.length
                            ? t.matches.map((r) => `${r.depth} m`).join(", ")
                            : "Henüz yok"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {comparison.unplanned.length > 0 && (
                <p>
                  {comparison.unplanned.length} ölçüm plan hedefleriyle
                  eşleşmiyor; kayıt tablosunda korunuyor.
                </p>
              )}
            </>
          )}
        </>
      )}
      {editing && (
        <PlanEditor
          mission={mission}
          currentPlan={editing}
          csrf={operator.session.csrf_token}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSaved(true);
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
