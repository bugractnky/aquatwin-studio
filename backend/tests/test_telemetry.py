from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from test_api import client, headers, mission


def packet(m, **changes):
    now = datetime.now(timezone.utc) - timedelta(seconds=2)
    return dict(schema_version=1, id=str(uuid4()), mission_id=m['id'], device_id='fixture-boat',
                source='simulated', session_id=str(uuid4()), session_started_at=(now-timedelta(seconds=10)).isoformat(),
                sequence=0, observed_at=now.isoformat(), validity='valid', validity_reason='Synthetic fixture', **changes)


def send(client, headers, body):
    return client.post('/api/v1/telemetry', json=body, headers=headers)


def latest(client, m):
    return client.get(f"/api/v1/missions/{m['id']}/telemetry").json()['items']


def test_auth_retry_conflict_source_and_unknown(client, headers):
    m = mission(client, headers)
    p = packet(m)
    assert send(client, {}, p).status_code == 401
    first = send(client, headers, p)
    assert first.status_code == 201
    assert send(client, headers, p).json() == first.json()
    assert send(client, headers, {**p, 'validity_reason': 'changed'}).status_code == 409
    assert send(client, headers, {**p, 'id': str(uuid4())}).status_code == 409
    assert send(client, headers, {**p, 'source': 'device'}).status_code == 409
    assert send(client, headers, {**p, 'mission_id': str(uuid4())}).status_code == 404
    assert latest(client, m)[0]['actual_depth_m'] is None


def test_reorder_old_session_and_invalid_snapshot(client, headers):
    m = mission(client, headers)
    p = packet(m)
    assert send(client, headers, {**p, 'sequence': 10, 'actual_depth_m': 2}).status_code == 201
    assert send(client, headers, {**p, 'id': str(uuid4()), 'sequence': 1, 'actual_depth_m': 1}).status_code == 201
    assert latest(client, m)[0]['actual_depth_m'] == 2
    new = {**p, 'id': str(uuid4()), 'session_id': str(uuid4()), 'sequence': 0,
           'session_started_at': p['observed_at'], 'validity': 'invalid', 'actual_depth_m': None}
    assert send(client, headers, new).status_code == 201
    assert send(client, headers, {**p, 'id': str(uuid4()), 'sequence': 11}).status_code == 201
    current = latest(client, m)[0]
    assert current['session_id'] == new['session_id']
    assert current['validity'] == 'invalid'
    assert current['actual_depth_m'] is None
    with TestClient(app) as restarted:
        assert latest(restarted, m)[0]['id'] == new['id']


def test_age_uses_device_time_and_retries_do_not_refresh(client, headers):
    m = mission(client, headers)
    for age, expected in [(2, 'fresh'), (25, 'stale'), (90, 'offline')]:
        p = packet(m)
        t = datetime.now(timezone.utc) - timedelta(seconds=age)
        p.update(device_id=f'age-{age}', observed_at=t.isoformat(), session_started_at=t.isoformat())
        first = send(client, headers, p)
        assert first.status_code == 201
        assert send(client, headers, p).json()['received_at'] == first.json()['received_at']
        row = next(r for r in latest(client, m) if r['device_id'] == p['device_id'])
        assert row['freshness'] == expected


@pytest.mark.parametrize('change', [
    {'sequence': -1}, {'sequence': True}, {'observed_at': '2026-11-26T00:00:00'},
    {'actual_depth_m': -1}, {'position': {'latitude': 1}}, {'winch_stage': 'flying'},
    {'observed_at': '2099-01-01T00:00:00Z'}, {'unexpected': 1},
])
def test_invalid_reports(client, headers, change):
    assert send(client, headers, {**packet(mission(client, headers)), **change}).status_code == 422


def test_time_and_session_conflicts(client, headers):
    m = mission(client, headers)
    p = packet(m)
    assert send(client, headers, p).status_code == 201
    assert send(client, headers, {**p, 'id': str(uuid4()), 'sequence': 1,
                                'session_started_at': p['observed_at']}).status_code == 409
    assert send(client, headers, {**p, 'id': str(uuid4()), 'session_id': str(uuid4())}).status_code == 409
    before = (datetime.fromisoformat(p['observed_at']) - timedelta(seconds=1)).isoformat()
    assert send(client, headers, {**p, 'id': str(uuid4()), 'sequence': 2, 'observed_at': before}).status_code == 422


def test_events_persist_paginate_isolate_and_authorize(client, headers):
    a, b = mission(client, headers), mission(client, headers)
    base = packet(a)
    base.pop('validity'); base.pop('validity_reason')
    event = {**base, 'kind': 'station_arrived', 'severity': 'info', 'message': 'Synthetic arrival'}
    assert client.post('/api/v1/events', json=event).status_code == 401
    first = client.post('/api/v1/events', json=event, headers=headers)
    assert first.status_code == 201
    assert client.post('/api/v1/events', json=event, headers=headers).json() == first.json()
    assert client.post('/api/v1/events', json={**event, 'message': 'different'}, headers=headers).status_code == 409
    second = {**event, 'id': str(uuid4()), 'sequence': 1}
    assert client.post('/api/v1/events', json=second, headers=headers).status_code == 201
    url = f"/api/v1/missions/{a['id']}/events"
    assert client.get(url+'?limit=1&offset=1').json()['total'] == 2
    assert len(client.get(url+'?limit=1&offset=1').json()['items']) == 1
    assert client.get(f"/api/v1/missions/{b['id']}/events").json()['total'] == 0
    assert latest(client, a) == []  # Events do not become a device heartbeat.
    assert client.get(f'/api/v1/missions/{uuid4()}/telemetry').status_code == 404
