// Planned targets remain distinct from measurements and physical completion.
export function comparePlan(plan, records) {
  if (!plan) return { targets: [], unplanned: records };
  const targets = plan.stations.flatMap((station) =>
    station.target_depths_m.map((depth) => {
      const matches = records.filter(
        (r) =>
          r.station === station.station_id &&
          Number.isFinite(r.packet.target_depth_m) &&
          Math.abs(r.packet.target_depth_m - depth) < 0.0005,
      );
      const valid = matches.filter((r) => r.quality === "ok");
      return {
        station,
        depth,
        matches,
        valid,
        status: valid.length
          ? "Geçerli kayıt var"
          : matches.length
            ? "İnceleme / tekrar gerekli"
            : "Ölçüm bekleniyor",
      };
    }),
  );
  const ids = new Set(targets.flatMap((t) => t.matches.map((r) => r.id)));
  return { targets, unplanned: records.filter((r) => !ids.has(r.id)) };
}

export function planPayload(
  rows,
  coordinateMode,
  referenceId = "demo-pond-v1",
) {
  if (!rows.length) throw new Error("En az bir istasyon ekleyin.");
  if (coordinateMode !== "geo" && !referenceId.trim())
    throw new Error("Yerel koordinat referansı boş olamaz.");
  const stations = rows.map((row) => {
    const depths = row.depths.split(",").map((v) => v.trim());
    if (depths.some((v) => !v))
      throw new Error("Derinlikleri virgülle ayırın; boş değer bırakmayın.");
    const target_depths_m = depths.map(Number);
    if (
      target_depths_m.some(
        (d) =>
          !Number.isFinite(d) || d < 0 || Math.abs(d - roundDepth(d)) > 1e-8,
      )
    )
      throw new Error(
        "Derinlikler sıfır veya pozitif olmalı; en fazla 3 ondalık basamak kullanın.",
      );
    if (new Set(target_depths_m).size !== target_depths_m.length)
      throw new Error("Aynı istasyonda tekrarlanan hedef derinlik var.");
    if (!row.first.trim() || !row.second.trim())
      throw new Error("Her istasyonun iki konum alanını doldurun.");
    const first = Number(row.first),
      second = Number(row.second);
    if (!Number.isFinite(first) || !Number.isFinite(second))
      throw new Error("Konum alanları geçerli sayı olmalı.");
    const position =
      coordinateMode !== "geo"
        ? {
            local_x_m: first,
            local_north_m: second,
            reference_id: referenceId.trim(),
          }
        : { latitude: first, longitude: second };
    if (
      coordinateMode === "geo" &&
      (Math.abs(first) > 90 || Math.abs(second) > 180)
    )
      throw new Error("Enlem -90…90, boylam -180…180 arasında olmalı.");
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(row.id.trim()) || !row.name.trim())
      throw new Error(
        "İstasyon kimliği harf, sayı, _ veya - içermeli; istasyon adı boş olamaz.",
      );
    return {
      station_id: row.id.trim(),
      name: row.name.trim(),
      position,
      target_depths_m,
    };
  });
  if (new Set(stations.map((s) => s.station_id)).size !== stations.length)
    throw new Error("İstasyon kimlikleri benzersiz olmalı.");
  return { schema_version: 1, stations };
}
function roundDepth(value) {
  return Math.round(value * 1000) / 1000;
}

export function rowsFromPlan(plan) {
  return plan.stations.map((s) => ({
    key: crypto.randomUUID(),
    id: s.station_id,
    name: s.name,
    first: String(s.position.local_x_m ?? s.position.latitude),
    second: String(s.position.local_north_m ?? s.position.longitude),
    depths: s.target_depths_m.join(", "),
  }));
}

export async function planningRequest(
  path,
  { method = "GET", body, csrf, signal } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      signal: signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Sunucu yanıtı okunamadı (${response.status}).`);
    }
    if (!response.ok) {
      const explanation =
        typeof data.detail === "string"
          ? data.detail
          : "Plan alanlarını ve konum/derinlik değerlerini kontrol edin.";
      const error = new Error(`${response.status}: ${explanation}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted)
      throw new Error(
        "İstek zaman aşımına uğradı. Aynı planı tekrar gönderebilirsiniz.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
