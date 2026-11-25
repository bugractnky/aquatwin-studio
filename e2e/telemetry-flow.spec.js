import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const api = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const headers = {
  Authorization: `Bearer ${process.env.AQUATWIN_INGEST_TOKEN}`,
};

test("telemetry preserves ordering, ages independently, survives outage and isolates missions", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mission = {
    id: randomUUID(),
    name: `Telemetry E2E ${randomUUID()}`,
    source: "simulated",
  };
  const other = {
    ...mission,
    id: randomUUID(),
    name: `Empty telemetry ${randomUUID()}`,
  };
  for (const m of [mission, other])
    expect(
      (
        await request.post(`${api}/api/v1/missions`, { headers, data: m })
      ).status(),
    ).toBe(201);
  const observed = new Date(Date.now() - 2000).toISOString();
  const packet = {
    schema_version: 1,
    id: randomUUID(),
    mission_id: mission.id,
    device_id: "E2E-BOAT",
    source: "simulated",
    session_id: randomUUID(),
    session_started_at: new Date(Date.now() - 120000).toISOString(),
    sequence: 10,
    observed_at: observed,
    validity: "valid",
    validity_reason: "Synthetic browser fixture",
    target_depth_m: 2,
    actual_depth_m: 1.9,
    winch_stage: "measuring",
  };
  expect(
    (
      await request.post(`${api}/api/v1/telemetry`, { headers, data: packet })
    ).status(),
  ).toBe(201);
  const event = {
    ...packet,
    id: randomUUID(),
    sequence: 0,
    kind: "station_arrived",
    severity: "info",
    message: "Synthetic station arrival",
  };
  for (const key of [
    "validity",
    "validity_reason",
    "target_depth_m",
    "actual_depth_m",
    "winch_stage",
  ])
    delete event[key];
  expect(
    (
      await request.post(`${api}/api/v1/events`, { headers, data: event })
    ).status(),
  ).toBe(201);
  await page.addInitScript(() =>
    localStorage.setItem("aquatwin-source", "api"),
  );
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(mission.id);
  const panel = page.getByRole("region", {
    name: "Telemetri ve görev olayları",
  });
  await expect(panel).toContainText("E2E-BOAT");
  await expect(panel).toContainText("2 m / 1.9 m");
  await expect(panel).toContainText("Synthetic station arrival");
  const old = {
    ...packet,
    id: randomUUID(),
    sequence: 1,
    actual_depth_m: 0.5,
    observed_at: new Date(Date.now() - 60000).toISOString(),
  };
  expect(
    (
      await request.post(`${api}/api/v1/telemetry`, { headers, data: old })
    ).status(),
  ).toBe(201);
  await panel.getByRole("button", { name: "Telemetriyi yenile" }).click();
  await expect(panel).toContainText("2 m / 1.9 m");
  await page.route("**/api/v1/missions/*/telemetry", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"detail":"Synthetic outage"}',
    }),
  );
  await panel.getByRole("button", { name: "Telemetriyi yenile" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "API erişimi doğrulanamadı",
  );
  await expect(panel).toContainText("2 m / 1.9 m");
  await page.unroute("**/api/v1/missions/*/telemetry");
  const restart = {
    ...packet,
    id: randomUUID(),
    session_id: randomUUID(),
    session_started_at: new Date(Date.now() - 100000).toISOString(),
    observed_at: new Date(Date.now() - 80000).toISOString(),
    sequence: 0,
    actual_depth_m: null,
    target_depth_m: null,
    winch_stage: null,
    validity: "invalid",
    validity_reason: "Synthetic unavailable depth",
  };
  expect(
    (
      await request.post(`${api}/api/v1/telemetry`, { headers, data: restart })
    ).status(),
  ).toBe(201);
  await panel.getByRole("button", { name: "Telemetriyi yenile" }).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel).toContainText("Telemetri yok");
  await expect(panel).toContainText("alanlar kullanılmıyor");
  await expect(panel).not.toContainText("2 m / 1.9 m");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(mission.id);
  await expect(panel).toContainText("Synthetic unavailable depth");
  await page.screenshot({
    path: "test-results/telemetry-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/telemetry-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(other.id);
  await expect(panel).toContainText("Henüz telemetri yok");
  await expect(panel).not.toContainText("E2E-BOAT");
  expect(errors).toEqual([]);
});
