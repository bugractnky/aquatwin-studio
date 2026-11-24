CREATE TABLE missions (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    source text NOT NULL CHECK (source IN ('simulated', 'device')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE measurements (
    id uuid PRIMARY KEY,
    mission_id uuid NOT NULL REFERENCES missions(id),
    measured_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb NOT NULL
);
CREATE INDEX measurements_mission_time ON measurements(mission_id, measured_at, id);
