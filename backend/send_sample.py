"""Send reproducible simulated measurements through the same API as future devices."""
import argparse
import json
import os
from uuid import UUID, uuid5

import httpx

NAMESPACE = UUID('287339b0-8ae1-47b5-b198-369a331b2488')


def sample(mission_id, index=0):
    station = ['S01', 'S02', 'S03'][index // 3 % 3]
    x, north = [(-25, -8), (-12, 8), (0, -4)][index // 3 % 3]
    depth = index % 3 + 1
    return {
        'schema_version': 1, 'id': str(uuid5(mission_id, f'sample-{index}')),
        'mission_id': str(mission_id), 'device_id': 'SIM-POD-01', 'station_id': station,
        'source': 'simulated', 'measured_at': f'2026-11-25T09:{index:02d}:00Z',
        'target_depth_m': depth, 'actual_depth_m': depth,
        'position': {'local_x_m': x, 'local_north_m': north, 'reference_id': 'demo-pond-v1'},
        'parameters': {
            'temp': {'value': 24-depth, 'unit': 'degC', 'sensor_id': 'SIM-TEMP'},
            'ph': {'value': 7.8, 'unit': '1', 'sensor_id': 'SIM-PH'},
            'do': {'value': 8-depth/2, 'unit': 'mg/L', 'sensor_id': 'SIM-DO'},
        },
        'quality': 'valid', 'quality_reason': 'Synthetic fixture; not a field validation.',
        'calibration_id': None, 'raw_samples': [],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    parser.add_argument('--mission', default='sample-session')
    parser.add_argument('--count', type=int, choices=range(1, 10), default=1)
    args = parser.parse_args()
    token = os.environ.get('AQUATWIN_INGEST_TOKEN')
    if not token:
        parser.error('Set AQUATWIN_INGEST_TOKEN (same value as the API)')
    mission_id = uuid5(NAMESPACE, args.mission)
    with httpx.Client(base_url=args.url, headers={'Authorization': f'Bearer {token}'}, timeout=15) as client:
        result = client.post('/api/v1/missions', json={'id': str(mission_id), 'name': args.mission, 'source': 'simulated'})
        result.raise_for_status()
        for index in range(args.count):
            result = client.post('/api/v1/measurements', json=sample(mission_id, index))
            result.raise_for_status()
            print(json.dumps({'status': result.status_code, 'id': result.json()['id']}))
    print(f'Mission: {mission_id}. Re-running the same command does not create duplicates.')


if __name__ == '__main__':
    main()
