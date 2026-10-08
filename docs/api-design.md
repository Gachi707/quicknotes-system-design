# QuickNotes API Design

This document describes the real REST API that the QuickNotes backend team should build. It uses plural nouns for resources (`/notes`, `/tags`), and the HTTP method says the action. All requests and responses use JSON, and every endpoint except login needs the header `Authorization: Bearer <token>`.

**Base URL:** `https://api.quicknotes.com/v1`

## Endpoints

| # | Method | Path | Description | Success status |
|---|---|---|---|---|
| 1 | GET | `/notes` | List the logged-in user's notes. Supports `?search=`, `?tag=` and `?page=` | 200 OK |
| 2 | GET | `/notes/{id}` | Get one note by its id | 200 OK |
| 3 | POST | `/notes` | Create a new note | 201 Created |
| 4 | PUT | `/notes/{id}` | Replace a whole note with a new version | 200 OK |
| 5 | PATCH | `/notes/{id}` | Change only some fields of a note (for example just the title) | 200 OK |
| 6 | DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| 7 | GET | `/tags` | List all tags the user has created | 200 OK |
| 8 | POST | `/sessions` | Log in with email and password and receive a token | 201 Created |

## Request and response examples

### Create a note: `POST /notes`

**Request headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

**Request body**

```json
{
  "title": "Revise HTTP methods",
  "body": "GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes.",
  "tags": ["study", "web"]
}
```

**Response: 201 Created**

```json
{
  "id": 42,
  "title": "Revise HTTP methods",
  "body": "GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes.",
  "tags": ["study", "web"],
  "createdAt": "2026-10-10T09:30:00Z",
  "updatedAt": "2026-10-10T09:30:00Z"
}
```

The server assigns the `id` and the timestamps. The `title` is required and can be at most 100 characters.

### List notes: `GET /notes?page=1`

**Response: 200 OK**

```json
{
  "data": [
    {
      "id": 42,
      "title": "Revise HTTP methods",
      "body": "GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes.",
      "tags": ["study", "web"],
      "createdAt": "2026-10-10T09:30:00Z",
      "updatedAt": "2026-10-10T09:30:00Z"
    },
    {
      "id": 41,
      "title": "Buy milk",
      "body": "",
      "tags": ["personal"],
      "createdAt": "2026-10-09T18:05:00Z",
      "updatedAt": "2026-10-09T18:05:00Z"
    }
  ],
  "page": 1,
  "perPage": 10,
  "total": 2
}
```

If the user has no notes, `data` is an empty array (`[]`) and `total` is 0.

### Log in: `POST /sessions`

**Request body**

```json
{ "email": "amina@example.com", "password": "correct-horse-battery" }
```

**Response: 201 Created**

```json
{ "token": "eyJhbGciOiJIUzI1NiIs...", "expiresIn": 3600 }
```

## Error codes

Every error uses the same JSON shape, so the front end can handle them in one place.

| Status | Meaning | When it happens |
|---|---|---|
| 400 Bad Request | The request is invalid | `POST /notes` with a missing title, or a title over 100 characters |
| 401 Unauthorized | The user is not logged in | The `Authorization` header is missing, wrong or expired |
| 403 Forbidden | Logged in, but not allowed | Trying to read or delete another user's note |
| 404 Not Found | The resource does not exist | `GET /notes/9999` when no note has that id |
| 500 Internal Server Error | A bug or failure on the server | The database is unreachable |

### Example error bodies

**400 Bad Request** (`POST /notes` with no title)

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer."
  }
}
```

**401 Unauthorized**

```json
{
  "error": {
    "status": 401,
    "code": "NOT_AUTHENTICATED",
    "message": "Please log in to continue."
  }
}
```

**403 Forbidden**

```json
{
  "error": {
    "status": 403,
    "code": "NOT_ALLOWED",
    "message": "You do not have permission to access this note."
  }
}
```

**404 Not Found**

```json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "No note exists with id 9999."
  }
}
```

**500 Internal Server Error**

```json
{
  "error": {
    "status": 500,
    "code": "SERVER_ERROR",
    "message": "Something went wrong on our side. Please try again later."
  }
}
```