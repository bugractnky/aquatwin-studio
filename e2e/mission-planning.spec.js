import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const api = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5176";
const password = process.env.E2E_OPERATOR_PASSWORD;
const token = process.env.AQUATWIN_INGEST_TOKEN;

async function openPlanner(page) {
  expect(
    password,
    "Set E2E_OPERATOR_PASSWORD to match the running API",
  ).toBeTruthy();
  await page.addInitScript(() =>
    localStorage.setItem("aquatwin-source", "api"),
  );
  await page.goto("/");
  await page.getByLabel("Operatör parolası", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Operatör girişi", exact: true })
    .click();
  await expect(page.getByText("Operatör oturumu açık")).toBeVisible();
  await page
    .getByRole("button", { name: "Yeni görev oluştur", exact: true })
    .click();
}
async function fillStation(
  dialog,
  index,
  { x = "0", north = "0", depths = "1, 2, 3" } = {},
) {
  const station = dialog.getByRole("group", {
    name: `İstasyon ${index}`,
    exact: true,
  });
  await station.getByLabel("X · metre", { exact: true }).fill(x);
  await station.getByLabel("Kuzey · metre", { exact: true }).fill(north);
  await station
    .getByLabel("Hedef derinlikler · metre", { exact: true })
    .fill(depths);
}
async function create(page, name, two = false) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Görev adı", { exact: true }).fill(name);
  await fillStation(dialog, 1, { x: "-25", north: "-8" });
  if (two) {
    await dialog
      .getByRole("button", { name: "İstasyon ekle", exact: true })
      .click();
    await fillStation(dialog, 2, { x: "0", north: "0", depths: "1, 2" });
  }
  await dialog
    .getByRole("button", { name: "Planı kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return page
    .getByRole("combobox", { name: "Görev", exact: true })
    .inputValue();
}

test("operator creates and edits a persistent plan; measurements lock it and remain distinct from targets", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openPlanner(page);
  const name = `Planning E2E ${randomUUID()}`;
  const id = await create(page, name, true);
  const panel = page.getByRole("region", { name: "Kaydedilmiş görev planı" });
  await expect(panel).toContainText("Plan sürümü 1 · 2 istasyon");
  await expect(panel.getByRole("row")).toHaveCount(6);
  await panel
    .getByRole("button", { name: "Planı düzenle", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("group", { name: "İstasyon 1", exact: true })
    .getByLabel("Hedef derinlikler · metre", { exact: true })
    .fill("1, 2");
  await dialog
    .getByRole("button", { name: "Planı kaydet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(panel).toContainText("Plan sürümü 2 · 2 istasyon");
  await page.reload();
  await expect(page.getByText("Operatör oturumu açık")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(id);
  await expect(panel).toContainText("Plan sürümü 2 · 2 istasyon");
  const packet = {
    schema_version: 1,
    id: randomUUID(),
    mission_id: id,
    source: "simulated",
    device_id: "E2E-POD",
    station_id: "S01",
    measured_at: "2026-11-25T11:00:00Z",
    target_depth_m: 1,
    actual_depth_m: 1.1,
    position: {
      local_x_m: -25,
      local_north_m: -8,
      reference_id: "demo-pond-v1",
    },
    parameters: { temp: { value: 22, unit: "degC", sensor_id: "E2E-TEMP" } },
    quality: "valid",
    quality_reason: "Synthetic plan comparison fixture",
    raw_samples: [],
  };
  const result = await request.post(`${api}/api/v1/measurements`, {
    headers: { Authorization: `Bearer ${token}` },
    data: packet,
  });
  expect(result.status()).toBe(201);
  await page
    .getByRole("button", { name: "Ölçümleri yenile", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Planı yenile", exact: true })
    .click();
  await expect(panel).toContainText(
    "Plan kilitli: ölçüm kaydı veya ayrılmış simülasyon çalışması var",
  );
  await expect(panel).toContainText("Geçerli kayıt var");
  await expect(panel).toContainText("1.1 m");
  await expect(
    panel.getByRole("button", { name: "Planı düzenle", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/mission-plan-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mission-plan-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Oturumu kapat", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Yeni görev oluştur", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an editor keeps its original revision even when another operator changes the plan", async ({
  page,
}) => {
  test.setTimeout(60000);
  await openPlanner(page);
  const id = await create(page, `Concurrent plan ${randomUUID()}`);
  const panel = page.getByRole("region", { name: "Kaydedilmiş görev planı" });
  await panel
    .getByRole("button", { name: "Planı düzenle", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const remote = await (
    await page.request.get(`${base}/api/v1/missions/${id}/plan`)
  ).json();
  const session = await (
    await page.request.get(`${base}/api/v1/operator/session`)
  ).json();
  remote.plan.stations[0].name = "Changed elsewhere";
  const changed = await page.request.put(`${base}/api/v1/missions/${id}/plan`, {
    headers: { Origin: base, "X-CSRF-Token": session.csrf_token },
    data: { expected_revision: remote.revision, plan: remote.plan },
  });
  expect(changed.status()).toBe(200);
  await expect(
    panel.getByText("Plan sürümü 2 · 1 istasyon", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await dialog
    .getByRole("group", { name: "İstasyon 1", exact: true })
    .getByLabel("Hedef derinlikler · metre", { exact: true })
    .fill("1");
  await dialog
    .getByRole("button", { name: "Planı kaydet", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("409");
  const persisted = await (
    await page.request.get(`${base}/api/v1/missions/${id}/plan`)
  ).json();
  expect(persisted.revision).toBe(2);
  expect(persisted.plan.stations[0].name).toBe("Changed elsewhere");
});
