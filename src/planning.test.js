import test from "node:test";
import assert from "node:assert/strict";
import { comparePlan, planPayload, rowsFromPlan } from "./planning.js";
const row = {
  key: "one",
  id: "S01",
  name: "First",
  first: "0",
  second: "0",
  depths: "0, 1, 2",
};
test("plan builder preserves surface depth, coordinates and sequence", () => {
  const p = planPayload([row], "demo");
  assert.deepEqual(p.stations[0].target_depths_m, [0, 1, 2]);
  assert.equal(p.stations[0].position.local_x_m, 0);
  const rebuilt = planPayload(rowsFromPlan(p), "demo");
  assert.deepEqual(rebuilt, p);
});
test("custom local references are not silently converted to schematic coordinates", () => {
  const p = planPayload([row], "local", "survey-grid-v1");
  assert.equal(p.stations[0].position.reference_id, "survey-grid-v1");
  assert.throws(() => planPayload([row], "local", ""));
  const geo = planPayload([{ ...row, first: "35.2", second: "33.1" }], "geo");
  assert.deepEqual(geo.stations[0].position, {
    latitude: 35.2,
    longitude: 33.1,
  });
});
test("invalid and duplicate plans fail before submission", () => {
  for (const changes of [
    { depths: "1,1" },
    { depths: "1," },
    { depths: "-1" },
    { depths: "1.0001" },
    { first: "" },
    { id: "bad station" },
  ]) {
    assert.throws(() => planPayload([{ ...row, ...changes }], "demo"));
  }
  assert.throws(() => planPayload([row, { ...row, key: "two" }], "demo"));
  assert.throws(() => planPayload([{ ...row, first: "91" }], "geo"));
});
test("comparison uses target depth, not actual depth, and retains retries and unplanned records", () => {
  const p = planPayload([{ ...row, depths: "1,2" }], "demo");
  const records = [
    {
      id: "a",
      station: "S01",
      depth: 1.1,
      quality: "unstable",
      packet: { target_depth_m: 1 },
    },
    {
      id: "b",
      station: "S01",
      depth: 1.2,
      quality: "ok",
      packet: { target_depth_m: 1 },
    },
    {
      id: "c",
      station: "S01",
      depth: 2,
      quality: "ok",
      packet: { target_depth_m: 9 },
    },
    {
      id: "d",
      station: "S99",
      depth: 2,
      quality: "ok",
      packet: { target_depth_m: 2 },
    },
  ];
  const r = comparePlan(p, records);
  assert.equal(r.targets[0].matches.length, 2);
  assert.equal(r.targets[0].valid.length, 1);
  assert.equal(r.targets[1].matches.length, 0);
  assert.equal(r.unplanned.length, 2);
  assert.equal(comparePlan(null, records).unplanned.length, 4);
});
