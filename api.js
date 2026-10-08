// QuickNotes API client (uses the JSONPlaceholder practice API)
const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE = 100;

// ---------- 1. Select elements ----------
const loadBtn = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const list = document.querySelector("#notes-list");
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");

// ---------- 2. Helpers ----------
// type is "success", "error" or "" (a plain message)
function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = type;
}

// One reusable function for every request
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Server responded with status ${response.status}`);
  }

  // Some APIs (DELETE) send an empty body, so read it as text first
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { data, status: response.status };
}

// ---------- 3. Drawing ----------
// isLocal is true for notes we created in this page session
function createNoteItem(note, isLocal = false) {
  const li = document.createElement("li");
  li.classList.add("note");

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body || "";

  const del = document.createElement("button");
  del.type = "button";
  del.classList.add("delete-btn");
  del.textContent = "Delete";
  del.addEventListener("click", () => handleDelete(note, li, del, isLocal));

  li.append(title, body, del);
  return li;
}

function clearEmptyMessage() {
  const empty = list.querySelector(".empty-message");
  if (empty) empty.remove();
}

function showEmptyIfNeeded() {
  if (list.querySelector(".note") || list.querySelector(".empty-message")) {
    return;
  }
  const li = document.createElement("li");
  li.classList.add("empty-message");
  li.textContent = "No notes to show yet.";
  list.appendChild(li);
}

function renderNotes(notes) {
  list.replaceChildren();
  notes.forEach((note) => list.appendChild(createNoteItem(note)));
  showEmptyIfNeeded();
}

// ---------- 4. Load notes (GET) ----------
async function loadNotes() {
  setStatus("Loading notes...");
  loadBtn.disabled = true;

  try {
    const { data } = await request(`${API_URL}?_limit=10`);
    renderNotes(data);
    setStatus(`Loaded ${data.length} notes from the server.`, "success");
  } catch (error) {
    console.error(error);
    setStatus(
      "Could not load notes. Please check your connection and try again.",
      "error"
    );
  } finally {
    loadBtn.disabled = false;
  }
}

// ---------- 5. Create a note (POST) ----------
async function createNote(title, body) {
  const { data, status } = await request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, userId: 1 }),
  });
  return { note: data, status };
}

async function handleSubmit(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validation: a title is required, with a maximum of 100 characters
  if (title === "") {
    setStatus("Please enter a title.", "error");
    return;
  }
  if (title.length > MAX_TITLE) {
    setStatus(`The title must be ${MAX_TITLE} characters or fewer.`, "error");
    return;
  }

  setStatus("Creating note...");
  submitBtn.disabled = true;

  try {
    const { note, status } = await createNote(title, body);
    clearEmptyMessage();
    list.prepend(createNoteItem(note, true));
    setStatus(`Note created (status ${status}, id ${note.id}).`, "success");
    form.reset();
  } catch (error) {
    console.error(error);
    setStatus("Could not create the note. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// ---------- 6. Delete a note (DELETE) ----------
// NOTE ABOUT JSONPLACEHOLDER: it is a fake API. It answers DELETE with
// success but never really removes anything, so a refresh brings the
// notes back. Also, notes we CREATE are never really stored (every new
// note gets the same id, 101), so there is nothing on the server to
// delete. My approach:
//   - notes loaded from the server: send DELETE /posts/{id} and remove the
//     note from the list when the server says OK;
//   - notes created in this page (isLocal): they only exist in the page,
//     so I remove them from the list without calling the server.
// A real API would store and delete both kinds for real.
async function handleDelete(note, li, button, isLocal) {
  button.disabled = true;
  setStatus("Deleting note...");

  try {
    if (isLocal) {
      setStatus("Note removed (it only existed in this page).", "success");
    } else {
      const { status } = await request(`${API_URL}/${note.id}`, {
        method: "DELETE",
      });
      setStatus(`Note deleted (status ${status}).`, "success");
    }
    li.remove();
    showEmptyIfNeeded();
  } catch (error) {
    console.error(error);
    setStatus("Could not delete the note. Please try again.", "error");
  } finally {
    button.disabled = false;
  }
}

// ---------- 7. Listeners ----------
loadBtn.addEventListener("click", loadNotes);
form.addEventListener("submit", handleSubmit);

setStatus('Click "Load notes" to get started.');