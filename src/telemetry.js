// Server-derived packet age is advanced only by elapsed browser time between polls.
export function reportStatus(report, elapsedSeconds = 0) {
  const age = report.age_seconds + Math.max(0, elapsedSeconds);
  if (!Number.isFinite(age) || age < 0)
    return { age: null, label: "Güncellik bilinmiyor", tone: "warning" };
  return {
    age,
    label:
      age >= 60
        ? "Telemetri yok · ≥60 sn"
        : age >= 15
          ? "Telemetri gecikti · ≥15 sn"
          : "Telemetri güncel · <15 sn",
    tone: age >= 15 ? "warning" : "info",
  };
}
export function depthText(value) {
  return Number.isFinite(value) ? `${value} m` : "Bilinmiyor";
}
export const STAGES = {
  idle: "Bekliyor",
  lowering: "İndiriliyor",
  settling: "Stabilizasyon",
  measuring: "Ölçüm",
  retracting: "Toplanıyor",
  fault: "Hata",
};
