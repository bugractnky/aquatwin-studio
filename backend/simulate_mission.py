"""Generate a historical staged synthetic mission and replay through a durable outbox.

This is not a physical controller or wall-clock live device. Timestamps form a
past synthetic timeline so offline replay never fabricates fresh observations.
"""

import argparse
import json
import os
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4, uuid5

import httpx

from app.plans import SamplingPlan
from app.schemas import MeasurementIn
from app.telemetry import TelemetryIn, EventIn
from outbox import Outbox


def packets(run, scenario="normal"):
    plan = SamplingPlan.model_validate(run["plan"])
    run_id = UUID(str(run["id"]))
    count = sum(len(s.target_depths_m) for s in plan.stations)
    start = datetime.now(timezone.utc) - timedelta(
        seconds=count * 8 + len(plan.stations) * 3 + 10
    )
    sequence = 0
    timeline = 0
    session = str(uuid5(run_id, "session-0"))
    session_start = start

    def envelope(tag):
        nonlocal timeline
        timeline += 1
        return dict(
            schema_version=1,
            id=str(uuid5(run_id, tag)),
            mission_id=str(run["mission_id"]),
            device_id="SIM-BOAT",
            source="simulated",
            session_id=session,
            session_started_at=session_start.isoformat(),
            sequence=timeline,
            observed_at=(start + timedelta(seconds=timeline)).isoformat(),
        )

    def event(kind, message, station=None):
        body = dict(
            envelope(f"event-{timeline}"),
            kind=kind,
            severity="error" if kind == "fault" else "info",
            message=message,
            station_id=station,
        )
        EventIn.model_validate(body)
        return "/api/v1/events", body

    yield event(
        "mission_started",
        f'Synthetic historical replay; plan revision {run["revision"]}',
    )
    for station in plan.stations:
        yield event("station_arrived", "Synthetic station arrival", station.station_id)
        for depth in station.target_depths_m:
            for stage in ("lowering", "settling", "measuring"):
                body = dict(
                    envelope(f"telemetry-{timeline}"),
                    validity="valid",
                    validity_reason="Synthetic replay",
                    station_id=station.station_id,
                    position=station.position.model_dump(mode="json"),
                    target_depth_m=depth,
                    actual_depth_m=depth,
                    winch_stage=stage,
                )
                TelemetryIn.model_validate(body)
                yield "/api/v1/telemetry", body
            sequence += 1
            observed = (start + timedelta(seconds=timeline)).isoformat()
            values = {
                "temp": (24 - depth, "degC"),
                "ph": (7.8, "1"),
                "do": (8 - depth / 2, "mg/L"),
            }
            if scenario == "missing":
                values.pop("do")
            parameters = {
                k: dict(value=v, unit=u, sensor_id=f"SIM-{k}")
                for k, (v, u) in values.items()
            }
            raw = [
                dict(
                    offset_s=i,
                    parameters={
                        k: {
                            **v,
                            "value": v["value"]
                            + (0.8 if scenario == "unstable" and i % 2 else 0.01)
                            * (1 if i % 2 else -1),
                        }
                        for k, v in parameters.items()
                    },
                )
                for i in range(10)
            ]
            measurement = dict(
                schema_version=1,
                id=str(uuid5(run_id, f"measurement-{sequence}")),
                mission_id=str(run["mission_id"]),
                device_id="SIM-BOAT",
                station_id=station.station_id,
                source="simulated",
                measured_at=observed,
                target_depth_m=depth,
                actual_depth_m=depth,
                position=station.position.model_dump(mode="json"),
                parameters=parameters,
                raw_samples=raw,
                quality="unstable" if scenario == "unstable" else "unreviewed",
                quality_reason="Synthetic fixture; quality/calibration must be reviewed",
                calibration_id=None,
            )
            MeasurementIn.model_validate(measurement)
            yield "/api/v1/measurements", measurement
            yield event(
                "measurement_completed",
                "Synthetic sample window generated",
                station.station_id,
            )
            if scenario == "restart":
                # New UUID session, later start, sequence may restart independently.
                session = str(uuid5(run_id, f"session-{sequence}"))
                session_start = start + timedelta(seconds=timeline)
        body = dict(
            envelope(f"telemetry-{timeline}"),
            validity="valid",
            validity_reason="Synthetic retraction",
            station_id=station.station_id,
            actual_depth_m=0,
            target_depth_m=0,
            winch_stage="idle",
        )
        yield "/api/v1/telemetry", body
        yield event(
            "retraction_completed",
            "Synthetic pod retracted before transit",
            station.station_id,
        )
        if scenario == "fault":
            yield event(
                "fault",
                "Synthetic winch fault; replay stops without claiming mission completion",
                station.station_id,
            )
            return
    yield event(
        "mission_completed", "Synthetic replay completed; no physical execution"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--outbox", required=True)
    parser.add_argument("--mission", type=UUID)
    parser.add_argument(
        "--scenario",
        choices=["normal", "missing", "unstable", "restart", "fault"],
        default="normal",
    )
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Retry pending work with backoff until drained; Ctrl+C preserves work",
    )
    args = parser.parse_args()
    token = os.environ.get("AQUATWIN_INGEST_TOKEN")
    if not token:
        parser.error(
            "Set AQUATWIN_INGEST_TOKEN; never put it in the outbox or frontend"
        )
    box = Outbox(args.outbox)
    try:
        with httpx.Client(
            base_url=args.url, headers={"Authorization": f"Bearer {token}"}, timeout=8
        ) as client:
            if not box.db.execute("SELECT 1 FROM metadata WHERE key='run'").fetchone():
                if not args.mission:
                    parser.error(
                        "A new outbox requires --mission (an existing simulated planned mission)"
                    )
                plan = client.get(f"/api/v1/missions/{args.mission}/plan")
                plan.raise_for_status()
                run = client.post(
                    "/api/v1/simulation-runs",
                    json=dict(
                        id=str(uuid4()),
                        mission_id=str(args.mission),
                        expected_revision=plan.json()["revision"],
                    ),
                )
                run.raise_for_status()
                run = run.json()
                box.build(
                    dict(
                        run_id=run["id"],
                        mission_id=run["mission_id"],
                        revision=run["revision"],
                        scenario=args.scenario,
                    ),
                    packets(run, args.scenario),
                )
            else:
                meta = json.loads(
                    box.db.execute(
                        "SELECT value FROM metadata WHERE key='run'"
                    ).fetchone()["value"]
                )
                if args.mission and str(args.mission) != meta["mission_id"]:
                    parser.error("Outbox belongs to another mission")
            if not args.generate_only:
                while True:
                    box.drain(client)
                    counts = box.counts()
                    print(json.dumps(counts))
                    if not args.watch or not counts.get("pending"):
                        break
                    time.sleep(2)
            print(json.dumps(box.counts()))
    finally:
        box.close()


if __name__ == "__main__":
    main()
