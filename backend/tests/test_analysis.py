from uuid import UUID, uuid4
from copy import deepcopy
import pytest
from app.analysis import predict
from test_api import client, headers, mission
from send_sample import sample
from test_plans import operator_settings, login
from test_quality import assessment


def body(m):
    return dict(
        mission_id=m["id"],
        parameter="temp",
        reference_id="demo-pond-v1",
        depth_scale=1,
        power=2,
        radius_m=100,
        points=[dict(x_m=0, north_m=0, depth_m=1)],
    )


def test_idw_local_exact_mask_and_range():
    obs = [
        dict(
            id="a",
            station_id="A",
            measured_at="2026-01-01",
            x_m=-1,
            north_m=0,
            depth_m=1,
            value=10,
        ),
        dict(
            id="b",
            station_id="B",
            measured_at="2026-01-01",
            x_m=1,
            north_m=0,
            depth_m=1,
            value=20,
        ),
    ]
    p = dict(x_m=0, north_m=0, depth_m=1)
    assert predict(obs, p, 1, 2, 2)["value"] == 15
    assert predict(obs, {**p, "x_m": -1}, 1, 2, 2)["kind"] == "measured"
    assert predict(obs, p, 1, 2, 0.1)["value"] is None
    assert predict(obs[:1], p, 1, 2, 2)["value"] is None


def test_analysis_filters_latest_parameter_reviews_and_time(client, headers):
    m = mission(client, headers)
    measurements = []
    for i, x in enumerate([-1, 1]):
        p = sample(UUID(m["id"]), i)
        p["station_id"] = f"S{i}"
        p["actual_depth_m"] = 1
        p["target_depth_m"] = 1
        p["position"] = {
            "local_x_m": x,
            "local_north_m": 0,
            "reference_id": "demo-pond-v1",
        }
        p["parameters"]["temp"]["value"] = 10 + i * 10
        assert (
            client.post("/api/v1/measurements", json=p, headers=headers).status_code
            == 201
        )
        measurements.append(p)
    query = body(m)
    result = client.post("/api/v1/analysis", json=query).json()
    assert result["predictions"][0]["value"] == 15
    assert result["source"] == "simulated" and len(result["observations"]) == 2
    assert (
        result["validation"]["evaluated"] == 0
    )  # only one held-in location; do not invent validation
    query["start"] = "2026-11-25T09:01:00Z"
    assert len(client.post("/api/v1/analysis", json=query).json()["observations"]) == 1
    query = body(m)
    query["reference_id"] = "another-frame"
    assert (
        client.post("/api/v1/analysis", json=query).json()["excluded"][
            "coordinate_reference"
        ]
        == 2
    )
    query = body(m)
    query["parameter"] = "ec"
    assert client.post("/api/v1/analysis", json=query).json()["observations"] == []
    query = body(m)
    review = assessment(measurements[0])
    review["parameters"]["temp"]["status"] = "invalid"
    assert (
        client.put(
            f"/api/v1/measurements/{measurements[0]['id']}/quality",
            json=review,
            headers=login(client),
        ).status_code
        == 200
    )
    assert len(client.post("/api/v1/analysis", json=query).json()["observations"]) == 1
    # New unreviewed attempt must not silently fall back to old valid observation.
    p = deepcopy(measurements[1])
    p.update(id=str(uuid4()), measured_at="2026-11-25T10:00:00Z", quality="unreviewed")
    assert (
        client.post("/api/v1/measurements", json=p, headers=headers).status_code == 201
    )
    assert client.post("/api/v1/analysis", json=query).json()["observations"] == []


def test_analysis_isolates_missions_and_rejects_bad_settings(client, headers):
    a, b = mission(client, headers), mission(client, headers)
    query = body(a)
    assert client.post("/api/v1/analysis", json=query).json()["observations"] == []
    for change in [
        dict(power=0),
        dict(radius_m=-1),
        dict(depth_scale=0),
        dict(start="2026-01-02T00:00:00Z", end="2026-01-01T00:00:00Z"),
    ]:
        assert (
            client.post("/api/v1/analysis", json={**query, **change}).status_code == 422
        )
    assert (
        client.post(
            "/api/v1/analysis", json={**query, "mission_id": str(uuid4())}
        ).status_code
        == 404
    )


def test_collocated_samples_use_actual_timestamp_not_lexical_fraction_order():
    base = dict(station_id="A", x_m=0, north_m=0, depth_m=1)
    obs = [
        dict(base, id="a", measured_at="2026-01-01T00:00:00Z", value=10),
        dict(base, id="b", measured_at="2026-01-01T00:00:00.500000Z", value=20),
    ]
    assert predict(obs, base, 1, 2, 20)["value"] == 20
