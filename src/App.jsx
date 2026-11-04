import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  Waves,
  Navigation,
  ChartNoAxesCombined,
  Database,
  History,
  Settings2,
  Play,
  Pause,
  RotateCcw,
  Download,
  Sun,
  Moon,
  Check,
  AlertTriangle,
  Wifi,
  WifiOff,
  Anchor,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Focus,
  CircleHelp,
  ShieldCheck,
  MoveDown,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import { useMission } from "./useMission";
import {
  PARAMS,
  STATIONS,
  HISTORY,
  TOTAL,
  INITIAL_RECORDS,
  initialMission,
  PHASES,
  SETTLE,
  WINDOW,
  targets,
  accepted,
  completedStations,
  remainingSeconds,
  crossValidate,
  recommendations,
  legendStops,
} from "./model.js";
import {
  Badge,
  Dialog,
  Profile,
  RecordDetail,
  RecordsTable,
  downloadRecords,
} from "./components.jsx";
const Twin = lazy(() => import("./Twin.jsx"));
function savedSetting(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function useReducedMotion() {
  const [system, setSystem] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [manual, setManual] = useState(() =>
      savedSetting("aquatwin-motion", false),
    );
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)"),
      f = () => setSystem(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return [
    system || manual,
    manual,
    (value) => {
      setManual(value);
      try {
        localStorage.setItem("aquatwin-motion", JSON.stringify(value));
      } catch {}
    },
    system,
  ];
}
export default function App() {
  const live = useMission();
  const menuButton = useRef(null),
    sidebarRef = useRef(null);
  const [page, setPage] = useState("live"),
    [theme, setTheme] = useState(() => savedSetting("aquatwin-theme", "light")),
    [reducedMotion, manualMotion, setManualMotion, systemMotion] =
      useReducedMotion(),
    [menu, setMenu] = useState(false),
    [param, setParam] = useState("do"),
    [depth, setDepth] = useState(2),
    [view, setView] = useState("3d"),
    [layer, setLayer] = useState("points"),
    [mode, setMode] = useState("value"),
    [station, setStation] = useState("S03"),
    [follow, setFollow] = useState(true),
    [selectedRecord, setSelectedRecord] = useState(null),
    [detail, setDetail] = useState(null),
    [confirmation, setConfirmation] = useState(null),
    [filters, setFilters] = useState({}),
    [toast, setToast] = useState(""),
    [cameraCommand, setCameraCommand] = useState(null),
    [archive, setArchive] = useState("M011"),
    [replay, setReplay] = useState(100),
    [replaying, setReplaying] = useState(false),
    [threshold, setThreshold] = useState(5);
  useEffect(() => {
    if (!menu) return;
    const side = sidebarRef.current;
    const items = [...side.querySelectorAll("button,a[href]")].filter(
      (el) => el.getClientRects().length,
    );
    items[0]?.focus();
    const handler = (e) => {
      if (e.key === "Escape") {
        setMenu(false);
        return;
      }
      if (e.key === "Tab") {
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      menuButton.current?.focus();
    };
  }, [menu]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("aquatwin-theme", JSON.stringify(theme));
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (follow) setStation(STATIONS[live.mission.stationIndex].id);
  }, [follow, live.mission.stationIndex]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (page !== "history") setReplaying(false);
  }, [page]);
  useEffect(() => {
    if (!replaying) return;
    const id = setInterval(
      () =>
        setReplay((v) => {
          if (v >= 100) {
            setReplaying(false);
            return 100;
          }
          return Math.min(100, v + 4);
        }),
      500,
    );
    return () => clearInterval(id);
  }, [replaying]);
  const historic = HISTORY.find((m) => m.id === archive),
    isHistory = page === "history";
  const records = isHistory
    ? historic.records.slice(
        0,
        Math.round((historic.records.length * replay) / 100),
      )
    : live.records;
  const ok = useMemo(() => accepted(records), [records]),
    active = STATIONS[live.mission.stationIndex],
    selected = STATIONS.find((s) => s.id === station),
    p = PARAMS[param];
  const low = ok.filter((r) => r.do < threshold),
    bad = records.filter((r) => r.quality !== "ok"),
    rmse = useMemo(() => crossValidate(records, param), [records, param]),
    recs = useMemo(() => recommendations(records), [records]);
  const blocked = live.scenario === "link" || live.scenario === "winch",
    wait = remainingSeconds(live.mission),
    phase = live.mission.completed
      ? live.mission.aborted
        ? "İptal edildi · sensör toplandı"
        : "Görev tamamlandı"
      : blocked
        ? live.scenario === "link"
          ? "Bağlantı kesildi"
          : "Vinç hatası"
        : live.mission.phase === "review"
          ? "Kararsız ölçüm · tekrar gerekli"
          : live.running
            ? PHASES[live.mission.phase]
            : live.mission.phase === "ready"
              ? "Başlatılmaya hazır"
              : "Duraklatıldı";
  function navigate(value) {
    setPage(value);
    setMenu(false);
    setDetail(null);
    setFilters({});
    if (value === "analysis") {
      setLayer("slice");
      setMode("value");
    }
    if (value === "live") setLayer("points");
  }
  function selectStation(id) {
    setStation(id);
    setFollow(false);
    setSelectedRecord(null);
  }
  function selectRecord(row) {
    selectStation(row.station);
    setDepth(row.depth);
    setSelectedRecord(row);
    setDetail(row);
  }
  function command(action) {
    setCameraCommand({ action, id: Date.now() });
  }
  function reset() {
    live.reset();
    setFollow(true);
    setSelectedRecord(null);
    setDetail(null);
    setStation("S03");
    setConfirmation(null);
    setToast("Yeni demo hazır. S01–S02 başlangıç ölçümleri yüklendi.");
  }
  const mainAction = live.mission.completed
    ? "Yeni demo"
    : live.running
      ? "Duraklat"
      : live.mission.phase === "ready"
        ? "Demoyu başlat"
        : "Devam et";
  const tabs = [
    ["live", Navigation, "Canlı görev"],
    ["analysis", ChartNoAxesCombined, "Analiz"],
    ["data", Database, "Ölçüm kayıtları"],
    ["history", History, "Görev geçmişi"],
  ];
  const sceneMission = isHistory
    ? {
        ...initialMission(),
        stationIndex: Math.min(4, Math.floor((replay / 100) * 5)),
        depth: 0,
        phase: "ready",
      }
    : live.mission;
  const selectedInfo = ok.filter((r) => r.station === station);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Ana içeriğe geç
      </a>
      <aside
        ref={sidebarRef}
        className={`sidebar ${menu ? "opened" : ""}`}
        aria-label="Ana gezinme"
      >
        <a
          className="brand"
          href="#main-content"
          onClick={() => navigate("live")}
        >
          <span>
            <Waves size={26} />
          </span>
          <strong>
            Aqua<span>Twin</span>
          </strong>
        </a>
        <button
          className="mobile-close icon-btn"
          aria-label="Menüyü kapat"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="workspace">
          <span>METU NCC</span>
          <strong>Gölet Araştırma Alanı</strong>
          <small>Bot + vinç · ESC 491 / 492</small>
        </div>
        <span className="nav-caption">ÇALIŞMA ALANI</span>
        <nav>
          {tabs.map(([key, Icon, label]) => (
            <button
              key={key}
              aria-current={page === key ? "page" : undefined}
              className={page === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="simulation-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Simülasyon ortamı</strong>
              <small>Fiziksel cihaza komut göndermez.</small>
            </div>
          </div>
          <button
            className={
              page === "settings" ? "nav-setting active" : "nav-setting"
            }
            onClick={() => navigate("settings")}
            aria-current={page === "settings" ? "page" : undefined}
          >
            <Settings2 size={19} />
            Ayarlar ve senaryolar
          </button>
          <a
            className="research-link"
            href="https://doi.org/10.1371/journal.pone.0199239"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={17} />
            Bilimsel renk skalası ↗
          </a>
          <small className="version">AquaTwin Studio · v0.2</small>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="app-header">
          <div className="header-title">
            <button
              ref={menuButton}
              className="icon-btn mobile-menu"
              aria-label="Menüyü aç"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span>
              METU NCC <span className="slash">/</span>{" "}
              <strong>
                {page === "settings"
                  ? "Ayarlar"
                  : tabs.find((t) => t[0] === page)?.[2]}
              </strong>
            </span>
          </div>
          <div className="header-actions">
            <span className="demo-badge">SENTETİK VERİ</span>
            <button
              className="btn theme-btn"
              aria-label={`${theme === "light" ? "Koyu" : "Açık"} temaya geç`}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === "light" ? "Koyu tema" : "Açık tema"}</span>
            </button>
          </div>
        </header>
        <div
          className={`mission-status ${blocked ? "status-error" : ""}`}
          role="region"
          aria-label="Sürekli görünür görev durumu"
        >
          <div className="status-id">
            <span className={`status-dot ${live.running ? "running" : ""}`} />
            <strong>M012</strong>
            <span className="status-text">{phase}</span>
          </div>
          <div className="status-facts">
            <span>
              <Navigation size={15} />
              <b>{active.id}</b> aktif
            </span>
            <span>
              <Anchor size={15} />
              <b>{live.mission.depth.toFixed(1)} m</b> / {live.mission.target} m
            </span>
            <span className={live.age > 5 ? "warning-text" : ""}>
              {live.scenario === "link" ? (
                <WifiOff size={15} />
              ) : (
                <Wifi size={15} />
              )}
              Son telemetri: {live.age} sn
            </span>
          </div>
        </div>
        <main id="main-content" tabIndex="-1">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                {isHistory
                  ? "ZAMAN BOYUTUNDA İNCELEME"
                  : page === "analysis"
                    ? "ÖLÇÜMDEN MEKÂNSAL TAHMİNE"
                    : "SU KALİTESİ İZLEME"}
              </div>
              <h1>
                {
                  {
                    live: "Görev kontrolü",
                    analysis: "Gölet analizi",
                    data: "Ölçüm kayıtları",
                    history: "Görev geçmişi",
                    settings: "Ayarlar ve test senaryoları",
                  }[page]
                }
              </h1>
              <p>
                {
                  {
                    live: "Botu, vinci ve ölçüm kalitesini tek yerde izleyin.",
                    analysis:
                      "Derinlikleri karşılaştırın; ölçülen ve tahmin edilen alanları ayırın.",
                    data: "Ham veriye, kalite bilgisine ve kalibrasyon metaverisine erişin.",
                    history:
                      "Tamamlanmış sentetik görevleri zaman sırasıyla inceleyin.",
                    settings:
                      "Görünümü düzenleyin ve kontrollü hata senaryolarını deneyin.",
                  }[page]
                }
              </p>
            </div>
            {page === "live" && (
              <div className="primary-actions">
                <button
                  className="btn primary"
                  disabled={blocked || live.mission.phase === "review"}
                  onClick={() =>
                    live.mission.completed
                      ? setConfirmation("reset")
                      : live.toggle()
                  }
                >
                  {live.mission.completed ? (
                    <RotateCcw size={18} />
                  ) : live.running ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} />
                  )}{" "}
                  {mainAction}
                </button>
                {!live.mission.completed && (
                  <button
                    className="btn"
                    onClick={() => setConfirmation("abort")}
                  >
                    İptal et ve sensörü topla
                  </button>
                )}
              </div>
            )}
          </div>
          {(blocked ||
            live.mission.phase === "review" ||
            live.storageError) && (
            <section className="notice error" role="alert">
              <AlertTriangle size={22} />
              <div>
                <strong>{live.storageError || phase}</strong>
                <p>
                  {live.storageError
                    ? "Görünüm açık olduğu sürece kayıtlar korunur; yenilemeden önce dışa aktarın."
                    : live.scenario === "link"
                      ? "Son bilinen değerler donduruldu. Görüntülenen derinlik güncel olmayabilir. Bu demo senaryosunda akış durduruldu."
                      : live.scenario === "winch"
                        ? "Vinç hareketi durduruldu. Hata giderilmeden devam edilemez."
                        : "Kararsız kayıt saklandı ve modelden çıkarıldı. Aynı derinlikte yeniden ölçüm alın."}
                </p>
              </div>
              {blocked ? (
                <button className="btn" onClick={live.recover}>
                  Demoda hatayı gider
                </button>
              ) : live.mission.phase === "review" ? (
                <button className="btn" onClick={live.retry}>
                  Aynı derinlikte tekrar ölç
                </button>
              ) : null}
            </section>
          )}
          {page === "settings" ? (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Görünüm ve erişilebilirlik</h2>
                    <p>Tercihler bu tarayıcıda saklanır.</p>
                  </div>
                </div>
                <div className="settings-body">
                  <label>
                    Tema
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                    >
                      <option value="light">Açık · saha ve gündüz</option>
                      <option value="dark">Koyu · düşük ışık</option>
                    </select>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={manualMotion}
                      onChange={(e) => setManualMotion(e.target.checked)}
                    />
                    Dekoratif hareketleri azalt
                  </label>
                  <p className="caption">
                    Sistem tercihi:{" "}
                    {systemMotion ? "hareket azaltma açık" : "standart"}. Ölçüm
                    konumu her iki durumda da güncellenir; yalnızca dekoratif
                    salınım ve geçişler azaltılır.
                  </p>
                  <label>
                    Demo hızı
                    <select
                      value={live.speed}
                      onChange={(e) => live.setSpeed(+e.target.value)}
                    >
                      <option value="1">1× demo</option>
                      <option value="3">3× demo</option>
                      <option value="8">8× demo</option>
                    </select>
                  </label>
                  <p className="caption">
                    {SETTLE} sn stabilizasyon + {WINDOW} sn ölçüm,
                    hızlandırılmış gösterim içindir. Gerçek prob süreleri
                    değildir.
                  </p>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Hata senaryoları</h2>
                    <p>Yalnızca simülasyon davranışını değiştirir.</p>
                  </div>
                </div>
                <div className="settings-body">
                  <label>
                    Test senaryosu
                    <select
                      value={live.scenario}
                      onChange={(e) => live.changeScenario(e.target.value)}
                    >
                      <option value="normal">Normal çalışma</option>
                      <option value="link">Bağlantı kesilmesi</option>
                      <option value="winch">Vinç hatası</option>
                      <option value="unstable">
                        Bir sonraki ölçüm kararsız
                      </option>
                    </select>
                  </label>
                  <label>
                    DO dikkat eşiği (mg/L)
                    <input
                      type="number"
                      min="0"
                      max="12"
                      step=".5"
                      value={threshold}
                      onChange={(e) =>
                        setThreshold(Math.max(0, Math.min(12, +e.target.value)))
                      }
                    />
                  </label>
                  <p className="caption">
                    Bu eşik demo amaçlıdır; gölete, türe veya mevzuata göre
                    doğrulanmış bir limit değildir.
                  </p>
                  <button
                    className="btn danger"
                    onClick={() => setConfirmation("reset")}
                  >
                    <RotateCcw size={17} />
                    Demo kayıtlarını sıfırla
                  </button>
                </div>
              </section>
              <section className="panel settings-wide">
                <div className="panel-head">
                  <h2>Veri ve model sınırları</h2>
                </div>
                <div className="settings-body">
                  <p>
                    Gölet geometrisi, batimetri, koordinatlar, telemetri, ham
                    pencereler ve tarihsel görevler sentetiktir. Gerçek gölet
                    araştırması veya donanım bağlantısı bulunmaz.
                  </p>
                  <p>
                    Analiz katmanında IDW (ters mesafe ağırlıklandırma)
                    kullanılır. Derinlik farkı mesafede 8× ağırlıklandırılır. Bu
                    katsayı demo tercihidir; saha verisiyle ayarlanmalıdır.
                    Örnekleme uzaklığı güven aralığı veya hata olasılığı
                    değildir. GP/kriging uygulanmamıştır.
                  </p>
                  <p>
                    Veriler bu tarayıcıda yerel olarak saklanır. Yenilemeden
                    sonra görev duraklatılarak geri yüklenir. Dışa aktarma,
                    filtrelenmiş kayıtların kapsamını açıkça gösterir.
                  </p>
                </div>
              </section>
            </div>
          ) : (
            <>
              {isHistory && (
                <section className="panel history-controls">
                  <label>
                    Görev
                    <select
                      value={archive}
                      onChange={(e) => {
                        setArchive(e.target.value);
                        setReplay(100);
                        setReplaying(false);
                      }}
                    >
                      {HISTORY.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} · {m.date} · {m.kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn"
                    onClick={() => {
                      if (replay >= 100) setReplay(0);
                      setReplaying((v) => !v);
                    }}
                  >
                    {replaying ? <Pause size={17} /> : <Play size={17} />}{" "}
                    {replaying ? "Replay duraklat" : "Ölçümleri oynat"}
                  </button>
                  <label className="replay-range">
                    Kayıt sırası · %{replay}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={replay}
                      onChange={(e) => {
                        setReplay(+e.target.value);
                        setReplaying(false);
                      }}
                    />
                  </label>
                  <div className="step-buttons">
                    <button
                      className="btn"
                      aria-label="Replay geri"
                      onClick={() => setReplay((v) => Math.max(0, v - 10))}
                    >
                      −10%
                    </button>
                    <button
                      className="btn"
                      aria-label="Replay ileri"
                      onClick={() => setReplay((v) => Math.min(100, v + 10))}
                    >
                      +10%
                    </button>
                  </div>
                  <p>
                    Replay, kayıtları zaman sırasıyla açar; tarihsel gerçek bot
                    rotası değildir. Üst durum şeridi mevcut M012 demosunu
                    gösterir.
                  </p>
                </section>
              )}
              {page === "data" ? (
                <RecordsTable
                  records={records}
                  filters={filters}
                  setFilters={setFilters}
                  onSelect={selectRecord}
                  selectedId={selectedRecord?.id}
                  notify={setToast}
                  missionName="M012"
                />
              ) : (
                <>
                  <div className="metrics-row">
                    <Metric
                      label="Geçerli ölçüm"
                      value={`${ok.length}`}
                      unit={`/ ${TOTAL}`}
                      text={`${bad.length} kararsız kayıt model dışında`}
                    />
                    <Metric
                      label="Tamamlanan istasyon"
                      value={`${completedStations(records)}`}
                      unit="/ 5"
                      text={
                        isHistory
                          ? "Tarihsel görev görünümü"
                          : "Kapsama · görev bitişinden farklıdır"
                      }
                    />
                    <Metric
                      label="En düşük oksijen"
                      value={
                        ok.length
                          ? Math.min(...ok.map((r) => r.do)).toFixed(2)
                          : "—"
                      }
                      unit="mg/L"
                      text={
                        ok.length
                          ? low.length
                            ? `${low.length} ölçüm demo eşiğinin altında`
                            : "Mevcut örneklerde eşik aşımı yok"
                          : "Değerlendirme için henüz ölçüm yok"
                      }
                      warning={!!low.length}
                    />
                  </div>
                  <div className="workspace-grid">
                    <section className="panel twin-panel">
                      <div className="panel-head">
                        <div>
                          <h2>
                            {page === "live"
                              ? "Bot ve ölçüm konumları"
                              : "Mekânsal görünüm"}
                          </h2>
                          <p>
                            İncelenen: <strong>{station}</strong> ·{" "}
                            {selectedInfo.length}/{targets(selected).length}{" "}
                            derinlik
                          </p>
                        </div>
                        <div
                          className="segmented"
                          role="group"
                          aria-label="Görünüm boyutu"
                        >
                          {["2d", "3d"].map((v) => (
                            <button
                              key={v}
                              aria-pressed={view === v}
                              onClick={() => setView(v)}
                            >
                              {v.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="scene-toolbar">
                        <label>
                          Parametre
                          <select
                            value={param}
                            onChange={(e) => setParam(e.target.value)}
                          >
                            {Object.entries(PARAMS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                                {v.unit ? ` (${v.unit})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          İncelenen istasyon
                          <select
                            value={station}
                            onChange={(e) => selectStation(e.target.value)}
                          >
                            {STATIONS.map((s) => (
                              <option key={s.id}>{s.id}</option>
                            ))}
                          </select>
                        </label>
                        {!isHistory && (
                          <button
                            className={`btn follow-btn ${follow ? "pressed" : ""}`}
                            aria-pressed={follow}
                            onClick={() => {
                              setFollow(!follow);
                              if (!follow) setStation(active.id);
                            }}
                          >
                            <Focus size={17} />
                            {follow ? "Bot takibi açık" : "Botu takip et"}
                          </button>
                        )}
                      </div>
                      {page !== "live" && (
                        <div className="analysis-toolbar">
                          <label>
                            Gösterim
                            <select
                              value={layer}
                              onChange={(e) => {
                                setLayer(e.target.value);
                                if (e.target.value === "section") setView("3d");
                              }}
                            >
                              <option value="points">Yalnızca ölçümler</option>
                              <option value="slice">IDW derinlik dilimi</option>
                              <option value="section">IDW dikey kesit</option>
                            </select>
                          </label>
                          <label>
                            Veri katmanı
                            <select
                              value={mode}
                              onChange={(e) => setMode(e.target.value)}
                              disabled={layer === "points"}
                            >
                              <option value="value">
                                Tahmini değer · Cividis
                              </option>
                              <option value="support">
                                Örnekleme uzaklığı · gri
                              </option>
                              <option value="delta">
                                M011'e göre fark · mavi/kırmızı
                              </option>
                            </select>
                          </label>
                        </div>
                      )}
                      <div className="scene-area">
                        <Suspense
                          fallback={
                            <div className="scene-loading" role="status">
                              3D görünüm hazırlanıyor…
                            </div>
                          }
                        >
                          <Twin
                            mission={sceneMission}
                            records={records}
                            baseline={HISTORY[0].records}
                            param={param}
                            depth={depth}
                            selectedStation={station}
                            selectedRecord={selectedRecord}
                            onSelectStation={selectStation}
                            onSelectRecord={selectRecord}
                            view={view}
                            mode={mode}
                            layer={layer}
                            theme={theme}
                            reducedMotion={reducedMotion}
                            cameraCommand={cameraCommand}
                          />
                        </Suspense>
                        <div className="scene-state">
                          <span className="chip">
                            {layer === "points"
                              ? "● Ölçüm noktaları"
                              : layer === "slice"
                                ? `IDW · ${depth.toFixed(1)} m dilim`
                                : `IDW · ${station} boyunca kesit`}
                          </span>
                        </div>
                      </div>
                      <div
                        className="camera-controls"
                        role="group"
                        aria-label="Kamera kontrolleri"
                      >
                        <span>Kamera</span>
                        {[
                          ["left", ArrowLeft, "Sola döndür"],
                          ["right", ArrowRight, "Sağa döndür"],
                          ["up", ArrowUp, "Yukarı döndür"],
                          ["down", ArrowDown, "Aşağı döndür"],
                          ["in", Plus, "Yakınlaştır"],
                          ["out", Minus, "Uzaklaştır"],
                          ["reset", RotateCcw, "Kamerayı sıfırla"],
                        ].map(([action, Icon, label]) => (
                          <button
                            className="icon-btn"
                            key={action}
                            aria-label={label}
                            title={label}
                            disabled={
                              view === "2d" &&
                              ["left", "right", "up", "down"].includes(action)
                            }
                            onClick={() => command(action)}
                          >
                            <Icon size={18} />
                          </button>
                        ))}
                      </div>
                      <div className="slice-controls">
                        <label>
                          {layer === "points"
                            ? "Vurgulanan ölçüm derinliği"
                            : "Dilim derinliği"}
                          <select
                            value={depth}
                            onChange={(e) => setDepth(+e.target.value)}
                          >
                            {[1, 2, 3].map((d) => (
                              <option key={d} value={d}>
                                {d.toFixed(1)} m
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="color-scale">
                          <div className="scale-title">
                            {mode === "support" && layer !== "points"
                              ? "Uzaklık göstergesi (güven aralığı değil)"
                              : mode === "delta" && layer !== "points"
                                ? `${p.label}: M011'e göre fark`
                                : `${p.label} · ${p.unit || "birimsiz"}`}
                          </div>
                          <div
                            className="ramp"
                            style={{
                              background: `linear-gradient(90deg,${legendStops(param, layer === "points" ? "value" : mode).join(",")})`,
                            }}
                          />
                          <div className="scale-ticks">
                            {(mode === "support" && layer !== "points"
                              ? [0, 0.5, 1]
                              : mode === "delta" && layer !== "points"
                                ? [-p.delta, 0, p.delta]
                                : [p.min, (p.min + p.max) / 2, p.max]
                            ).map((n) => (
                              <span key={n}>
                                {n.toFixed(param === "ec" ? 0 : 1)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="panel-foot">
                        <strong>
                          ● Küre: geçerli ölçüm · ◆ Elmas: kararsız kayıt.
                        </strong>
                        {layer === "points"
                          ? " Su hacmi bir veri tahmini değildir."
                          : " Renkli yüzey IDW tahminidir; ölçülmüş alan anlamına gelmez. Dört geçerli örnekten önce gösterilmez."}{" "}
                        {layer === "section" &&
                          "Kesit, seçili istasyonun kuzey koordinatından geçer."}
                      </div>
                    </section>
                    <aside className="side-panels">
                      {page === "live" ? (
                        <>
                          <section className="panel winch-panel">
                            <div className="panel-head">
                              <div>
                                <h2>Vinç ve sensör</h2>
                                <p>Aktif istasyon · {active.id}</p>
                              </div>
                              <span className="chip">POD-01</span>
                            </div>
                            <div className="winch-layout">
                              <div className="winch-visual" aria-hidden="true">
                                <div className="drum" />
                                <div className="waterline" />
                                <div
                                  className="tether"
                                  style={{
                                    height: 30 + live.mission.depth * 25,
                                  }}
                                />
                                <div
                                  className="pod-icon"
                                  style={{ top: 53 + live.mission.depth * 25 }}
                                />
                                <span>Yüzey</span>
                                <small>{active.bottom.toFixed(1)} m dip</small>
                              </div>
                              <div className="depth-readout">
                                <span>
                                  {blocked
                                    ? "SON BİLİNEN DERİNLİK"
                                    : "SENSÖR DERİNLİĞİ · DEMO"}
                                </span>
                                <strong>
                                  {live.mission.depth.toFixed(1)}{" "}
                                  <small>m</small>
                                </strong>
                                <p>Hedef {live.mission.target.toFixed(1)} m</p>
                              </div>
                            </div>
                            <div
                              className={`phase-readout ${blocked ? "error-text" : ""}`}
                            >
                              <strong aria-live="polite" aria-atomic="true">
                                {phase}
                              </strong>
                              {wait !== null && live.running && (
                                <span>
                                  Bu aşama: yaklaşık {Math.ceil(wait)} demo
                                  saniyesi
                                </span>
                              )}
                            </div>
                            <ol className="depth-checklist">
                              {[1, 2, 3].map((d) => {
                                const allowed = targets(active).includes(d),
                                  done = accepted(live.records).some(
                                    (r) =>
                                      r.station === active.id && r.depth === d,
                                  );
                                return (
                                  <li
                                    key={d}
                                    className={
                                      done
                                        ? "complete"
                                        : allowed
                                          ? ""
                                          : "skipped"
                                    }
                                  >
                                    <span>
                                      {done ? (
                                        <Check size={15} />
                                      ) : allowed ? (
                                        d
                                      ) : (
                                        "—"
                                      )}
                                    </span>
                                    <strong>{d} metre</strong>
                                    <small>
                                      {done
                                        ? "Ölçüldü"
                                        : allowed
                                          ? "Bekliyor"
                                          : "Dip mesafesi: atlandı"}
                                    </small>
                                  </li>
                                );
                              })}
                            </ol>
                            <div className="panel-foot">
                              <Anchor size={16} />
                              {live.mission.depth > 0
                                ? "Sensör suda; istasyonlar arası hareket kilitli."
                                : "Sensör toplandı; istasyonlar arası hareket mümkün."}
                              <p>
                                Kablo uzunluğu bu prototipte ölçülmüyor; sensör
                                derinliğiyle eşit varsayılmıyor. Dip güvenlik
                                mesafesi: 0,4 m.
                              </p>
                            </div>
                          </section>
                          <section className="panel">
                            <div className="panel-head">
                              <h2>Bot ve görev</h2>
                              <span className="chip">AQUA-01</span>
                            </div>
                            <dl className="telemetry-list">
                              <div>
                                <dt>Batarya · simüle</dt>
                                <dd>{94 - (live.records.length - 6)}%</dd>
                              </div>
                              <div>
                                <dt>Hız · simüle</dt>
                                <dd>
                                  {live.running &&
                                  live.mission.phase === "transit"
                                    ? "0,8"
                                    : "0,0"}{" "}
                                  m/s
                                </dd>
                              </div>
                              <div>
                                <dt>Bağlantı</dt>
                                <dd>
                                  {live.scenario === "link"
                                    ? "Kesildi"
                                    : "Demo bağlantısı"}
                                </dd>
                              </div>
                              <div>
                                <dt>Kabul edilen ölçüm</dt>
                                <dd>
                                  {accepted(live.records).length}/{TOTAL}
                                </dd>
                              </div>
                            </dl>
                            <div className="progress-block">
                              <label htmlFor="coverage">
                                Ölçüm kapsamı{" "}
                                <strong>
                                  %
                                  {Math.round(
                                    (accepted(live.records).length / TOTAL) *
                                      100,
                                  )}
                                </strong>
                              </label>
                              <progress
                                id="coverage"
                                max={TOTAL}
                                value={accepted(live.records).length}
                              />
                              <p>
                                {live.mission.completed
                                  ? live.mission.aborted
                                    ? "Görev iptal edildi."
                                    : "Sensör toplandı; görev tamamlandı."
                                  : "Ölçümler bitse bile sensör toplanana kadar görev sürer."}
                              </p>
                            </div>
                          </section>
                        </>
                      ) : (
                        <>
                          <Profile
                            records={records}
                            param={param}
                            station={station}
                          />
                          <section className="panel model-panel">
                            <div className="panel-head">
                              <h2>Modeli nasıl okumalı?</h2>
                            </div>
                            <div className="model-body">
                              <span className="chip">IDW · p = 2</span>
                              <p>
                                Geçerli ölçümler arasında ters mesafe ağırlıklı
                                tahmin. Kıyı ve dip dışında alan üretilmez.
                              </p>
                              <div className="validation-number">
                                <span>Leave-one-out RMSE</span>
                                <strong>
                                  {rmse === null
                                    ? "—"
                                    : rmse.toFixed(p.digits + 1)}{" "}
                                  <small>{p.unit}</small>
                                </strong>
                              </div>
                              <p className="caption">
                                Her örnek sırayla gizlenip diğerlerinden tahmin
                                edilir. Bu görev içi sentetik doğrulamadır; saha
                                başarımı kanıtı değildir.
                              </p>
                              {mode === "support" && (
                                <div className="notice warning">
                                  <p>
                                    Gri katman, en yakın örneğe ölçekli
                                    uzaklıktır. GP belirsizliği, standart sapma
                                    veya hata olasılığı değildir.
                                  </p>
                                </div>
                              )}
                              {mode === "delta" && (
                                <p className="caption">
                                  Sıfır merkezli mavi/kırmızı skala, aynı konum
                                  ve derinlikteki iki IDW tahmininin farkıdır.
                                </p>
                              )}
                            </div>
                          </section>
                        </>
                      )}
                    </aside>
                  </div>
                  <div className="secondary-grid">
                    {page === "live" ? (
                      <Profile
                        records={records}
                        param={param}
                        station={station}
                      />
                    ) : (
                      <section className="panel">
                        <div className="panel-head">
                          <h2>Sonraki örnekleme için adaylar</h2>
                        </div>
                        <div className="recommendation-list">
                          {recs.length ? (
                            recs.map((r, i) => (
                              <div key={i}>
                                <span>{i + 1}</span>
                                <div>
                                  <strong>
                                    x {r.x} m · kuzey {r.z} m · {r.depth} m
                                  </strong>
                                  <small>
                                    En yakın örneğe ölçekli mesafe:{" "}
                                    {r.distance.toFixed(1)} m
                                  </small>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p>Öneri için en az üç geçerli ölçüm gerekli.</p>
                          )}
                        </div>
                        <div className="panel-foot">
                          Öneriler, seyrek örneklenen alanları işaretler. Rota,
                          enerji veya engel optimizasyonu değildir; otomatik
                          görev komutu oluşturmaz.
                        </div>
                      </section>
                    )}
                    <section className="panel">
                      <div className="panel-head">
                        <h2>
                          {page === "live"
                            ? "Görev olayları"
                            : "Kalite ve kapsam"}
                        </h2>
                        {live.running && page === "live" && (
                          <span className="chip">Akış açık</span>
                        )}
                      </div>
                      {page === "live" ? (
                        <ol
                          className="event-log"
                          aria-label="Son görev olayları"
                        >
                          {live.logs.slice(0, 6).map((l) => (
                            <li key={l.id}>
                              <time>{l.time}</time>
                              <span>{l.text}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="model-body">
                          <div className="notice info">
                            <CheckCircle2 size={20} />
                            <div>
                              <strong>
                                {ok.length} geçerli / {bad.length} kararsız
                              </strong>
                              <p>
                                Geçerli örnekler modelde; bütün kayıtlar tabloda
                                korunur.
                              </p>
                            </div>
                          </div>
                          {low.length ? (
                            <div className="notice warning">
                              <AlertTriangle size={20} />
                              <div>
                                <strong>
                                  {low.length} ölçüm DO dikkat eşiğinin altında
                                </strong>
                                <p>
                                  Demo eşiği {threshold} mg/L. Ham kaydı
                                  inceleyin; otomatik çevresel tanı yapılmaz.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p>
                              {ok.length
                                ? "Mevcut ölçümlerde demo DO eşiği aşılmadı."
                                : "Henüz değerlendirme için geçerli veri yok."}
                            </p>
                          )}
                          <p className="caption">
                            Kalibrasyon ve ham pencere ayrıntılarına kayıt
                            tablosundan erişebilirsiniz.
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                  {page === "live" ? (
                    <div className="records-link-row">
                      <p>
                        <strong>{live.records.length} kayıt</strong> yerel
                        tarayıcıda korunuyor. Ölçüm ayrıntılarını ve kalite
                        bilgilerini açabilirsiniz.
                      </p>
                      <button className="btn" onClick={() => navigate("data")}>
                        Ölçüm kayıtlarını aç <ArrowRight size={17} />
                      </button>
                    </div>
                  ) : (
                    <RecordsTable
                      records={records}
                      filters={filters}
                      setFilters={setFilters}
                      onSelect={selectRecord}
                      selectedId={selectedRecord?.id}
                      notify={setToast}
                      missionName={isHistory ? archive : "M012"}
                    />
                  )}
                </>
              )}
            </>
          )}
          <footer>
            <span>AquaTwin · METU NCC · bot ve vinç prototipi</span>
            <span>Sentetik veri · yerel kayıt · donanım bağlantısı yok</span>
          </footer>
        </main>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {toast}
      </div>
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
          <button
            className="icon-btn"
            aria-label="Bildirimi kapat"
            onClick={() => setToast("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {detail && (
        <RecordDetail record={detail} onClose={() => setDetail(null)} />
      )}
      {confirmation && (
        <Dialog
          title={
            confirmation === "reset"
              ? "Demo kayıtları sıfırlansın mı?"
              : "Demo iptal edilsin mi?"
          }
          onClose={() => setConfirmation(null)}
        >
          <div className="confirm-body">
            <p>
              {confirmation === "reset"
                ? `${live.records.length} yerel kayıt, S01/S02 için 6 başlangıç kaydıyla değiştirilecek. Önce CSV indirebilir veya vazgeçebilirsiniz.`
                : "Yeni ölçüm alınmayacak; sensör toplandıktan sonra demo sonlandırılacak. Mevcut kayıtlar korunacak."}
            </p>
            <p className="caption">
              Bu işlem fiziksel botu veya vinci kontrol etmez.
            </p>
          </div>
          <div className="dialog-actions">
            <button
              className="btn"
              onClick={() => {
                downloadRecords(live.records, "M012-sifirlama-oncesi");
                setToast("Mevcut kayıtların CSV kopyası indirildi.");
              }}
            >
              <Download size={17} />
              Önce kayıtları indir
            </button>
            <button className="btn" onClick={() => setConfirmation(null)}>
              Vazgeç
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirmation === "reset") reset();
                else {
                  live.abort();
                  setConfirmation(null);
                }
              }}
            >
              {confirmation === "reset" ? "Sıfırla" : "İptal et ve topla"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Metric({ label, value, unit, text, warning }) {
  return (
    <section className={`metric ${warning ? "metric-warning" : ""}`}>
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>
        {warning && <AlertTriangle size={15} />} {text}
      </p>
    </section>
  );
}
