import test from "node:test";
import assert from "node:assert/strict";
import { formatReading, sceneRecords, toDisplayRecord } from "./api.js";
import { accepted } from "./model.js";
const packet = {
  schema_version: 1,
  id: "reading-a",
  mission_id: "mission-a",
  station_id: "S01",
  measured_at: "2026-11-25T09:00:00Z",
  actual_depth_m: 1,
  position: { local_x_m: 0, local_north_m: 0, reference_id: "demo-pond-v1" },
  parameters: { temp: { value: 23, unit: "degC", sensor_id: "t" } },
  quality: "valid",
};
test("API adapter preserves missing sensors and quality without fabricating values", () => {
  const record = toDisplayRecord(packet);
  assert.equal(record.temp, 23);
  assert.equal(record.do, null);
  assert.equal(record.quality, "ok");
  assert.equal(formatReading(record.do), "Ölçülmedi");
  assert.equal(formatReading(0, 1, "°C"), "0.0 °C");
  assert.equal(
    toDisplayRecord({ ...packet, quality: "unreviewed" }).quality,
    "unreviewed",
  );
});
test("only known local coordinates and available parameters enter schematic scene", () => {
  const record = toDisplayRecord(packet);
  assert.equal(sceneRecords([record], "temp").length, 1);
  assert.equal(sceneRecords([record], "do").length, 0);
  assert.equal(
    sceneRecords(
      [
        toDisplayRecord({
          ...packet,
          position: { latitude: 35, longitude: 33 },
        }),
      ],
      "temp",
    ).length,
    0,
  );
  assert.equal(
    sceneRecords(
      [
        toDisplayRecord({
          ...packet,
          position: { ...packet.position, reference_id: "another-lake" },
        }),
      ],
      "temp",
    ).length,
    0,
  );
});
test("API adapter rejects unsupported units instead of silently mislabelling values", () => {
  assert.throws(() =>
    toDisplayRecord({
      ...packet,
      parameters: { temp: { value: 23, unit: "F" } },
    }),
  );
  assert.throws(() => toDisplayRecord({ ...packet, schema_version: 2 }));
});
test("accepted readings are distinct across missions at the same station and depth", () => {
  const a = toDisplayRecord(packet);
  const b = { ...a, id: "reading-b", mission: "mission-b" };
  assert.equal(accepted([a, b]).length, 2);
});
