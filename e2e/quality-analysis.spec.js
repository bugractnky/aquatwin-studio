import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const api = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const token = process.env.AQUATWIN_INGEST_TOKEN;
const headers = { Authorization: `Bearer ${token}` };

test("operator records calibration and quality; API IDW remains mission scoped and labels estimates", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const missions = [];
  const packets = [];
  for (let n = 0; n < 2; n++) {
    const m = {
      id: randomUUID(),
      name: `Analysis fixture ${n} ${randomUUID()}`,
      source: "simulated",
    };
    missions.push(m);
    expect(
      (
        await request.post(`${api}/api/v1/missions`, { headers, data: m })
      ).status(),
    ).toBe(201);
    for (let i = 0; i < 3; i++) {
      const parameters = {
        temp: {
          value: 20 + i * 2 - n,
          unit: "degC",
          sensor_id: "E2E-REVIEW-TEMP",
        },
      };
      const p = {
        schema_version: 1,
        id: randomUUID(),
        mission_id: m.id,
        device_id: "E2E",
        station_id: `S${i}`,
        source: "simulated",
        measured_at: "2026-11-25T09:00:00Z",
        target_depth_m: 1,
        actual_depth_m: 1,
        position: {
          local_x_m: (i - 1) * 10,
          local_north_m: 0,
          reference_id: "demo-pond-v1",
        },
        parameters,
        quality: "valid",
        quality_reason: "Synthetic analysis fixture",
        raw_samples: [0, 1, 2].map((offset_s) => ({ offset_s, parameters })),
      };
      expect(
        (
          await request.post(`${api}/api/v1/measurements`, { headers, data: p })
        ).status(),
      ).toBe(201);
      if (n === 0) packets.push(p);
    }
  }
  await page.addInitScript(() =>
    localStorage.setItem("aquatwin-source", "api"),
  );
  await page.goto("/");
  await page
    .getByLabel("Operatör parolası", { exact: true })
    .fill(process.env.E2E_OPERATOR_PASSWORD);
  await page
    .getByRole("button", { name: "Operatör girişi", exact: true })
    .click();
  await expect(page.getByText("Operatör oturumu açık")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(missions[0].id);
  await page
    .getByRole("button", { name: new RegExp(`${packets[0].id} kaydını aç`) })
    .click();
  const dialog = page.getByRole("dialog");
  const review = dialog.getByRole("region", {
    name: "Parametre kalite incelemesi",
  });
  await expect(review).toContainText("Değerlendirme sürümü 0");
  await review
    .getByLabel("Kaydı giren kişi (beyan)", { exact: true })
    .fill("E2E draft author");
  await review
    .getByText("Yeni kalibrasyon kaydı ekle", { exact: true })
    .click();
  await review
    .getByLabel("Uygulanma zamanı (yerel)", { exact: true })
    .fill("2026-11-24T12:00");
  await review
    .getByLabel("Prosedür ve referans malzeme", { exact: true })
    .fill("Synthetic reference test");
  await review
    .getByLabel("Kalibrasyonu kaydeden (beyan)", { exact: true })
    .fill("E2E operator");
  await review
    .getByRole("combobox", { name: "Kalibrasyon sonucu", exact: true })
    .selectOption("pass");
  await review.getByLabel("Referans değeri", { exact: true }).fill("20");
  await review.getByLabel("Gözlenen değer", { exact: true }).fill("20.1");
  await review
    .getByRole("button", { name: "Kalibrasyonu kaydet", exact: true })
    .click();
  const calibrations = review.getByRole("combobox", {
    name: "Kalibrasyon · Su sıcaklığı",
    exact: true,
  });
  await expect(calibrations.locator("option")).not.toHaveCount(1);
  const calibration = (await calibrations.locator("option").all()).at(-1);
  await calibrations.selectOption(await calibration.getAttribute("value"));
  await expect(
    review.getByLabel("Kaydı giren kişi (beyan)", { exact: true }),
  ).toHaveValue("E2E draft author");
  await review
    .getByLabel("Kaydı giren kişi (beyan)", { exact: true })
    .fill("E2E reviewer");
  await review
    .getByRole("combobox", { name: "Karar · Su sıcaklığı", exact: true })
    .selectOption("valid");
  await review
    .getByLabel("Gerekçe · Su sıcaklığı", { exact: true })
    .fill("Synthetic review with linked reference");
  await review
    .getByRole("button", { name: "Kalite değerlendirmesini kaydet" })
    .click();
  await expect(review).toContainText("Değerlendirme sürümü 1");
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  const analysis = page.getByRole("region", { name: "API ölçüm analizi" });
  await analysis.getByLabel("Sorgu X (m)", { exact: true }).fill("5");
  await analysis
    .getByRole("combobox", { name: "Karşılaştırılacak görev", exact: true })
    .selectOption(missions[1].id);
  await analysis
    .getByRole("button", { name: "API analizini hesapla", exact: true })
    .click();
  await expect(analysis).toContainText("3 gözlem · idw-local-v1");
  await expect(analysis).toContainText("interpolated");
  await expect(analysis).toContainText("1.000");
  await expect(
    analysis.getByRole("img", {
      name: "IDW tahmin ızgarası ve seçilen derinlikteki ölçüm noktaları",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/quality-analysis-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/quality-analysis-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("combobox", { name: "Görev", exact: true })
    .selectOption(missions[0].id);
  await page
    .getByRole("button", { name: new RegExp(`${packets[0].id} kaydını aç`) })
    .click();
  await expect(review).toContainText("Değerlendirme sürümü 1");
  expect(errors).toEqual([]);
});

test("external simulator resumes a persisted outbox over the real HTTP API", async ({
  request,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:5176";
  const login = await request.post(`${api}/api/v1/operator/session`, {
    headers: { Origin: origin },
    data: { password: process.env.E2E_OPERATOR_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const op = {
    Origin: origin,
    "X-CSRF-Token": (await login.json()).csrf_token,
  };
  const mission = {
    id: randomUUID(),
    name: `External replay ${randomUUID()}`,
    source: "simulated",
    plan: {
      schema_version: 1,
      stations: [
        {
          station_id: "S1",
          name: "Station 1",
          position: {
            local_x_m: 0,
            local_north_m: 0,
            reference_id: "demo-pond-v1",
          },
          target_depths_m: [1, 2],
        },
      ],
    },
  };
  expect(
    (
      await request.post(`${api}/api/v1/planned-missions`, {
        headers: op,
        data: mission,
      })
    ).status(),
  ).toBe(201);
  const folder = mkdtempSync(join(tmpdir(), "aquatwin-replay-"));
  const path = join(folder, "queue.sqlite3");
  const python = process.env.E2E_PYTHON || "python3";
  const run = (args) => {
    const result = spawnSync(
      python,
      ["backend/simulate_mission.py", "--url", api, "--outbox", path, ...args],
      { encoding: "utf8", timeout: 20000, env: process.env },
    );
    expect(result.status, result.stderr).toBe(0);
  };
  try {
    run(["--mission", mission.id, "--generate-only"]);
    expect(
      (
        await (
          await request.get(
            `${api}/api/v1/measurements?mission_id=${mission.id}`,
          )
        ).json()
      ).total,
    ).toBe(0);
    run(["--watch"]);
    run(["--watch"]);
    expect(
      (
        await (
          await request.get(
            `${api}/api/v1/measurements?mission_id=${mission.id}`,
          )
        ).json()
      ).total,
    ).toBe(2);
    expect(
      (
        await (
          await request.get(`${api}/api/v1/missions/${mission.id}/events`)
        ).json()
      ).items.some((e) => e.kind === "mission_completed"),
    ).toBe(true);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
