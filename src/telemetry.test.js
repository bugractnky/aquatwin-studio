import test from "node:test";
import assert from "node:assert/strict";
import { reportStatus, depthText } from "./telemetry.js";
test("telemetry ages locally across stale/offline boundaries without a new packet", () => {
  assert.match(reportStatus({ age_seconds: 14 }, 0).label, /güncel/);
  assert.match(reportStatus({ age_seconds: 14 }, 1).label, /gecikti/);
  assert.match(reportStatus({ age_seconds: 14 }, 46).label, /yok/);
  assert.equal(reportStatus({ age_seconds: NaN }).age, null);
});
test("unknown depth stays unknown and zero is preserved", () => {
  assert.equal(depthText(null), "Bilinmiyor");
  assert.equal(depthText(0), "0 m");
  assert.equal(depthText(2.1), "2.1 m");
});
