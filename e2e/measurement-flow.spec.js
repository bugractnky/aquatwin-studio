import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const token = process.env.AQUATWIN_INGEST_TOKEN;
const api = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const headers = () => ({ Authorization: `Bearer ${token}` });

async function seed(request, name, source = "simulated") {
  const id = randomUUID();
  const mission = await request.post(`${api}/api/v1/missions`, {
    headers: headers(),
    data: { id, name, source },
  });
  expect(mission.status()).toBe(201);
  const packet = {
    schema_version: 1,
    id: randomUUID(),
    mission_id: id,
    device_id: "E2E-POD",
    station_id: "S01",
    source,
    measured_at: "2026-11-25T09:00:00Z",
    target_depth_m: 1,
    actual_depth_m: 1,
    position: {
      local_x_m: -25,
      local_north_m: -8,
      reference_id: "demo-pond-v1",
    },
    parameters: { temp: { value: 22.5, unit: "degC", sensor_id: "E2E-TEMP" } },
    quality: "valid",
    quality_reason: "Synthetic browser-test fixture",
    raw_samples: [],
  };
  const created = await request.post(`${api}/api/v1/measurements`, {
    headers: headers(),
    data: packet,
  });
  expect(created.status()).toBe(201);
  const repeated = await request.post(`${api}/api/v1/measurements`, {
    headers: headers(),
    data: packet,
  });
  expect(repeated.status()).toBe(200);
  return { id, packet };
}

test("external measurement persists and appears in the shared table and 3D workspace", async ({
  page,
  request,
}) => {
  expect(
    token,
    "Set AQUATWIN_INGEST_TOKEN to match the running local API",
  ).toBeTruthy();
  const { id, packet } = await seed(request, `E2E measurement ${randomUUID()}`);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "API çalışma alanı", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "API çalışma alanı", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(id);
  await expect(
    page.getByText("1 ölçüm · 1 geçerli", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("1 / 1 kayıt bu parametreyle sahneye yerleştirilebilir.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "22.5 °C", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Ölçülmedi", exact: true }),
  ).toHaveCount(4);
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(`${packet.id} kaydını aç`) })
    .click();
  await expect(page.getByRole("dialog")).toContainText(packet.id);
  await expect(page.getByRole("dialog")).toContainText("Belirtilmedi");
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  await page
    .getByRole("combobox", { name: "3D parametresi", exact: true })
    .selectOption("do");
  await expect(
    page.getByText("0 / 1 kayıt bu parametreyle sahneye yerleştirilebilir.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "3D parametresi", exact: true })
    .selectOption("temp");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(id);
  await expect(
    page.getByRole("cell", { name: "22.5 °C", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/api-workspace.png",
    fullPage: true,
  });
  await page.route("**/api/v1/measurements?**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page
    .getByRole("button", { name: "Ölçümleri yenile", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("503");
  await expect(
    page.getByRole("cell", { name: "22.5 °C", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/measurements?**");
  await page
    .getByRole("button", { name: "Ölçümleri yenile", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/api-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sentetik demoya dön" }).click();
  await expect(
    page.getByRole("button", { name: "API çalışma alanı", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("empty missions, unavailable API and narrow layout have explicit states", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("aquatwin-source", "api"),
  );
  await page.route("**/api/v1/missions?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Henüz görev yok" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.unroute("**/api/v1/missions?**");
  await page.route("**/api/v1/missions?**", (route) =>
    route.fulfill({ status: 503, body: "{}", contentType: "application/json" }),
  );
  await page.getByRole("button", { name: "Görevleri yenile" }).click();
  await expect(page.getByRole("alert")).toContainText("demo verisi eklenmez");
});
