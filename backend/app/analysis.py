"""Reproducible local-metre IDW over explicitly selected mission/time data."""

import math
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import AwareDatetime, Field, FiniteFloat, model_validator, field_validator
from .db import connect
from .schemas import StrictModel, Name, ParameterName, UNITS

router = APIRouter(prefix="/api/v1", tags=["analysis"])


class Point(StrictModel):
    x_m: FiniteFloat
    north_m: FiniteFloat
    depth_m: Annotated[FiniteFloat, Field(ge=0)]


class AnalysisIn(StrictModel):
    mission_id: UUID
    parameter: ParameterName
    reference_id: Name
    start: AwareDatetime | None = None
    end: AwareDatetime | None = None
    points: list[Point] = Field(default_factory=list, max_length=200)
    depth_scale: Annotated[FiniteFloat, Field(gt=0, le=100)] = 1
    power: Annotated[FiniteFloat, Field(ge=1, le=4)] = 2
    radius_m: Annotated[FiniteFloat, Field(gt=0, le=100000)] = 20

    @field_validator("start", "end")
    @classmethod
    def utc(cls, value):
        return value.astimezone(timezone.utc) if value else value

    @model_validator(mode="after")
    def ordered(self):
        if self.start and self.end and self.start > self.end:
            raise ValueError("Start must precede end")
        return self


def distance(a, b, depth_scale):
    return math.hypot(
        a["x_m"] - b["x_m"],
        a["north_m"] - b["north_m"],
        (a["depth_m"] - b["depth_m"]) * depth_scale,
    )


def predict(observations, point, depth_scale, power, radius):
    candidates = sorted(
        ((distance(o, point, depth_scale), o) for o in observations),
        key=lambda v: (v[0], v[1]["id"]),
    )
    candidates = [(d, o) for d, o in candidates if math.isfinite(d) and d <= radius]
    if not candidates:
        return dict(value=None, kind="no_support", neighbors=0, nearest_m=None)
    nearest = candidates[0][0]
    if nearest < 1e-9:
        # Collocated points use the newest actual observation, never average it into an invented measurement.
        exact = max(
            (o for d, o in candidates if d < 1e-9),
            key=lambda o: (
                datetime.fromisoformat(o["measured_at"].replace("Z", "+00:00")),
                o["id"],
            ),
        )
        return dict(
            value=exact["value"],
            kind="measured",
            neighbors=1,
            nearest_m=nearest,
            measurement_id=exact["id"],
        )
    if len({(o["x_m"], o["north_m"], o["depth_m"]) for _, o in candidates}) < 2:
        return dict(
            value=None,
            kind="insufficient_support",
            neighbors=len(candidates),
            nearest_m=nearest,
        )
    weights = [(nearest / d) ** power for d, _ in candidates]
    scale = max(abs(o["value"]) for _, o in candidates)
    value = (
        scale
        * (
            sum(w * (o["value"] / scale) for w, (_, o) in zip(weights, candidates))
            / sum(weights)
        )
        if scale
        else 0
    )
    return dict(
        value=value, kind="interpolated", neighbors=len(candidates), nearest_m=nearest
    )


@router.post("/analysis")
def analyze(body: AnalysisIn):
    with connect() as conn:
        mission = conn.execute(
            "SELECT source FROM missions WHERE id=%s", (body.mission_id,)
        ).fetchone()
        if not mission:
            raise HTTPException(404, "Mission not found")
        rows = conn.execute(
            """SELECT m.payload,q.payload AS review FROM measurements m
            LEFT JOIN LATERAL (SELECT payload FROM quality_reviews WHERE measurement_id=m.id ORDER BY revision DESC LIMIT 1) q ON true
            WHERE m.mission_id=%s AND (%s::timestamptz IS NULL OR m.measured_at>=%s)
              AND (%s::timestamptz IS NULL OR m.measured_at<=%s)
            ORDER BY m.measured_at,m.id LIMIT 10001""",
            (body.mission_id, body.start, body.start, body.end, body.end),
        ).fetchall()
    if len(rows) > 10000:
        raise HTTPException(
            413, "Narrow the time window (more than 10000 measurements)"
        )
    # Latest attempt per planned target; an invalid latest attempt never falls back to an older valid one.
    latest = {}
    for row in rows:
        p = row["payload"]
        latest[(p["station_id"], p["target_depth_m"])] = row
    observations = []
    excluded = {"parameter_missing": 0, "quality": 0, "coordinate_reference": 0}
    for row in latest.values():
        p = row["payload"]
        param = p["parameters"].get(body.parameter)
        if not param:
            excluded["parameter_missing"] += 1
            continue
        assessment = (row["review"] or {}).get("parameters", {}).get(body.parameter)
        status = assessment["status"] if assessment else p["quality"]
        if status != "valid":
            excluded["quality"] += 1
            continue
        pos = p["position"]
        if pos.get("reference_id") != body.reference_id or pos.get("local_x_m") is None:
            excluded["coordinate_reference"] += 1
            continue
        observations.append(
            dict(
                id=p["id"],
                station_id=p["station_id"],
                measured_at=p["measured_at"],
                x_m=pos["local_x_m"],
                north_m=pos["local_north_m"],
                depth_m=p["actual_depth_m"],
                target_depth_m=p["target_depth_m"],
                value=param["value"],
                sensor_id=param["sensor_id"],
                quality_source="review" if assessment else "ingest",
                calibration_id=assessment.get("calibration_id") if assessment else None,
            )
        )
    observations.sort(key=lambda o: (o["station_id"], o["target_depth_m"], o["id"]))
    if len(observations) > 1000:
        raise HTTPException(
            413, "Narrow the time window (more than 1000 analysis observations)"
        )
    predictions = [
        {
            **point.model_dump(),
            **predict(
                observations,
                point.model_dump(),
                body.depth_scale,
                body.power,
                body.radius_m,
            ),
        }
        for point in body.points
    ]
    errors = []
    for actual in observations:
        estimated = predict(
            [o for o in observations if o["station_id"] != actual["station_id"]],
            actual,
            body.depth_scale,
            body.power,
            body.radius_m,
        )
        if estimated["value"] is not None:
            errors.append(estimated["value"] - actual["value"])
    rmse = math.hypot(*errors) / math.sqrt(len(errors)) if errors else None
    if rmse is not None and not math.isfinite(rmse):
        rmse = None
    return dict(
        algorithm="idw-local-v1",
        selection="latest attempt per station/target within inclusive time window; latest parameter review overrides ingest",
        settings=body.model_dump(mode="json"),
        source=mission["source"],
        unit=UNITS[body.parameter],
        observations=observations,
        excluded=excluded,
        predictions=predictions,
        validation=dict(
            method="leave-one-station-out",
            evaluated=len(errors),
            total=len(observations),
            rmse=rmse,
        ),
        limits="Local metre coordinates only; no GNSS transform, bathymetry, calibrated uncertainty or field validation. Radius is a support mask, not a confidence interval.",
    )
