CREATE TABLE simulation_runs (
    id uuid PRIMARY KEY,
    mission_id uuid NOT NULL REFERENCES missions(id),
    revision integer NOT NULL,
    plan jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
