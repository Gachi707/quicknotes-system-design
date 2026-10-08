# QuickNotes System Architecture

This document describes how QuickNotes is designed to serve **1 million registered users**, moving from a browser-only app to a real online service. It follows the API in `api-design.md` and the database in `data-model.md`.

## 1. Requirements

### Functional requirements
- Users can register and log in.
- Users can create, read, edit and delete their own notes.
- Users can tag notes and filter their notes by tag.
- Users can search their notes by title.
- Notes are saved on the server, so they appear on every device the user logs in on.
- Slow tasks, such as welcome emails and note exports, run in the background.

### Non-functional requirements
- **Scale:** 1,000,000 registered users, about 200,000 active each day.
- **Latency:** `GET /notes` should answer in under 200 ms for 95% of requests.
- **Availability:** 99.9% ("three nines"), which allows about 8.8 hours of downtime per year.
- **Durability:** a saved note must never be lost (replication and regular backups).
- **Consistency:** a user must see their own new note straight away; other devices may be a few seconds behind (eventual consistency).
- **Security:** HTTPS everywhere, hashed passwords, token authentication and rate limiting (429 Too Many Requests).
- **Simplicity:** use the simplest design that meets the numbers, with no sharding and no microservices yet.

## 2. Load estimate for 1 million users

**Assumptions:** 20% of users are active each day, each active user creates 5 notes and loads their notes 20 times per day, an average note is about 500 bytes, 1 day is about 100,000 seconds, and peak traffic is 5 times the average.

| What | Calculation | Result |
|---|---|---|
| Daily active users | 1,000,000 × 20% | 200,000 |
| Writes (new notes) per day | 200,000 × 5 | 1,000,000 |
| **Writes per second** (average) | 1,000,000 ÷ 100,000 | **about 10 per second** |
| Writes per second (peak) | 10 × 5 | about 50 per second |
| Reads (note loads) per day | 200,000 × 20 | 4,000,000 |
| **Reads per second** (average) | 4,000,000 ÷ 100,000 | **about 40 per second** |
| Reads per second (peak) | 40 × 5 | about 200 per second |
| **Storage per year** | 1,000,000 notes × 500 bytes = 500 MB per day × 365 | **about 180 GB per year** |

**What this tells us:** QuickNotes is **read-heavy** (4 reads for every write), so caching reads helps a lot. About 250 requests per second at peak is manageable for a few ordinary servers, and 180 GB per year fits in one well-configured database, so sharding is not needed yet.

## 3. Components (one sentence each)

- **Client (web or mobile app):** shows the notes and sends API requests, so users never touch the database directly.
- **DNS:** turns the name quicknotes.com into the IP addresses of our servers, so users do not need to remember them.
- **CDN:** keeps copies of the static files (HTML, CSS, JavaScript) on edge servers near users, which lowers latency and takes load off our own servers.
- **Load balancer:** spreads requests across the app servers and skips any that fail a health check, so no one server is overloaded or relied on.
- **App servers (three or more):** run the API code and are stateless, so any server can handle any request and we can add more as traffic grows.
- **Cache (Redis):** keeps each user's recent note list in memory, so most of the 200 reads per second never reach the database.
- **Primary database:** stores the one true copy of the data and accepts all writes, so there is a single place where changes are made safely.
- **Read replica:** holds a copy of the primary and answers read queries on a cache miss, which protects the primary from the heavy read traffic.
- **Message queue:** holds background jobs such as emails and exports, so the API can reply to the user immediately instead of waiting.
- **Worker:** takes jobs from the queue and runs them separately from the app servers, so slow tasks never slow down the user.

## 4. Request flows

### `GET /notes` (load the user's notes)
1. The client sends `GET /notes` with its token. The static files have already come from the CDN, and DNS has already given the address.
2. The **load balancer** sends the request to a healthy, least busy app server.
3. The app server checks the token to find the user (an invalid token gets `401`).
4. It looks in the **cache** for the key `notes:user:1`.
5. **Cache hit:** it returns the notes at once (about 1 ms) with `200 OK`.
6. **Cache miss:** it queries the **read replica** (about 5 to 20 ms, using the index on `user_id` and `created_at`).
7. It saves the result in the cache with a TTL of 5 minutes, so the next request is a hit.
8. It returns `200 OK` with the notes as JSON.

### `POST /notes` (save a new note)
1. The client sends `POST /notes` with the title, body and token.
2. The **load balancer** forwards it to any healthy app server.
3. The app server checks the token and validates the data (the title is required and at most 100 characters), and a bad request gets `400`.
4. It writes the note, and its tag links, to the **primary database** in one transaction (about 5 to 10 ms).
5. It **deletes** the key `notes:user:1` from the cache, so stale notes are never served.
6. It adds a background job to the **queue** if one is needed (for example a welcome email on the user's first note).
7. It responds with `201 Created` and the new note, so the client can show it immediately even if the replica is a few milliseconds behind.
8. The primary then copies the new row to the read replica.

## 5. Trade-offs and single points of failure

### Trade-offs
1. **Speed versus freshness.** The cache and read replicas make `GET /notes` very fast, but data can be slightly out of date: a cached list can be up to 5 minutes old, and a replica can lag by a few milliseconds. We accept this for notes (and delete the cache entry on every write, so a user always sees their own changes), but a bank balance would need a different choice.
2. **Consistency versus availability.** If the primary database is down, reads can still be served from the replicas and the cache, but writes fail until a replica is promoted. We choose to keep reading available, because being able to view notes is more important than being able to add one for a short time.
3. **Simplicity versus scalability.** One server would be simpler, but it cannot give 99.9% availability. We use several identical app servers, a cache and a replica, but we stay with a single well-organised monolith and one database, because at 250 requests per second microservices and sharding would add complexity with no benefit.
4. **Cost versus reliability.** Extra servers, a replica and backups cost more money, but they are what keep the service running when a part fails.

### Single points of failure and how we avoid them

| Part | How a single failure is avoided |
|---|---|
| DNS | Use a provider with several name servers |
| CDN | Many edge servers around the world, and requests go to a healthy one |
| Load balancer | A managed load balancer, or two in a pair, so one failing does not stop traffic |
| App servers | Three or more identical stateless servers, and the load balancer skips a failed one |
| Cache | If Redis fails, the app reads from the database (slower, but it still works), and a Redis replica can take over |
| Primary database | A replica is promoted to primary (failover), plus daily backups |
| Queue | A managed, replicated queue stores jobs safely until a worker takes them |
| Worker | Two or more workers, so jobs keep running if one stops |

### Monitoring and protection
- **Logs, metrics and alerts** show problems early, for example the 95th percentile of `GET /notes` latency, the percentage of failed requests, and the cache hit rate.
- **Rate limiting** (for example 100 requests per minute per user) returns `429` and protects the servers from abuse.
- **Timeouts and retries with back-off** stop requests from waiting forever or flooding a struggling server.
- **Graceful degradation** means that if search or the worker is down, users can still read and write notes.

## 6. Architecture diagram

```
                       +-----------+
   +------------------>|    DNS    |  quicknotes.com -> IP addresses
   |                   +-----------+
+--+-----------+   static files (HTML, CSS, JS)   +-----------------+
| Client       |--------------------------------->|  CDN edge       |
| (web/mobile) |                                  |  servers        |
+--+-----------+                                  +-----------------+
   |
   | API calls: GET /notes, POST /notes (HTTPS, JSON)
   v
+----------------+
| Load balancer  |  health checks, spreads requests
+-------+--------+
        |
   +----+-----------+-----------+
   v                v           v
+--------+      +--------+  +--------+
| App 1  |      | App 2  |  | App 3  |   stateless, identical
+---+----+      +---+----+  +----+---+
    |               |            |
    +---------+-----+------------+
              |
   +----------+--------+-------------------+
   v                   v                   v
+---------------+  +--------------+   +-----------+     +--------+
| Cache (Redis) |  | Primary DB   |   |  Queue    |---->| Worker |  emails, exports
| notes:user:id |  | (all writes) |   | (jobs)    |     +--------+
+---------------+  +------+-------+   +-----------+
                          | copies (replication)
                          v
                   +---------------+
                   | Read replica  |  <-- reads on a cache miss
                   +---------------+
```

Static files come from the CDN, API calls go through the load balancer, writes go to the primary, reads go to the cache or the replica, and slow jobs go to the queue.