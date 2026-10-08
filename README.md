# QuickNotes System Design

QuickNotes is a note-taking app that is being redesigned from a browser-only tool into an online service for 1 million users. This project has two halves: a small **API client** (HTML, CSS and JavaScript) that loads, creates and deletes notes using the JSONPlaceholder practice API, and three **design documents** that describe the real backend the engineering team should build: its API, its database and its overall architecture.

## Features

- Load 10 notes from the server with a GET request
- Create a note with a POST request, with validation (a title is required, with a maximum of 100 characters)
- Delete a note with a DELETE request
- Loading, success, error and empty states shown on the page
- Buttons are disabled while a request is running
- User text is added to the page with textContent only, never innerHTML
- Design documents: REST API, data model and system architecture

## How to run the API client

1. Clone the repository: `git clone https://github.com/Gachi707/quicknotes-system-design.git`
2. Open the folder in VS Code.
3. Right-click `index.html` and choose "Open with Live Server" (or open `index.html` in a browser).
4. Click "Load notes" to fetch notes, use the form to create a note, and use the Delete button to remove one.

The client needs an internet connection, because it talks to https://jsonplaceholder.typicode.com/posts. JSONPlaceholder is a fake API: it replies as if it saved or deleted something, but it does not store anything, so a refresh brings the original notes back.

## Design documents

- [API design](docs/api-design.md): the REST endpoints, request and response examples, and error codes
- [Data model](docs/data-model.md): the users, notes, tags and note_tags tables, relationships, SQL, indexes and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, the load estimate for 1 million users, the architecture diagram, request flows and trade-offs

## What I learned

- How to use fetch with async and await, and why I must check response.ok, because fetch does not throw an error for 404 or 500 responses.
- How the HTTP methods and status codes fit together (GET, POST, PUT, PATCH and DELETE with 200, 201, 204, 400, 401, 403, 404 and 500), and how to name REST endpoints with plural nouns.
- How a many-to-many relationship such as notes and tags needs a join table, and how an index makes common queries faster.
- How to estimate load with simple numbers, and how a cache, a CDN, a load balancer, a read replica and a queue each remove a bottleneck or a single point of failure.
- How the JSONPlaceholder surprise that every created note gets id 101.