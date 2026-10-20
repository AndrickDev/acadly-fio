/** Migrações em SQL puro, aplicadas em ordem e registradas em `_migrations`. Funcionam em PGlite e Postgres. */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "0001_init",
    sql: `
CREATE TABLE users (
  id text PRIMARY KEY, name text NOT NULL, role text NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE classes (
  id text PRIMARY KEY, name text NOT NULL,
  professor_id text NOT NULL REFERENCES users(id),
  join_code text NOT NULL UNIQUE, created_at bigint NOT NULL
);
CREATE TABLE enrollments (
  class_id text NOT NULL REFERENCES classes(id),
  student_id text NOT NULL REFERENCES users(id),
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX enrollments_uq ON enrollments (class_id, student_id);
CREATE TABLE sessions (
  id text PRIMARY KEY,
  class_id text NOT NULL REFERENCES classes(id),
  state text NOT NULL CHECK (state IN ('CRIADA','ABERTA','FINALIZADA')),
  opened_at bigint, closed_at bigint,
  window_ms integer NOT NULL, secret text NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE checkins (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id),
  student_id text NOT NULL REFERENCES users(id),
  device_id text,
  hops integer NOT NULL DEFAULT 0,
  witnesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  method text NOT NULL CHECK (method IN ('AUTO','MANUAL')),
  at bigint NOT NULL
);
CREATE UNIQUE INDEX checkins_student_uq ON checkins (session_id, student_id);
CREATE UNIQUE INDEX checkins_device_uq ON checkins (session_id, device_id);
CREATE TABLE attempts (
  id text PRIMARY KEY, session_id text NOT NULL, student_id text NOT NULL, device_id text NOT NULL,
  ok boolean NOT NULL, rule text NOT NULL, code text NOT NULL, reason text NOT NULL, at bigint NOT NULL
);
CREATE INDEX attempts_device_idx ON attempts (session_id, device_id, at);
CREATE TABLE alerts (
  id text PRIMARY KEY, session_id text NOT NULL, kind text NOT NULL, details text NOT NULL, at bigint NOT NULL
);
CREATE TABLE activities (
  id text PRIMARY KEY, session_id text NOT NULL REFERENCES sessions(id),
  type text NOT NULL, prompt text NOT NULL, options jsonb NOT NULL,
  state text NOT NULL, created_at bigint NOT NULL
);
CREATE TABLE responses (
  activity_id text NOT NULL REFERENCES activities(id),
  student_id text NOT NULL REFERENCES users(id),
  choice integer NOT NULL, at bigint NOT NULL
);
CREATE UNIQUE INDEX responses_uq ON responses (activity_id, student_id);
`,
  },
  {
    id: "0002_sinal_e_modo",
    sql: `
ALTER TABLE sessions ADD COLUMN mode text NOT NULL DEFAULT 'DIRETO';
ALTER TABLE checkins ADD COLUMN rssi integer;
ALTER TABLE checkins ADD COLUMN review boolean NOT NULL DEFAULT false;
ALTER TABLE attempts ADD COLUMN rssi integer;
`,
  },
];
