# QuickNotes Data Model

This document describes the relational database behind the real QuickNotes service. It has four tables: `users`, `notes`, `tags` and `note_tags`.

## 1. Entities

### users
One row per person with an account.

| Column | Type | Key / constraint | Notes |
|---|---|---|---|
| id | INTEGER | **Primary key** | Unique id for the user |
| name | VARCHAR(100) | NOT NULL | Display name |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Used to log in; no two users share one |
| password_hash | TEXT | NOT NULL | A hash of the password, never the password itself |
| created_at | TEXT (timestamp) | NOT NULL, default now | When the account was made |

### notes
One row per note.

| Column | Type | Key / constraint | Notes |
|---|---|---|---|
| id | INTEGER | **Primary key** | Unique id for the note |
| user_id | INTEGER | **Foreign key** to `users(id)`, NOT NULL | The owner of the note |
| title | VARCHAR(100) | NOT NULL, length 1 to 100 | Required, at most 100 characters |
| body | TEXT | NOT NULL, default empty | Optional longer text |
| created_at | TEXT (timestamp) | NOT NULL, default now | When the note was created |
| updated_at | TEXT (timestamp) | NOT NULL, default now | When the note last changed |

### tags
One row per tag name, for example "study" or "work".

| Column | Type | Key / constraint | Notes |
|---|---|---|---|
| id | INTEGER | **Primary key** | Unique id for the tag |
| name | VARCHAR(30) | NOT NULL, UNIQUE | Each tag name is stored once |

### note_tags
The join table that links notes to tags. One row means "this note has this tag".

| Column | Type | Key / constraint | Notes |
|---|---|---|---|
| note_id | INTEGER | **Foreign key** to `notes(id)`, part of the primary key | The note |
| tag_id | INTEGER | **Foreign key** to `tags(id)`, part of the primary key | The tag |

The **primary key is the pair** `(note_id, tag_id)`, so the same tag cannot be attached to the same note twice.

## 2. Relationships

- **users to notes: one-to-many.** One user can write many notes, but each note belongs to exactly one user. This uses a foreign key, `notes.user_id`, which points to `users.id`.
- **notes to tags: many-to-many.** A note can have many tags (a note can be both "study" and "web"), and a tag can be on many notes. A foreign key can only point to one row, so this needs a **join table**: `note_tags` holds one row for each note and tag pair.

Both foreign keys in `note_tags` use `ON DELETE CASCADE`. When a note is deleted, its tag links are removed automatically, and when a user is deleted, all their notes (and so their links) go too, so no orphan rows are left behind.

## 3. CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      VARCHAR(100) NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

## 4. Example queries

**1. List a user's notes, newest first (this is `GET /notes`)**

```sql
SELECT id, title, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

**2. List notes with their tags (uses a JOIN)**

```sql
SELECT notes.title, tags.name AS tag
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags      ON tags.id = note_tags.tag_id
WHERE notes.user_id = 1
ORDER BY notes.created_at DESC, tags.name;
```

**3. Search a user's notes by title (this is `GET /notes?search=http`)**

```sql
SELECT id, title
FROM notes
WHERE user_id = 1 AND title LIKE '%http%';
```

**4. Count how many notes each tag has (JOIN with GROUP BY)**

```sql
SELECT tags.name, COUNT(note_tags.note_id) AS note_count
FROM tags
LEFT JOIN note_tags ON note_tags.tag_id = tags.id
GROUP BY tags.id
ORDER BY note_count DESC;
```

**5. Delete one of a user's notes (this is `DELETE /notes/42`)**

```sql
DELETE FROM notes
WHERE id = 42 AND user_id = 1;
```

The `user_id` check makes sure users can only delete their own notes. Because of `ON DELETE CASCADE`, the matching `note_tags` rows disappear with it.

## 5. Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag_id   ON note_tags (tag_id);
```

- **`idx_notes_user_created`:** almost every request is "this user's notes, newest first" (`GET /notes`). Without an index the database would read every note of every user, which is slow with millions of rows. This index lets it jump straight to one user's notes already in date order. QuickNotes is read-heavy (about 4 reads for every write), so the small extra cost on each write is a good trade.
- **`idx_note_tags_tag_id`:** the primary key of `note_tags` already speeds up "which tags does this note have". Finding "which notes have this tag" searches by `tag_id`, and that needs its own index.

The primary keys and the `UNIQUE` columns (`email`, tag `name`) are indexed automatically.

## 6. SQL or NoSQL?

I chose **SQL (a relational database)**. QuickNotes data is clearly structured: users own notes, and notes have tags, so the relationships are central to the product. A relational database handles them with foreign keys and JOINs, and it enforces the rules in the database itself: unique emails, a required title of at most 100 characters, no duplicate tag on a note, and no note without a real owner. It also supports transactions, so a note and its tags are saved all together or not at all. A document database such as MongoDB would suit data whose shape changes a lot or that must spread over very many servers, but QuickNotes has a fixed shape, and at 1 million users it needs about 180 GB a year, which a single primary database with read replicas handles comfortably.