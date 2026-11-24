// Boundary between the versioned API contract and the existing chart/table model.
const UNITS = { temp: "degC", ph: "1", do: "mg/L", ec: "uS/cm", turb: "NTU" };
export const QUALITY_LABELS = {
  ok: "Geçerli",
  unstable: "Kararsız",
  invalid: "Geçersiz",
  unreviewed: "İncelenmedi",
};
export function formatReading(value, digits = 1, unit = "") {
  return Number.isFinite(value)
    ? `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`
    : "Ölçülmedi";
}
export function toDisplayRecord(packet) {
  if (
    packet.schema_version !== 1 ||
    !packet.id ||
    !packet.mission_id ||
    !packet.parameters ||
    !Number.isFinite(packet.actual_depth_m) ||
    !Number.isFinite(Date.parse(packet.measured_at))
  ) {
    throw new Error("API ölçüm biçimi desteklenmiyor.");
  }
  const record = {
    id: packet.id,
    mission: packet.mission_id,
    station: packet.station_id,
    time: packet.measured_at,
    depth: packet.actual_depth_m,
    x: packet.position?.local_x_m ?? null,
    z: packet.position?.local_north_m ?? null,
    quality: packet.quality === "valid" ? "ok" : packet.quality,
    reason: packet.quality_reason,
    packet,
    source: packet.source,
    device_id: packet.device_id,
    received_at: packet.received_at,
    target_depth_m: packet.target_depth_m,
    reference_id: packet.position?.reference_id,
    latitude: packet.position?.latitude,
    longitude: packet.position?.longitude,
    accuracy_m: packet.position?.accuracy_m,
    calibration_id: packet.calibration_id,
    n: packet.raw_samples?.length || 0,
  };
  for (const [key, unit] of Object.entries(UNITS)) {
    const p = packet.parameters[key];
    if (p && (p.unit !== unit || !Number.isFinite(p.value)))
      throw new Error(`API ${key} birimi veya değeri geçersiz.`);
    record[key] = p?.value ?? null;
  }
  return record;
}
export function sceneRecords(records, param) {
  return records.filter(
    (r) =>
      r.packet.position?.reference_id === "demo-pond-v1" &&
      Number.isFinite(r.x) &&
      Number.isFinite(r.z) &&
      Number.isFinite(r[param]) &&
      (r.x / 43) ** 2 + (r.z / 25) ** 2 <= 1,
  );
}
export async function getAllPages(path, signal) {
  const items = [];
  for (let offset = 0; offset < 10000; offset += 200) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(
        `${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`,
        {
          signal: AbortSignal.any([signal, controller.signal]),
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok)
        throw new Error(`API isteği başarısız (${response.status}).`);
      const page = await response.json();
      if (
        !Array.isArray(page.items) ||
        !Number.isInteger(page.total) ||
        page.total < 0
      )
        throw new Error("API yanıtı geçersiz.");
      items.push(...page.items);
      if (items.length >= page.total) return items;
      if (!page.items.length) throw new Error("API sayfalaması tamamlanamadı.");
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error(
        error.name === "AbortError"
          ? "API yanıtı zaman aşımına uğradı."
          : error.message,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(
    "Bu görünüm 10.000 kayıt sınırına ulaştı; görev verisini daraltın.",
  );
}
