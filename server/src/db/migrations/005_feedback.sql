-- Feedback and contact messages from users.
--
-- Lives here rather than in Firestore for the same reason check results do:
-- the worker owns it, it is written far more often than it is read, and a
-- Firestore document per message would put an unauthenticated form directly
-- on the write bill. One writer, one table.
--
-- Deliberately denormalised. `email` and `uid` are copied in at write time
-- rather than joined at read time, because a message has to remain answerable
-- after the account that sent it is deleted — that is exactly when someone
-- wants to read it. A foreign key to a row that can disappear would either
-- block the deletion or lose the message.

CREATE TABLE feedback (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,

  -- 'suggestion' | 'bug' | 'question' | 'other'. Not a CHECK constraint: the
  -- API validates the set, and a new category should not require a migration
  -- to accept, only to display nicely.
  kind        TEXT NOT NULL DEFAULT 'other',

  message     TEXT NOT NULL,

  -- How to reply. Always present: taken from the authenticated token when the
  -- sender was signed in, and required in the body when they were not.
  email       TEXT NOT NULL,
  -- The display name they gave, or the one on their account. May be empty.
  name        TEXT NOT NULL DEFAULT '',

  -- Set only when the sender was authenticated. Its absence is the signal
  -- that this arrived from the public form and is less trustworthy.
  uid         TEXT,
  org_id      TEXT,

  -- Which client sent it, so an operator can tell a phone from a browser
  -- without guessing from the message.
  source      TEXT NOT NULL DEFAULT 'web',
  app_version TEXT,

  -- 'new' | 'read' | 'archived'. An operator's own state, never the sender's.
  status      TEXT NOT NULL DEFAULT 'new',
  -- Free text for whoever handled it. Not shown to the sender.
  operator_note TEXT NOT NULL DEFAULT ''
);

-- The console opens on "newest first, unhandled first", which is the only
-- ordering it ever asks for.
CREATE INDEX idx_feedback_inbox ON feedback (status, created_at DESC);

-- Rate limiting is per-IP at the edge, but a determined sender rotating
-- addresses is still bounded by this: the API refuses a second identical
-- message from the same email within a short window, and that lookup needs
-- somewhere to land.
CREATE INDEX idx_feedback_email ON feedback (email, created_at DESC);
