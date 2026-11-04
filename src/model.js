import { CIVIDIS, DIVERGING } from "./palettes.js";
export const PARAMS = {
  do: {
    label: "Çözünmüş oksijen",
    short: "Oksijen",
    unit: "mg/L",
    min: 0,
    max: 12,
    digits: 2,
    delta: 4,
  },
  temp: {
    label: "Su sıcaklığı",
    short: "Sıcaklık",
    unit: "°C",
    min: 15,
    max: 30,
    digits: 1,
    delta: 5,
  },
  ph: {
    label: "pH",
    short: "pH",
    unit: "",
    min: 6.5,
    max: 9.5,
    digits: 2,
    delta: 1,
  },
  ec: {
    label: "İletkenlik",
    short: "İletkenlik",
    unit: "µS/cm",
    min: 450,
    max: 850,
    digits: 0,
    delta: 150,
  },
  turb: {
    label: "Bulanıklık",
    short: "Bulanıklık",
    unit: "NTU",
    min: 0,
    max: 25,
    digits: 1,
    delta: 12,
  },
};
export const SETTLE = 5,
  WINDOW = 3,
  CLEARANCE = 0.4;
export const PHASES = {
  ready: "Başlatılmaya hazır",
  lowering: "Sensör indiriliyor",
  settling: "Sensör stabilize oluyor",
  measuring: "Ölçüm alınıyor",
  retracting: "Sensör toplanıyor",
  transit: "Sonraki istasyona ilerliyor",
  done: "Görev tamamlandı",
  review: "Ölçüm kararsız · tekrar gerekli",
};
export function inside(x, z) {
  return (x / 43) ** 2 + (z / 25) ** 2 <= 1;
}
export function bottomAt(x, z) {
  return inside(x, z)
    ? 0.4 + 4.3 * Math.sqrt(Math.max(0, 1 - (x / 43) ** 2 - (z / 25) ** 2))
    : 0;
}
export const STATIONS = [
  [-26, 8],
  [-12, -11],
  [8, -7],
  [23, 9],
  [29, 14],
].map(([x, z], i) => ({
  id: `S0${i + 1}`,
  x,
  z,
  bottom: +bottomAt(x, z).toFixed(2),
}));
export function targets(station) {
  return [1, 2, 3].filter((d) => d <= station.bottom - CLEARANCE);
}
export const TOTAL = STATIONS.reduce((n, s) => n + targets(s).length, 0);
export function makeReading(
  station,
  depth,
  index = 0,
  { quality = "ok", day = 4, mission = "M012", attempt = 0 } = {},
) {
  const temp = +(
    25.3 -
    depth * 1.35 +
    station.x * 0.012 +
    (day - 4) * 0.18
  ).toFixed(2);
  const oxygen = +(
    9.1 -
    depth * 1.24 +
    station.z * 0.018 +
    (day - 4) * 0.12
  ).toFixed(2);
  const sd = quality === "ok" ? 0.09 : 0.75;
  const raw = Array.from({ length: 30 }, (_, i) => ({
    second: i,
    do: +(oxygen + sd * Math.sin(i * 1.7) * Math.SQRT2).toFixed(3),
    temp: +(temp + 0.04 * Math.cos(i)).toFixed(3),
  }));
  return {
    id: `${mission}-${station.id}-${depth}-${attempt}`,
    mission,
    station: station.id,
    x: station.x,
    z: station.z,
    depth,
    time: new Date(Date.UTC(2026, 10, day, 7, 30, index * 32)).toISOString(),
    temp,
    do: oxygen,
    ph: +(8.35 - depth * 0.15).toFixed(2),
    ec: Math.round(620 + depth * 23 + station.x),
    turb: +(4.2 + depth * 1.1 + Math.abs(station.x) * 0.08).toFixed(2),
    quality,
    n: 30,
    do_sd: sd,
    reason:
      quality === "ok"
        ? "30 örneklik sentetik pencere stabil."
        : "DO standart sapması demo sınırını aştı (0,30 mg/L).",
    sensor: "POD-01",
    calibration: "CAL-DEMO-03 · 03 Kasım 2026 · sentetik",
    raw,
  };
}
export const INITIAL_RECORDS = STATIONS.slice(0, 2).flatMap((s, i) =>
  targets(s).map((d, j) => makeReading(s, d, i * 3 + j)),
);
export const HISTORY = [
  { id: "M011", date: "02 Kasım 2026", day: 2, kind: "Rutin tarama" },
  { id: "M010", date: "29 Ekim 2026", day: -2, kind: "Yağmur sonrası" },
].map((m) => ({
  ...m,
  records: STATIONS.flatMap((s, i) =>
    targets(s).map((d, j) =>
      makeReading(s, d, i * 3 + j, { day: m.day, mission: m.id }),
    ),
  ),
}));
export function initialMission() {
  return {
    stationIndex: 2,
    phase: "ready",
    depth: 0,
    target: 1,
    progress: 0,
    completed: false,
    elapsed: 0,
    attempt: 0,
  };
}
export function advanceMission(state, dt, scenario = "normal") {
  let s = { ...state },
    record = null;
  const st = STATIONS[s.stationIndex];
  if (s.completed || s.phase === "review") return { state: s, record };
  s.elapsed += dt;
  if (s.phase === "ready") s.phase = "lowering";
  if (s.phase === "lowering") {
    s.depth = Math.min(s.target, s.depth + dt * 0.65);
    if (s.depth >= s.target) {
      s.phase = "settling";
      s.progress = 0;
    }
  } else if (s.phase === "settling") {
    s.progress += dt;
    if (s.progress >= SETTLE) {
      s.phase = "measuring";
      s.progress = 0;
    }
  } else if (s.phase === "measuring") {
    s.progress += dt;
    if (s.progress >= WINDOW) {
      record = makeReading(st, s.target, 6 + Math.floor(s.elapsed / 3), {
        attempt: s.attempt,
        quality: scenario === "unstable" ? "unstable" : "ok",
      });
      s.attempt++;
      s.progress = 0;
      if (record.quality !== "ok") s.phase = "review";
      else {
        const next = targets(st).find((d) => d > s.target);
        if (next) {
          s.target = next;
          s.phase = "lowering";
        } else s.phase = "retracting";
      }
    }
  } else if (s.phase === "retracting") {
    s.depth = Math.max(0, s.depth - dt * 0.85);
    if (s.depth === 0) {
      s.phase =
        s.aborted || s.stationIndex === STATIONS.length - 1
          ? "done"
          : "transit";
      s.progress = 0;
      if (s.phase === "done") s.completed = true;
    }
  } else if (s.phase === "transit") {
    s.progress += dt;
    if (s.progress >= 4) {
      s.stationIndex++;
      s.phase = "lowering";
      s.target = 1;
      s.progress = 0;
    }
  }
  return { state: s, record };
}
export function accepted(records) {
  const map = new Map();
  records
    .filter((r) => r.quality === "ok")
    .forEach((r) => map.set(`${r.station}|${r.depth}`, r));
  return [...map.values()];
}
export function completedStations(records) {
  const ok = accepted(records);
  return STATIONS.filter((s) =>
    targets(s).every((d) =>
      ok.some((r) => r.station === s.id && r.depth === d),
    ),
  ).length;
}
export function vesselPosition(mission) {
  const st = STATIONS[mission.stationIndex];
  if (mission.phase !== "transit") return { ...st };
  const next =
      STATIONS[Math.min(STATIONS.length - 1, mission.stationIndex + 1)],
    t = Math.min(1, mission.progress / 4);
  return { x: st.x + (next.x - st.x) * t, z: st.z + (next.z - st.z) * t };
}
export function remainingSeconds(m) {
  if (m.phase === "settling") return Math.max(0, SETTLE - m.progress);
  if (m.phase === "measuring") return Math.max(0, WINDOW - m.progress);
  if (m.phase === "lowering") return Math.max(0, (m.target - m.depth) / 0.65);
  if (m.phase === "retracting") return m.depth / 0.85;
  if (m.phase === "transit") return Math.max(0, 4 - m.progress);
  return null;
}
export function predict(records, param, x, z, depth, skipId = null) {
  const pts = accepted(records).filter((r) => r.id !== skipId);
  if (!pts.length) return null;
  let sum = 0,
    weights = 0,
    nearest = Infinity;
  for (const r of pts) {
    const d2 = (r.x - x) ** 2 + (r.z - z) ** 2 + ((r.depth - depth) * 8) ** 2;
    nearest = Math.min(nearest, Math.sqrt(d2));
    if (d2 < 1e-8) return { value: r[param], distance: 0, support: 0 };
    const w = 1 / d2;
    sum += r[param] * w;
    weights += w;
  }
  return {
    value: sum / weights,
    distance: nearest,
    support: Math.min(1, nearest / 30),
  };
}
export function crossValidate(records, param) {
  const pts = accepted(records);
  if (pts.length < 3) return null;
  const errors = pts.map((r) => {
    const p = predict(pts, param, r.x, r.z, r.depth, r.id);
    return p.value - r[param];
  });
  return Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
}
export function recommendations(records) {
  if (accepted(records).length < 3) return [];
  const candidates = [];
  for (let x = -32; x <= 32; x += 8)
    for (let z = -16; z <= 16; z += 8)
      for (const d of [1, 2, 3]) {
        if (bottomAt(x, z) < d + CLEARANCE) continue;
        const p = predict(records, "do", x, z, d);
        if (p) candidates.push({ x, z, depth: d, distance: p.distance });
      }
  candidates.sort((a, b) => b.distance - a.distance);
  const out = [];
  for (const c of candidates) {
    if (
      out.every(
        (o) =>
          Math.hypot(o.x - c.x, o.z - c.z) > 12 ||
          Math.abs(o.depth - c.depth) > 1,
      )
    )
      out.push(c);
    if (out.length === 3) break;
  }
  return out;
}
export function dataColor(
  value,
  param,
  { mode = "value", support = 0, delta = 0 } = {},
) {
  if (mode === "support") {
    const v = Math.round(245 - support * 170)
      .toString(16)
      .padStart(2, "0");
    return "#" + v.repeat(3);
  }
  const p = PARAMS[param],
    t =
      mode === "delta"
        ? (delta + p.delta) / (2 * p.delta)
        : (value - p.min) / (p.max - p.min);
  const lut = mode === "delta" ? DIVERGING : CIVIDIS;
  return lut[Math.round(Math.max(0, Math.min(1, t)) * 255)];
}
export function legendStops(param, mode = "value") {
  const p = PARAMS[param];
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return dataColor(p.min + (p.max - p.min) * t, param, {
      mode,
      support: t,
      delta: (t * 2 - 1) * p.delta,
    });
  });
}
export function filterRecords(
  records,
  {
    query = "",
    quality = "all",
    station = "all",
    depth = "all",
    sort = "time",
    direction = "desc",
  } = {},
) {
  return records
    .filter(
      (r) =>
        (!query ||
          `${r.id} ${r.station} ${r.depth}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (quality === "all" || r.quality === quality) &&
        (station === "all" || r.station === station) &&
        (depth === "all" || r.depth === +depth),
    )
    .sort((a, b) => {
      const av = a[sort],
        bv = b[sort];
      return (
        (typeof av === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))) *
        (direction === "asc" ? 1 : -1)
      );
    });
}
export function csv(records) {
  const cols = [
    "mission",
    "id",
    "time",
    "station",
    "x",
    "z",
    "depth",
    "temp",
    "ph",
    "do",
    "ec",
    "turb",
    "quality",
    "do_sd",
    "n",
    "reason",
  ];
  const esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      cols.map(esc).join(","),
      ...records.map((r) => cols.map((k) => esc(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function validateSaved(value) {
  if (
    !value ||
    value.version !== 2 ||
    !Array.isArray(value.records) ||
    !value.mission
  )
    return null;
  const m = value.mission;
  if (
    !Number.isInteger(m.stationIndex) ||
    m.stationIndex < 0 ||
    m.stationIndex >= STATIONS.length ||
    !Object.hasOwn(PHASES, m.phase) ||
    !Number.isFinite(m.depth) ||
    m.depth < 0 ||
    m.depth > STATIONS[m.stationIndex].bottom
  )
    return null;
  if (
    value.records.some(
      (r) =>
        !r.id ||
        !STATIONS.some((s) => s.id === r.station) ||
        !["ok", "unstable"].includes(r.quality) ||
        !Number.isFinite(r.depth) ||
        Object.keys(PARAMS).some((k) => !Number.isFinite(r[k])),
    )
  )
    return null;
  return value;
}
