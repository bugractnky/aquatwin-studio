import json
from uuid import uuid4

import httpx
import pytest
from app.simulation import reserve
from outbox import Outbox
from simulate_mission import packets
from test_api import client, headers, mission
from app.db import connect


def planned(client, headers):
    m = mission(client, headers)
    plan = {
        "schema_version": 1,
        "stations": [
            {
                "station_id": "S1",
                "name": "First",
                "position": {
                    "local_x_m": 0,
                    "local_north_m": 0,
                    "reference_id": "demo-pond-v1",
                },
                "target_depths_m": [1, 2],
            }
        ],
    }
    from psycopg.types.json import Jsonb

    with connect() as conn:
        conn.execute(
            "INSERT INTO mission_plans VALUES (%s,1,%s,now())", (m["id"], Jsonb(plan))
        )
    return m, plan


@pytest.mark.parametrize(
    "scenario", ["normal", "missing", "unstable", "restart", "fault"]
)
def test_simulation_replays_plan_with_durable_ids_and_locks(
    client, headers, tmp_path, scenario
):
    m, plan = planned(client, headers)
    run_request = dict(id=str(uuid4()), mission_id=m["id"], expected_revision=1)
    reserved = client.post("/api/v1/simulation-runs", json=run_request, headers=headers)
    assert reserved.status_code == 201
    assert (
        client.post(
            "/api/v1/simulation-runs", json=run_request, headers=headers
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/missions/{m['id']}/plan").json()["locked"]
    queue = tmp_path / "outbox.sqlite3"
    box = Outbox(queue)
    generated = list(packets(reserved.json(), scenario))
    meta = {"run": run_request["id"]}
    assert box.build(meta, generated)
    box.close()
    box = Outbox(queue)
    assert not box.build(meta, [])  # restart never regenerates timestamps or UUIDs

    class Sender:
        def post(self, path, json):
            return client.post(path, json=json, headers=headers)

    assert box.drain(Sender(), limit=1000) == len(generated)
    assert box.counts() == {"sent": len(generated)}
    count = client.get("/api/v1/measurements", params={"mission_id": m["id"]}).json()[
        "total"
    ]
    assert count == 2
    # Replay already acknowledged packets after a simulated lost local acknowledgment.
    with box.db:
        box.db.execute("UPDATE packets SET state='pending',next_attempt=0")
    assert box.drain(Sender(), limit=1000) == len(generated)
    assert (
        client.get("/api/v1/measurements", params={"mission_id": m["id"]}).json()[
            "total"
        ]
        == count
    )
    box.close()


def test_outbox_backoff_conflicts_and_auth(tmp_path):
    box = Outbox(tmp_path / "q.sqlite3")
    box.build({"run": "x"}, [("/api/v1/events", {"id": "one"})])

    def offline(request):
        raise httpx.ConnectError("offline")

    with httpx.Client(
        transport=httpx.MockTransport(offline), base_url="http://local"
    ) as c:
        assert box.drain(c, now=10) == 0
        assert box.db.execute("SELECT next_attempt FROM packets").fetchone()[0] == 12
        assert box.drain(c, now=11) == 0
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(409)),
        base_url="http://local",
    ) as c:
        assert box.drain(c, now=12) == 0
    assert box.counts() == {"blocked": 1}
    with box.db:
        box.db.execute("UPDATE packets SET state='pending',next_attempt=0")
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(401)),
        base_url="http://local",
    ) as c:
        with pytest.raises(PermissionError):
            box.drain(c)
    assert box.counts() == {"pending": 1}
    box.close()
