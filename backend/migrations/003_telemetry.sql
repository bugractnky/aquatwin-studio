CREATE TABLE device_sessions (
    mission_id uuid NOT NULL REFERENCES missions(id),
    device_id text NOT NULL,
    session_id uuid NOT NULL,
    started_at timestamptz NOT NULL,
    PRIMARY KEY (mission_id, device_id, session_id),
    UNIQUE (mission_id, device_id, started_at)
);
CREATE TABLE telemetry (
    id uuid PRIMARY KEY,
    mission_id uuid NOT NULL,
    device_id text NOT NULL,
    session_id uuid NOT NULL,
    sequence bigint NOT NULL CHECK (sequence >= 0),
    observed_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    payload jsonb NOT NULL,
    FOREIGN KEY (mission_id, device_id, session_id) REFERENCES device_sessions,
    UNIQUE (mission_id, device_id, session_id, sequence)
);
CREATE INDEX telemetry_latest ON telemetry (mission_id, device_id, session_id, sequence DESC);
CREATE TABLE mission_events (
    id uuid PRIMARY KEY,
    mission_id uuid NOT NULL,
    device_id text NOT NULL,
    session_id uuid NOT NULL,
    sequence bigint NOT NULL CHECK (sequence >= 0),
    observed_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    payload jsonb NOT NULL,
    FOREIGN KEY (mission_id, device_id, session_id) REFERENCES device_sessions,
    UNIQUE (mission_id, device_id, session_id, sequence)
);
CREATE INDEX events_mission_time ON mission_events (mission_id, observed_at DESC, id);
