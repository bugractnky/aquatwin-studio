CREATE TABLE calibrations (
    id uuid PRIMARY KEY,
    sensor_id text NOT NULL,
    parameter text NOT NULL,
    source text NOT NULL,
    performed_at timestamptz NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calibrations_sensor ON calibrations(sensor_id,parameter,performed_at DESC);
CREATE TABLE quality_reviews (
    measurement_id uuid NOT NULL REFERENCES measurements(id),
    revision integer NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(measurement_id,revision)
);
