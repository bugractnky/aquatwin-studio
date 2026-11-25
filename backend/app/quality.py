"""Append-only calibration and parameter reviews. Original measurements never change."""

import statistics
import math
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from psycopg.types.json import Jsonb
from pydantic import AwareDatetime, Field, FiniteFloat, field_validator, model_validator

from .db import connect
from .operator import require_operator
from .schemas import Name, ParameterName, Source, StrictModel, UNITS

router = APIRouter(prefix="/api/v1", tags=["quality"])


class Reference(StrictModel):
    reference_value: FiniteFloat
    observed_value: FiniteFloat


class CalibrationIn(StrictModel):
    id: UUID
    sensor_id: Name
    parameter: ParameterName
    unit: Name
    source: Source
    performed_at: AwareDatetime
    expires_at: AwareDatetime | None = None
    procedure: Annotated[str, Field(min_length=1, max_length=2000, pattern=r"\S")]
    recorded_by: Name
    outcome: Literal["pass", "fail", "unreviewed"]
    references: list[Reference] = Field(min_length=1, max_length=20)

    @field_validator("performed_at", "expires_at")
    @classmethod
    def utc(cls, v):
        return v.astimezone(timezone.utc) if v else v

    @model_validator(mode="after")
    def valid(self):
        if self.unit != UNITS[self.parameter]:
            raise ValueError("Calibration unit must match parameter")
        if self.expires_at and self.expires_at < self.performed_at:
            raise ValueError("Calibration expires before it was performed")
        return self


class Thresholds(StrictModel):
    min_samples: Annotated[int, Field(strict=True, ge=2, le=1000)]
    min_duration_s: Annotated[FiniteFloat, Field(ge=0)]
    max_sd: Annotated[FiniteFloat, Field(ge=0)]
    rationale: Annotated[str, Field(min_length=1, max_length=1000, pattern=r"\S")]


class Assessment(StrictModel):
    status: Literal["unreviewed", "valid", "unstable", "invalid"]
    reason: Annotated[str, Field(min_length=1, max_length=1000, pattern=r"\S")]
    calibration_id: UUID | None = None
    thresholds: Thresholds | None = None


class ReviewIn(StrictModel):
    expected_revision: Annotated[int, Field(strict=True, ge=0)]
    recorded_by: Name
    parameters: dict[ParameterName, Assessment] = Field(min_length=1, max_length=5)


def raw_summary(packet, parameter, thresholds=None):
    raw = [
        (v["offset_s"], v["parameters"][parameter]["value"])
        for v in packet["raw_samples"]
        if parameter in v["parameters"]
    ]
    values = [v for _, v in raw]
    n = len(values)
    duration = raw[-1][0] - raw[0][0] if n else None
    sd = statistics.stdev(values) if n >= 2 else None
    if sd is not None and not math.isfinite(sd):
        return dict(
            n=n,
            duration_s=duration,
            mean=statistics.mean(values),
            sample_sd=None,
            stability="numeric_overflow",
        )
    outcome = "not_evaluated"
    if thresholds:
        outcome = (
            "insufficient"
            if n < thresholds["min_samples"] or duration < thresholds["min_duration_s"]
            else (
                "within_declared_threshold"
                if sd <= thresholds["max_sd"]
                else "exceeds_declared_threshold"
            )
        )
    return dict(
        n=n,
        duration_s=duration,
        mean=statistics.mean(values) if n else None,
        sample_sd=sd,
        stability=outcome,
    )


def measurement(conn, measurement_id, lock=False):
    row = conn.execute(
        "SELECT payload FROM measurements WHERE id=%s"
        + (" FOR UPDATE" if lock else ""),
        (measurement_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Measurement not found")
    return row["payload"]


def latest_review(conn, measurement_id):
    return conn.execute(
        "SELECT revision,payload,created_at FROM quality_reviews WHERE measurement_id=%s ORDER BY revision DESC LIMIT 1",
        (measurement_id,),
    ).fetchone()


def calibration_link(conn, calibration_id, packet, param):
    if not calibration_id:
        return None
    row = conn.execute(
        "SELECT payload FROM calibrations WHERE id=%s", (calibration_id,)
    ).fetchone()
    if not row:
        raise HTTPException(422, "Calibration not found")
    c = row["payload"]
    when = datetime.fromisoformat(packet["measured_at"].replace("Z", "+00:00"))
    performed = datetime.fromisoformat(c["performed_at"].replace("Z", "+00:00"))
    expired = (
        c["expires_at"]
        and datetime.fromisoformat(c["expires_at"].replace("Z", "+00:00")) < when
    )
    if (
        c["sensor_id"] != packet["parameters"][param]["sensor_id"]
        or c["parameter"] != param
        or c["source"] != packet["source"]
        or c["outcome"] != "pass"
        or performed > when
        or expired
    ):
        raise HTTPException(
            422,
            "Calibration identity/source/time/outcome does not match this measurement",
        )
    return c


@router.post("/calibrations", dependencies=[Depends(require_operator)])
def create_calibration(body: CalibrationIn, response: Response):
    payload = body.model_dump(mode="json")
    with connect() as conn:
        row = conn.execute(
            """INSERT INTO calibrations(id,sensor_id,parameter,source,performed_at,payload)
            VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING payload,created_at""",
            (
                body.id,
                body.sensor_id,
                body.parameter,
                body.source,
                body.performed_at,
                Jsonb(payload),
            ),
        ).fetchone()
        response.status_code = 201 if row else 200
        if not row:
            row = conn.execute(
                "SELECT payload,created_at FROM calibrations WHERE id=%s", (body.id,)
            ).fetchone()
            if row["payload"] != payload:
                raise HTTPException(409, "Calibration ID has different content")
        return {**row["payload"], "created_at": row["created_at"]}


@router.get("/calibrations")
def calibrations(
    sensor_id: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    with connect() as conn:
        rows = conn.execute(
            "SELECT payload,created_at FROM calibrations WHERE (%s::text IS NULL OR sensor_id=%s) ORDER BY performed_at DESC,id LIMIT %s OFFSET %s",
            (sensor_id, sensor_id, limit, offset),
        ).fetchall()
        total = conn.execute(
            "SELECT count(*) AS n FROM calibrations WHERE (%s::text IS NULL OR sensor_id=%s)",
            (sensor_id, sensor_id),
        ).fetchone()["n"]
    return dict(
        items=[{**r["payload"], "created_at": r["created_at"]} for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/measurements/{measurement_id}/quality")
def get_quality(measurement_id: UUID):
    with connect() as conn:
        packet = measurement(conn, measurement_id)
        latest = latest_review(conn, measurement_id)
        history = conn.execute(
            "SELECT revision,payload,created_at FROM quality_reviews WHERE measurement_id=%s ORDER BY revision DESC",
            (measurement_id,),
        ).fetchall()
        params = latest["payload"]["parameters"] if latest else {}
        summaries = {
            p: raw_summary(packet, p, params.get(p, {}).get("thresholds"))
            for p in packet["parameters"]
        }
    return dict(
        measurement_id=measurement_id,
        revision=latest["revision"] if latest else 0,
        review=latest["payload"] if latest else None,
        summaries=summaries,
        history=history,
    )


@router.put(
    "/measurements/{measurement_id}/quality", dependencies=[Depends(require_operator)]
)
def review(measurement_id: UUID, body: ReviewIn):
    with connect() as conn:
        packet = measurement(conn, measurement_id, True)
        if set(body.parameters) != set(packet["parameters"]):
            raise HTTPException(
                422, "Review must cover exactly the measured parameters"
            )
        latest = latest_review(conn, measurement_id)
        revision = latest["revision"] if latest else 0
        if body.expected_revision != revision:
            raise HTTPException(409, "Quality review changed; reload before saving")
        for param, value in body.parameters.items():
            calibration_link(conn, value.calibration_id, packet, param)
        payload = body.model_dump(mode="json", exclude={"expected_revision"})
        if latest and latest["payload"] == payload:
            return dict(revision=revision, review=payload)
        conn.execute(
            "INSERT INTO quality_reviews(measurement_id,revision,payload) VALUES (%s,%s,%s)",
            (measurement_id, revision + 1, Jsonb(payload)),
        )
        return dict(revision=revision + 1, review=payload)
