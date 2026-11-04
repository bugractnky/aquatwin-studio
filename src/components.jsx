import React, { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  PARAMS,
  STATIONS,
  targets,
  filterRecords,
  csv,
  accepted,
} from "./model.js";

function usePlotWidth() {
  const ref = useRef(null),
    [width, setWidth] = useState(440);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setWidth(Math.max(240, Math.round(w)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function Badge({ quality = "ok", children }) {
  return (
    <span
      className={`badge ${quality === "ok" ? "ok" : quality === "unstable" ? "warning" : "neutral"}`}
    >
      {quality === "ok" ? (
        <CheckCircle2 size={15} />
      ) : quality === "unstable" ? (
        <AlertTriangle size={15} />
      ) : null}
      {children || (quality === "ok" ? "Geçerli" : "Kararsız")}
    </span>
  );
}
export function downloadRecords(rows, name = "aquatwin") {
  const url = URL.createObjectURL(
    new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Dialog({ title, children, onClose, className = "" }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    const close = (e) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", close);
    return () => {
      d.removeEventListener("cancel", close);
      if (d.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-btn"
          aria-label="Pencereyi kapat"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Profile({ records, param, station }) {
  const [plotRef, plotWidth] = usePlotWidth();
  const rows = accepted(records)
      .filter((r) => r.station === station)
      .sort((a, b) => a.depth - b.depth),
    st = STATIONS.find((s) => s.id === station),
    p = PARAMS[param],
    W = plotWidth,
    H = 235,
    L = 48,
    R = 25,
    T = 25,
    B = 42;
  const X = (v) => L + ((v - p.min) / (p.max - p.min)) * (W - L - R),
    Y = (d) => T + (d / Math.ceil(st.bottom)) * (H - T - B);
  return (
    <section className="panel profile-panel">
      <div className="panel-head">
        <div>
          <h2>Dikey profil · {station}</h2>
          <p>
            {p.label} / derinlik · {rows.length}/{targets(st).length} hedef
            ölçüldü
          </p>
        </div>
        <span className="chip">Dip: {st.bottom.toFixed(1)} m</span>
      </div>
      <svg
        ref={plotRef}
        viewBox={`0 0 ${W} ${H}`}
        className="profile-svg"
        role="img"
        aria-label={`${station} istasyonu profili. ${rows.map((r) => `${r.depth} metre: ${r[param]} ${p.unit}`).join("; ") || "Henüz veri yok"}.`}
      >
        {Array.from({ length: Math.ceil(st.bottom) + 1 }, (_, d) => (
          <g key={d}>
            <line x1={L} x2={W - R} y1={Y(d)} y2={Y(d)} className="plot-grid" />
            <text x={L - 12} y={Y(d) + 4} textAnchor="end">
              {d} m
            </text>
          </g>
        ))}
        {(W < 380 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((t) => (
          <g key={t}>
            <line
              x1={X(p.min + t * (p.max - p.min))}
              x2={X(p.min + t * (p.max - p.min))}
              y1={T}
              y2={H - B}
              className="plot-grid"
            />
            <text
              x={X(p.min + t * (p.max - p.min))}
              y={H - 17}
              textAnchor="middle"
            >
              {(p.min + t * (p.max - p.min)).toFixed(param === "ec" ? 0 : 1)}
            </text>
          </g>
        ))}
        <polyline
          points={rows.map((r) => `${X(r[param])},${Y(r.depth)}`).join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        {rows.map((r) => (
          <g key={r.id}>
            <circle
              cx={X(r[param])}
              cy={Y(r.depth)}
              r="5"
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <text
              x={X(r[param]) + 10}
              y={Y(r.depth) - 9}
              className="plot-value"
            >
              {r[param].toFixed(p.digits)}
            </text>
          </g>
        ))}
        {!rows.length && (
          <text x={W / 2} y={H / 2} textAnchor="middle">
            Bu istasyonda henüz ölçüm yok
          </text>
        )}
      </svg>
      <div className="panel-foot">
        Noktalar ölçümdür; çizgi yalnızca noktaları birleştirir. Yatay eksen:{" "}
        {p.label} {p.unit && `(${p.unit})`}. Derinlik aşağı doğru artar.
      </div>
    </section>
  );
}
export function RecordDetail({ record: r, onClose }) {
  return (
    <Dialog
      title={`${r.station} · ${r.depth.toFixed(1)} m ölçümü`}
      onClose={onClose}
      className="record-dialog"
    >
      <div className="detail-body">
        <div className="detail-top">
          <Badge quality={r.quality} />
          <span className="chip">{r.mission}</span>
        </div>
        <p className="record-id">{r.id}</p>
        <dl className="detail-grid">
          <div>
            <dt>Ölçüm zamanı</dt>
            <dd>
              {new Date(r.time).toLocaleString("tr-TR", {
                timeZone: "Europe/Istanbul",
              })}{" "}
              TRT
            </dd>
          </div>
          <div>
            <dt>Konum (yerel metre)</dt>
            <dd>
              x {r.x} · kuzey {r.z}
            </dd>
          </div>
          <div>
            <dt>Sensör / örnek</dt>
            <dd>
              {r.sensor} · {r.n} örnek
            </dd>
          </div>
          <div>
            <dt>DO standart sapması</dt>
            <dd>{r.do_sd.toFixed(2)} mg/L</dd>
          </div>
        </dl>
        <div className={`notice ${r.quality === "ok" ? "info" : "warning"}`}>
          <strong>
            {r.quality === "ok"
              ? "Kalite kontrolü geçti"
              : "Modelden hariç tutuldu"}
          </strong>
          <p>{r.reason}</p>
        </div>
        <h3>Sensör değerleri</h3>
        <div className="sensor-grid">
          {Object.entries(PARAMS).map(([k, p]) => (
            <div key={k}>
              <span>{p.label}</span>
              <strong>
                {r[k].toFixed(p.digits)} <small>{p.unit}</small>
              </strong>
            </div>
          ))}
        </div>
        <h3>Ham DO penceresi</h3>
        <RawChart raw={r.raw} mean={r.do} />
        <p className="caption">
          30 sentetik örnek · örnek indisleri, gerçek cihaz akışı değil.
        </p>
        <details>
          <summary>Ham örnek tablosunu göster</summary>
          <div className="raw-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Örnek</th>
                  <th scope="col">DO (mg/L)</th>
                  <th scope="col">Sıcaklık (°C)</th>
                </tr>
              </thead>
              <tbody>
                {r.raw?.map((v, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{v.do}</td>
                    <td>{v.temp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <h3>Kalibrasyon</h3>
        <p>{r.calibration}</p>
        <p className="caption">
          Değerler ve kalibrasyon metaverisi simülasyondur. Saha doğrulaması
          yapılmamıştır.
        </p>
      </div>
      <div className="dialog-actions">
        <button className="btn" onClick={() => downloadRecords([r], r.id)}>
          <Download size={17} />
          Bu kaydı indir
        </button>
        <button className="btn primary" onClick={onClose}>
          Kapat
        </button>
      </div>
    </Dialog>
  );
}
function RawChart({ raw = [], mean }) {
  const [plotRef, width] = usePlotWidth();
  const min = Math.min(...raw.map((r) => r.do), mean) - 0.1,
    max = Math.max(...raw.map((r) => r.do), mean) + 0.1;
  return (
    <svg
      ref={plotRef}
      viewBox={`0 0 ${width} 150`}
      role="img"
      aria-label={`Ham DO değerleri ${min.toFixed(2)} ile ${max.toFixed(2)} mg/L arasında.`}
      className="raw-chart"
    >
      <text x="4" y="17">
        {max.toFixed(2)}
      </text>
      <text x="4" y="126">
        {min.toFixed(2)}
      </text>
      <line x1="53" x2={width - 10} y1="130" y2="130" className="plot-grid" />
      <polyline
        points={raw
          .map(
            (r, i) =>
              `${53 + (i / Math.max(1, raw.length - 1)) * (width - 63)},${20 + ((max - r.do) / (max - min)) * 105}`,
          )
          .join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
    </svg>
  );
}
export function RecordsTable({
  records,
  filters,
  setFilters,
  onSelect,
  selectedId,
  notify,
  missionName,
}) {
  const rows = filterRecords(records, filters),
    sortKey = filters.sort || "time",
    dir = filters.direction || "desc";
  function sort(k) {
    setFilters({
      ...filters,
      sort: k,
      direction: sortKey === k && dir === "asc" ? "desc" : "asc",
    });
  }
  const heads = [
    ["station", "İstasyon"],
    ["time", "Zaman · TRT"],
    ["depth", "Derinlik"],
    ["temp", "Sıcaklık"],
    ["ph", "pH"],
    ["do", "DO"],
    ["ec", "İletkenlik"],
    ["turb", "Bulanıklık"],
    ["quality", "Kalite"],
  ];
  return (
    <section className="panel records-panel">
      <div className="panel-head">
        <div>
          <h2>
            Ölçüm kayıtları{" "}
            <span className="chip">
              {rows.length}/{records.length}
            </span>
          </h2>
          <p>
            Bir kaydı açarak ham pencereyi, kalibrasyonu ve kalite nedenini
            inceleyin.
          </p>
        </div>
        <button
          className="btn"
          onClick={() => {
            downloadRecords(rows, `${missionName}-filtreli`);
            notify(`${rows.length} filtrelenmiş kayıt indirildi.`);
          }}
          disabled={!rows.length}
        >
          <Download size={17} />
          {rows.length} kaydı indir
        </button>
      </div>
      <div className="table-filters">
        <label>
          Ölçüm ara
          <input
            type="search"
            value={filters.query || ""}
            placeholder="İstasyon, kayıt veya derinlik"
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
        </label>
        <label>
          İstasyon
          <select
            value={filters.station || "all"}
            onChange={(e) =>
              setFilters({ ...filters, station: e.target.value })
            }
          >
            <option value="all">Tüm istasyonlar</option>
            {STATIONS.map((s) => (
              <option key={s.id}>{s.id}</option>
            ))}
          </select>
        </label>
        <label>
          Derinlik
          <select
            value={filters.depth || "all"}
            onChange={(e) => setFilters({ ...filters, depth: e.target.value })}
          >
            <option value="all">Tüm derinlikler</option>
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d} m
              </option>
            ))}
          </select>
        </label>
        <label>
          Kalite
          <select
            value={filters.quality || "all"}
            onChange={(e) =>
              setFilters({ ...filters, quality: e.target.value })
            }
          >
            <option value="all">Tüm durumlar</option>
            <option value="ok">Geçerli</option>
            <option value="unstable">Kararsız</option>
          </select>
        </label>
        <button className="btn subtle" onClick={() => setFilters({})}>
          Filtreleri temizle
        </button>
      </div>
      <div
        className="table-wrap"
        tabIndex="0"
        role="region"
        aria-label="Yatay kaydırılabilir ölçüm tablosu"
      >
        <table>
          <caption className="sr-only">
            {missionName}: {rows.length} filtrelenmiş ölçüm. Kayıt aç düğmesi
            ayrıntıları gösterir.
          </caption>
          <thead>
            <tr>
              {heads.map(([k, label]) => (
                <th
                  key={k}
                  scope="col"
                  aria-sort={
                    sortKey === k
                      ? dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => sort(k)}>
                    {label}
                    {sortKey === k ? (
                      dir === "asc" ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
              <th scope="col">Ayrıntı</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={r.id === selectedId ? "row-selected" : ""}
              >
                <th scope="row">{r.station}</th>
                <td>
                  {new Date(r.time).toLocaleTimeString("tr-TR", {
                    timeZone: "Europe/Istanbul",
                  })}
                </td>
                <td>{r.depth.toFixed(1)} m</td>
                <td>{r.temp.toFixed(1)} °C</td>
                <td>{r.ph.toFixed(2)}</td>
                <td>{r.do.toFixed(2)} mg/L</td>
                <td>{r.ec} µS/cm</td>
                <td>{r.turb.toFixed(1)} NTU</td>
                <td>
                  <Badge quality={r.quality} />
                </td>
                <td>
                  <button
                    className="btn small"
                    aria-label={`${r.station} ${r.depth} metre ${r.id} kaydını aç`}
                    onClick={() => onSelect(r)}
                  >
                    Kaydı aç
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty-state">
          <strong>Eşleşen ölçüm bulunamadı</strong>
          <p>
            Bu filtrelerde {filters.quality === "unstable" ? "kararsız " : ""}
            kayıt yok. Filtreleri temizleyerek bütün ölçümlere dönebilirsiniz.
          </p>
        </div>
      )}
      <div className="panel-foot">
        Saatler Türkiye saati (UTC+3); CSV zamanları ISO UTC olarak korunur.
        Kararsız ölçümler interpolasyona katılmaz.
      </div>
    </section>
  );
}
