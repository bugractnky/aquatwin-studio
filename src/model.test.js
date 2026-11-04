import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialMission,
  advanceMission,
  STATIONS,
  targets,
  TOTAL,
  INITIAL_RECORDS,
  accepted,
  predict,
  dataColor,
  legendStops,
  PARAMS,
  validateSaved,
  csv,
} from "./model.js";
test("mission retracts before transit, stays clear of bottom, completes only after retraction", () => {
  let s = initialMission(),
    rows = [...INITIAL_RECORDS];
  for (let i = 0; i < 10000 && !s.completed; i++) {
    const o = advanceMission(s, 0.1);
    s = o.state;
    if (s.phase === "transit" || s.completed) assert.equal(s.depth, 0);
    if (o.record) {
      rows.push(o.record);
      assert.ok(
        o.record.depth <=
          STATIONS.find((t) => t.id === o.record.station).bottom - 0.4,
      );
    }
  }
  assert.ok(s.completed);
  assert.equal(accepted(rows).length, TOTAL);
  assert.deepEqual(targets(STATIONS[4]), [1, 2]);
});
test("unstable sample requires explicit retry and is excluded from interpolation", () => {
  let s = initialMission(),
    bad;
  for (let i = 0; i < 200 && !bad; i++) {
    const o = advanceMission(s, 0.1, "unstable");
    s = o.state;
    bad = o.record;
  }
  assert.equal(s.phase, "review");
  assert.equal(bad.quality, "unstable");
  assert.deepEqual(advanceMission(s, 10).state, s);
  assert.equal(accepted([bad]).length, 0);
  assert.equal(predict([bad], "do", 0, 0, 1), null);
});
test("IDW recovers known values and never escapes convex range", () => {
  const row = INITIAL_RECORDS[0];
  assert.equal(
    predict(INITIAL_RECORDS, "do", row.x, row.z, row.depth).value,
    row.do,
  );
  const v = predict(INITIAL_RECORDS, "do", 0, 0, 2).value;
  assert.ok(
    v >= Math.min(...INITIAL_RECORDS.map((r) => r.do)) &&
      v <= Math.max(...INITIAL_RECORDS.map((r) => r.do)),
  );
});
test("legend and render use same LUT endpoints for every parameter", () => {
  for (const [key, p] of Object.entries(PARAMS)) {
    const stops = legendStops(key);
    assert.equal(stops[0], dataColor(p.min, key));
    assert.equal(stops.at(-1), dataColor(p.max, key));
  }
  assert.equal(dataColor(-100, "do"), dataColor(0, "do"));
});
test("invalid persistence rejected, valid state restored paused by UI", () => {
  assert.equal(validateSaved({ version: 1 }), null);
  assert.equal(
    validateSaved({
      version: 2,
      records: INITIAL_RECORDS,
      mission: { ...initialMission(), stationIndex: 90 },
    }),
    null,
  );
  assert.ok(
    validateSaved({
      version: 2,
      records: INITIAL_RECORDS,
      mission: initialMission(),
    }),
  );
});
test("CSV is quoted and preserves quality reasons", () => {
  const s = csv([{ ...INITIAL_RECORDS[0], reason: 'A, "B"' }]);
  assert.ok(s.includes('"A, ""B"""'));
  assert.ok(s.includes('"quality"'));
});
