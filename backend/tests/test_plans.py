from copy import deepcopy
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import connect
from app.operator import COOKIE, token_hash
from send_sample import sample
from test_api import client, headers, mission

ORIGIN = 'http://127.0.0.1:5176'
PASSWORD = 'test-only-operator-password'


@pytest.fixture(autouse=True)
def operator_settings(monkeypatch):
    monkeypatch.setenv('AQUATWIN_OPERATOR_PASSWORD', PASSWORD)


def login(client):
    response = client.post('/api/v1/operator/session', json={'password': PASSWORD}, headers={'Origin': ORIGIN})
    assert response.status_code == 200
    assert 'HttpOnly' in response.headers['set-cookie']
    assert 'SameSite=strict' in response.headers['set-cookie']
    return {'Origin': ORIGIN, 'X-CSRF-Token': response.json()['csrf_token']}


def plan():
    return {'schema_version': 1, 'stations': [
        {'station_id': 'S01', 'name': 'First station',
         'position': {'local_x_m': -25, 'local_north_m': -8, 'reference_id': 'demo-pond-v1'},
         'target_depths_m': [1, 2, 3]},
        {'station_id': 'S02', 'name': 'Second station',
         'position': {'local_x_m': 0, 'local_north_m': 0, 'reference_id': 'demo-pond-v1'},
         'target_depths_m': [0, 1]},
    ]}


def create(client, op=None):
    op = op or login(client)
    body = {'id': str(uuid4()), 'name': 'Persistent planned mission', 'source': 'simulated', 'plan': plan()}
    result = client.post('/api/v1/planned-missions', json=body, headers=op)
    assert result.status_code == 201, result.text
    return body, op


def test_session_disabled_or_unauthorized(client, monkeypatch):
    monkeypatch.delenv('AQUATWIN_OPERATOR_PASSWORD')
    assert client.get('/api/v1/operator/session').json()['enabled'] is False
    assert client.post('/api/v1/operator/session', json={'password': PASSWORD}, headers={'Origin': ORIGIN}).status_code == 503
    monkeypatch.setenv('AQUATWIN_OPERATOR_PASSWORD', PASSWORD)
    assert client.get('/api/v1/operator/session').json()['authenticated'] is False
    assert client.post('/api/v1/operator/session', json={'password': 'wrong'}, headers={'Origin': ORIGIN}).status_code == 401
    assert client.post('/api/v1/operator/session', json={'password': PASSWORD}, headers={'Origin': 'http://evil.example'}).status_code == 403
    assert client.post('/api/v1/planned-missions', json={'id': str(uuid4()), 'name': 'test', 'source': 'simulated', 'plan': plan()}, headers={'Origin': ORIGIN}).status_code == 401


def test_csrf_logout_expiry_and_token_separation(client, headers):
    body, op = create(client)
    url = f"/api/v1/missions/{body['id']}/plan"
    update = {'expected_revision': 1, 'plan': plan()}
    assert client.put(url, json=update, headers={'Origin': ORIGIN}).status_code == 403
    assert client.put(url, json=update, headers={**op, 'Origin': 'http://evil.example'}).status_code == 403
    # Being an operator does not grant device-ingest rights.
    assert client.post('/api/v1/measurements', json=sample(UUID(body['id'])), headers=op).status_code == 401
    assert client.delete('/api/v1/operator/session', headers=op).status_code == 200
    assert client.put(url, json=update, headers=op).status_code == 401
    login(client)
    with connect() as conn:
        conn.execute("UPDATE operator_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=%s", (token_hash(client.cookies[COOKIE]),))
    assert client.get('/api/v1/operator/session').json()['authenticated'] is False


def test_plan_create_retry_conflict_and_restart(client):
    body, op = create(client)
    assert client.post('/api/v1/planned-missions', json=body, headers=op).status_code == 200
    changed = {**body, 'name': 'changed'}
    assert client.post('/api/v1/planned-missions', json=changed, headers=op).status_code == 409
    with TestClient(app) as restarted:
        data = restarted.get(f"/api/v1/missions/{body['id']}/plan").json()
        assert data['revision'] == 1
        assert data['plan']['stations'][0]['target_depths_m'] == [1, 2, 3]
        assert data['locked'] is False


def test_edit_revision_conflict_then_measurement_lock(client, headers):
    body, op = create(client)
    url = f"/api/v1/missions/{body['id']}/plan"
    changed = plan()
    changed['stations'][0]['target_depths_m'] = [1, 2]
    response = client.put(url, json={'expected_revision': 1, 'plan': changed}, headers=op)
    assert response.status_code == 200
    assert response.json()['revision'] == 2
    assert client.put(url, json={'expected_revision': 1, 'plan': plan()}, headers=op).status_code == 409
    assert client.put(url, json={'expected_revision': 2, 'plan': changed}, headers=op).json()['revision'] == 2
    packet = sample(UUID(body['id']))
    assert client.post('/api/v1/measurements', json=packet, headers=headers).status_code == 201
    assert client.get(url).json()['locked'] is True
    assert client.put(url, json={'expected_revision': 2, 'plan': plan()}, headers=op).status_code == 409
    saved = client.get('/api/v1/measurements', params={'mission_id': body['id']}).json()['items'][0]
    assert saved['id'] == packet['id'] and saved['target_depth_m'] == 1


def test_legacy_mission_plan_and_unknown(client, headers):
    m = mission(client, headers)
    op = login(client)
    url = f"/api/v1/missions/{m['id']}/plan"
    assert client.get(url).json()['plan'] is None
    assert client.put(url, json={'expected_revision': 0, 'plan': plan()}, headers=op).status_code == 200
    unknown = f'/api/v1/missions/{uuid4()}/plan'
    assert client.get(unknown).status_code == 404
    assert client.put(unknown, json={'expected_revision': 0, 'plan': plan()}, headers=op).status_code == 404


@pytest.mark.parametrize('case', ['empty', 'duplicate_station', 'duplicate_depth', 'negative', 'precision', 'mixed_reference', 'partial_position'])
def test_invalid_plans(client, case):
    op = login(client)
    p = plan()
    if case == 'empty': p['stations'] = []
    if case == 'duplicate_station': p['stations'][1]['station_id'] = 'S01'
    if case == 'duplicate_depth': p['stations'][0]['target_depths_m'] = [1, 1]
    if case == 'negative': p['stations'][0]['target_depths_m'] = [-1]
    if case == 'precision': p['stations'][0]['target_depths_m'] = [1.0001]
    if case == 'mixed_reference': p['stations'][1]['position'] = {'latitude': 35, 'longitude': 33}
    if case == 'partial_position': p['stations'][0]['position'] = {'latitude': 35}
    result = client.post('/api/v1/planned-missions', headers=op, json={'id': str(uuid4()), 'name': 'bad', 'source': 'simulated', 'plan': p})
    assert result.status_code == 422


def test_device_plan_uses_real_reference_and_cannot_use_demo(client):
    op = login(client)
    p = plan()
    body = {'id': str(uuid4()), 'name': 'device plan', 'source': 'device', 'plan': p}
    assert client.post('/api/v1/planned-missions', headers=op, json=body).status_code == 422
    for station in p['stations']:
        station['position'] = {'latitude': 35.2, 'longitude': 33.1}
    assert client.post('/api/v1/planned-missions', headers=op, json=body).status_code == 201
