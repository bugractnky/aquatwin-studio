import { useEffect, useRef, useState } from "react";
import {
  INITIAL_RECORDS,
  initialMission,
  advanceMission,
  PHASES,
  validateSaved,
} from "./model.js";
const KEY = "aquatwin-session-v2";
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? validateSaved(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function useMission() {
  const [saved] = useState(load),
    [mission, setMission] = useState(() => saved?.mission || initialMission()),
    [records, setRecords] = useState(() => saved?.records || INITIAL_RECORDS),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [scenario, setScenario] = useState("normal"),
    [lastPacket, setLastPacket] = useState(Date.now()),
    [clock, setClock] = useState(Date.now()),
    [storageError, setStorageError] = useState(""),
    [logs, setLogs] = useState(() => [
      {
        id: 0,
        time: new Date().toLocaleTimeString("tr-TR"),
        text: saved
          ? saved.mission.completed
            ? "Tamamlanan demo geri yüklendi; kayıtlar korundu."
            : "Yerel görev geri yüklendi; güvenli şekilde duraklatıldı."
          : "Demo hazır. S01 ve S02 için 6 başlangıç ölçümü var.",
      },
    ]);
  const state = useRef(mission);
  state.current = mission;
  const snapshot = useRef({ mission, records });
  snapshot.current = { mission, records };
  const log = (text) =>
    setLogs((prev) =>
      [
        {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString("tr-TR"),
          text,
        },
        ...prev,
      ].slice(0, 40),
    );
  const setState = (next) => {
    state.current = next;
    setMission(next);
  };
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(Date.now());
      if (scenario !== "link") setLastPacket(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [scenario]);
  useEffect(() => {
    if (!running || scenario === "link" || scenario === "winch") return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        dt = Math.min(0.3, (now - previous) / 1000) * speed;
      previous = now;
      const old = state.current,
        result = advanceMission(old, dt, scenario);
      setState(result.state);
      if (old.phase !== result.state.phase) log(PHASES[result.state.phase]);
      if (result.record) {
        setRecords((prev) => [...prev, result.record]);
        log(
          `${result.record.station} · ${result.record.depth} m: ${result.record.quality === "ok" ? "ölçüm kabul edildi" : "kararsız ölçüm, modelden çıkarıldı"}.`,
        );
      }
      if (result.state.phase === "review" || result.state.completed) {
        setRunning(false);
        if (result.state.phase === "review") setScenario("normal");
      }
    }, 100);
    return () => clearInterval(timer);
  }, [running, speed, scenario]);
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ version: 2, ...snapshot.current }),
        );
        setStorageError("");
      } catch {
        setStorageError(
          "Tarayıcıya kaydedilemiyor. Kayıtları CSV olarak indirin.",
        );
      }
    };
    save();
    const timer = setInterval(save, 1000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
    };
  }, []);
  function toggle() {
    if (
      mission.completed ||
      mission.phase === "review" ||
      scenario === "link" ||
      scenario === "winch"
    )
      return;
    log(running ? "Demo duraklatıldı." : "Demo sürdürülüyor.");
    setRunning((v) => !v);
  }
  function changeScenario(value) {
    setScenario(value);
    if (value === "link" || value === "winch") {
      setRunning(false);
      log(
        value === "link"
          ? "Demo: telemetri bağlantısı kesildi. Son değerler donduruldu."
          : "Demo: vinç hata durumuna geçti; görev durduruldu.",
      );
    } else
      log(
        value === "unstable"
          ? "Bir sonraki ölçüm kararsız olacak."
          : "Demo normal duruma getirildi.",
      );
  }
  function recover() {
    setScenario("normal");
    setLastPacket(Date.now());
    log(
      "Demo hata durumu giderildi. Devam etmek için kullanıcı komutu bekleniyor.",
    );
  }
  function retry() {
    setState({ ...state.current, phase: "settling", progress: 0 });
    setScenario("normal");
    setRunning(true);
    log("Aynı derinlikte tekrar ölçüm başlatıldı. Önceki kayıt korunuyor.");
  }
  function reset() {
    setRunning(false);
    setScenario("normal");
    setRecords(INITIAL_RECORDS);
    setState(initialMission());
    log("Yeni demo başlatıldı. Önceki demo kayıtları sıfırlandı.");
  }
  function abort() {
    setState({
      ...state.current,
      aborted: true,
      phase: "retracting",
      progress: 0,
    });
    setScenario("normal");
    setRunning(true);
    log("Demo iptal edildi. Sensör toplandıktan sonra görev sonlandırılacak.");
  }
  return {
    mission,
    records,
    running,
    speed,
    setSpeed,
    scenario,
    changeScenario,
    lastPacket,
    age: Math.max(0, Math.floor((clock - lastPacket) / 1000)),
    storageError,
    logs,
    toggle,
    recover,
    retry,
    reset,
    abort,
  };
}
