"""Send one synthetic telemetry snapshot and event; this is not a live simulator."""
import argparse
import os
from datetime import datetime, timezone
from uuid import uuid4, uuid5

import httpx

from send_sample import NAMESPACE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    parser.add_argument('--mission', default='telemetry-fixture')
    args = parser.parse_args()
    token = os.environ.get('AQUATWIN_INGEST_TOKEN')
    if not token:
        parser.error('Set AQUATWIN_INGEST_TOKEN to match the local API')
    mission_id = str(uuid5(NAMESPACE, args.mission))
    now = datetime.now(timezone.utc).isoformat()
    common = dict(schema_version=1, mission_id=mission_id, device_id='SIM-BOAT-01', source='simulated',
                  session_id=str(uuid4()), session_started_at=now, observed_at=now, sequence=0)
    telemetry = dict(common, id=str(uuid4()), validity='valid', validity_reason='Synthetic fixture, not field validation',
                     station_id='S01', target_depth_m=2, actual_depth_m=1.9, winch_stage='measuring')
    event = dict(common, id=str(uuid4()), kind='info', severity='info', message='Synthetic one-shot telemetry fixture')
    with httpx.Client(base_url=args.url, headers={'Authorization': f'Bearer {token}'}, timeout=15) as client:
        response = client.post('/api/v1/missions', json={'id': mission_id, 'name': args.mission, 'source': 'simulated'})
        response.raise_for_status()
        for path, body in [('/api/v1/telemetry', telemetry), ('/api/v1/events', event)]:
            response = client.post(path, json=body)
            response.raise_for_status()
            print(f'{path}: {response.status_code}')
    print(f'Mission: {mission_id}. New invocation creates a new synthetic session; no physical device was contacted.')


if __name__ == '__main__':
    main()
