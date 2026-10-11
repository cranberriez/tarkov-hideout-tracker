-- Site-wide aggregate only: no voter identities or per-vote records.
CREATE TABLE feedback (
    id integer PRIMARY KEY DEFAULT 1,
    good bigint NOT NULL DEFAULT 0,
    bad bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT feedback_singleton_check CHECK (id = 1),
    CONSTRAINT feedback_good_nonnegative_check CHECK (good >= 0),
    CONSTRAINT feedback_bad_nonnegative_check CHECK (bad >= 0)
);

INSERT INTO feedback (id) VALUES (1);
