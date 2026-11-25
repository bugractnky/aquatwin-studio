from uuid import UUID, uuid4
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import pytest
from send_sample import sample
from app.quality import raw_summary
from test_api import client, headers, mission
from test_plans import operator_settings, login


def measured(client, headers):
    m = mission(client, headers)
    p = sample(UUID(m["id"]))
    p["raw_samples"] = [
        {"offset_s": i, "parameters": deepcopy(p["parameters"])} for i in range(3)
    ]
    assert (
        client.post("/api/v1/measurements", json=p, headers=headers).status_code == 201
    )
    return p


def assessment(packet):
    return {
        "expected_revision": 0,
        "recorded_by": "Test operator",
        "parameters": {
            k: {
                "status": "valid",
                "reason": "Synthetic manual review",
                "thresholds": {
                    "min_samples": 3,
                    "min_duration_s": 2,
                    "max_sd": 0.1,
                    "rationale": "Synthetic test threshold",
                },
                "calibration_id": None,
            }
            for k in packet["parameters"]
        },
    }


def test_review_revision_raw_preservation_and_stats(client, headers):
    packet = measured(client, headers)
    url = f"/api/v1/measurements/{packet['id']}/quality"
    body = assessment(packet)
    assert client.put(url, json=body).status_code == 403
    op = login(client)
    first = client.put(url, json=body, headers=op)
    assert first.status_code == 200 and first.json()["revision"] == 1
    assert client.put(url, json=body, headers=op).status_code == 409
    data = client.get(url).json()
    assert data["summaries"]["temp"] == dict(
        n=3, duration_s=2, mean=23, sample_sd=0, stability="within_declared_threshold"
    )
    body["expected_revision"] = 1
    body["parameters"]["temp"]["status"] = "invalid"
    assert client.put(url, json=body, headers=op).json()["revision"] == 2
    assert len(client.get(url).json()["history"]) == 2
    original = client.get(
        "/api/v1/measurements", params={"mission_id": packet["mission_id"]}
    ).json()["items"][0]
    assert (
        original["quality"] == packet["quality"]
        and original["raw_samples"] == packet["raw_samples"]
    )
    body["expected_revision"] = 2
    body["parameters"].pop("do")
    assert client.put(url, json=body, headers=op).status_code == 422


def calibration(packet):
    return dict(
        id=str(uuid4()),
        sensor_id=packet["parameters"]["temp"]["sensor_id"],
        parameter="temp",
        unit="degC",
        source="simulated",
        performed_at="2026-11-24T09:00:00Z",
        expires_at="2026-12-01T00:00:00Z",
        procedure="Synthetic reference fixture",
        recorded_by="Test operator",
        outcome="pass",
        references=[dict(reference_value=20, observed_value=20.1)],
    )


def test_calibration_immutable_binding_and_expiry(client, headers):
    p = measured(client, headers)
    op = login(client)
    c = calibration(p)
    assert client.post("/api/v1/calibrations", json=c, headers=op).status_code == 201
    assert client.post("/api/v1/calibrations", json=c, headers=op).status_code == 200
    assert (
        client.post(
            "/api/v1/calibrations", json={**c, "procedure": "different"}, headers=op
        ).status_code
        == 409
    )
    body = assessment(p)
    body["parameters"]["temp"]["calibration_id"] = c["id"]
    url = f"/api/v1/measurements/{p['id']}/quality"
    assert client.put(url, json=body, headers=op).status_code == 200
    body["expected_revision"] = 1
    for change in [
        {"sensor_id": "different"},
        {"source": "device"},
        {"outcome": "fail"},
        {"expires_at": "2026-11-24T10:00:00Z"},
        {"performed_at": "2026-11-26T00:00:00Z"},
    ]:
        bad = {**c, **change, "id": str(uuid4())}
        assert (
            client.post("/api/v1/calibrations", json=bad, headers=op).status_code == 201
        )
        body["parameters"]["temp"]["calibration_id"] = bad["id"]
        assert client.put(url, json=body, headers=op).status_code == 422
    assert (
        client.get("/api/v1/calibrations", params={"sensor_id": c["sensor_id"]}).json()[
            "total"
        ]
        >= 1
    )


def test_no_threshold_or_missing_raw_does_not_invent_stability():
    p = {"raw_samples": []}
    assert raw_summary(p, "temp")["stability"] == "not_evaluated"
    assert (
        raw_summary(p, "temp", dict(min_samples=2, min_duration_s=1, max_sd=0.1))[
            "stability"
        ]
        == "insufficient"
    )
