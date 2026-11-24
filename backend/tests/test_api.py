import os
from copy import deepcopy
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from send_sample import sample


@pytest.fixture
def client(monkeypatch):
    url = os.environ.get('TEST_DATABASE_URL')
    if not url or not url.rsplit('/', 1)[-1].startswith('aquatwin_test'):
        pytest.fail('TEST_DATABASE_URL must name a dedicated aquatwin_test* database')
    monkeypatch.setenv('DATABASE_URL', url)
    monkeypatch.setenv('AQUATWIN_INGEST_TOKEN', 'test-only-ingest-token')
    with TestClient(app) as c:
        yield c


@pytest.fixture
def headers():
    return {'Authorization': 'Bearer test-only-ingest-token'}


def mission(client, headers, source='simulated'):
    value = {'id': str(uuid4()), 'name': 'API test', 'source': source}
    assert client.post('/api/v1/missions', json=value, headers=headers).status_code == 201
    return value


def test_health_and_auth(client, headers):
    assert client.get('/api/v1/health').json()['status'] == 'ok'
    assert client.post('/api/v1/missions', json={'id': str(uuid4()), 'name': 'test', 'source': 'simulated'}).status_code == 401
    assert client.post('/api/v1/missions', json={'id': str(uuid4()), 'name': 'test', 'source': 'simulated'}, headers={'Authorization': 'Bearer wrong'}).status_code == 401


def test_mission_idempotency_and_pagination(client, headers):
    m = mission(client, headers)
    assert client.post('/api/v1/missions', json=m, headers=headers).status_code == 200
    assert client.post('/api/v1/missions', json={**m, 'name': 'changed'}, headers=headers).status_code == 409
    assert len(client.get('/api/v1/missions?limit=1').json()['items']) == 1
    assert client.get('/api/v1/missions?limit=201').status_code == 422


def test_measurement_roundtrip_retry_conflict_and_source(client, headers):
    m = mission(client, headers)
    body = sample(UUID(m['id']))
    first = client.post('/api/v1/measurements', json=body, headers=headers)
    assert first.status_code == 201
    assert first.json()['received_at']
    again = client.post('/api/v1/measurements', json=body, headers=headers)
    assert again.status_code == 200
    assert again.json()['received_at'] == first.json()['received_at']
    changed = deepcopy(body)
    changed['parameters']['temp']['value'] += 1
    assert client.post('/api/v1/measurements', json=changed, headers=headers).status_code == 409
    changed = {**body, 'id': str(uuid4()), 'source': 'device'}
    assert client.post('/api/v1/measurements', json=changed, headers=headers).status_code == 409
    rows = client.get('/api/v1/measurements', params={'mission_id': m['id']}).json()
    assert rows['total'] == 1
    assert 'ec' not in rows['items'][0]['parameters']
    assert rows['items'][0]['parameters']['temp']['value'] == 23


@pytest.mark.parametrize('change', [
    {'measured_at': '2026-11-25T09:00:00'},
    {'actual_depth_m': -1},
    {'schema_version': 2},
    {'position': {'latitude': 35}},
    {'position': {'local_x_m': 1, 'local_north_m': 2}},
    {'position': {'latitude': 91, 'longitude': 0}},
    {'parameters': {}},
    {'parameters': {'temp': {'value': 22, 'unit': 'F', 'sensor_id': 'T'}}},
    {'unexpected': 'field'},
    {'quality': 'maybe'},
])
def test_invalid_packets_rejected(client, headers, change):
    m = mission(client, headers)
    body = {**sample(UUID(m['id'])), **change}
    assert client.post('/api/v1/measurements', json=body, headers=headers).status_code == 422


def test_utc_normalization_and_gnss_only(client, headers):
    m = mission(client, headers)
    body = sample(UUID(m['id']))
    body['position'] = {'latitude': 35.2, 'longitude': 33.1, 'accuracy_m': 2.5}
    body['measured_at'] = '2026-11-25T12:00:00+03:00'
    first = client.post('/api/v1/measurements', json=body, headers=headers)
    assert first.status_code == 201
    assert first.json()['measured_at'].endswith('09:00:00Z')
    body['measured_at'] = '2026-11-25T09:00:00Z'
    assert client.post('/api/v1/measurements', json=body, headers=headers).status_code == 200


def test_unknown_mission_and_separate_sessions(client, headers):
    assert client.get('/api/v1/measurements', params={'mission_id': str(uuid4())}).status_code == 404
    assert client.post('/api/v1/measurements', json=sample(uuid4()), headers=headers).status_code == 404
    a, b = mission(client, headers), mission(client, headers)
    for m in (a, b):
        for index in range(2):
            assert client.post('/api/v1/measurements', json=sample(UUID(m['id']), index), headers=headers).status_code == 201
    page = client.get('/api/v1/measurements', params={'mission_id': a['id'], 'limit': 1, 'offset': 1}).json()
    assert page['total'] == 2
    assert len(page['items']) == 1
    assert page['items'][0]['mission_id'] == a['id']


def test_raw_identity_and_order(client, headers):
    m = mission(client, headers)
    body = sample(UUID(m['id']))
    body['raw_samples'] = [{'offset_s': 0, 'parameters': body['parameters']}]
    assert client.post('/api/v1/measurements', json=body, headers=headers).status_code == 201
    body['id'] = str(uuid4())
    body['raw_samples'] *= 2
    assert client.post('/api/v1/measurements', json=body, headers=headers).status_code == 422


def test_persists_across_app_restart(client, headers):
    m = mission(client, headers)
    body = sample(UUID(m['id']))
    assert client.post('/api/v1/measurements', json=body, headers=headers).status_code == 201
    with TestClient(app) as restarted:
        rows = restarted.get('/api/v1/measurements', params={'mission_id': m['id']}).json()
        assert rows['items'][0]['id'] == body['id']
