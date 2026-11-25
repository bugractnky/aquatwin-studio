CREATE TABLE mission_plans (
    mission_id uuid NOT NULL REFERENCES missions(id),
    revision integer NOT NULL CHECK (revision > 0),
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (mission_id, revision)
);
CREATE TABLE operator_sessions (
    token_hash text PRIMARY KEY,
    expires_at timestamptz NOT NULL
);
