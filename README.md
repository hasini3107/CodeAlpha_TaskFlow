# TaskFlow

A collaborative project management tool built for the CodeAlpha full-stack development internship.

## Run locally

TaskFlow uses a React/Vite client and an Express/MongoDB server. Open two terminals:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

Then open `http://localhost:5173`. The client proxies `/api` requests to the server on port `5000`.

Before starting the server, copy `server/.env.example` to `server/.env` and provide `MONGODB_URI` and a long, random `JWT_SECRET`. Authentication cannot issue or verify tokens without that secret.

On Windows, the server uses public DNS resolvers for MongoDB Atlas SRV records when `DNS_SERVERS` is not set. You can override them with a comma-separated `DNS_SERVERS` value.

## Authentication API

- `POST /api/auth/register` creates an account.
- `POST /api/auth/login` signs in and returns a seven-day JWT.
- `POST /api/auth/forgot-password` emails a one-hour, single-use password-reset link.
- `POST /api/auth/reset-password` verifies the reset token, changes the password, and invalidates older sessions.
- `GET /api/auth/me` returns the signed-in user when sent a valid Bearer token.

## Projects API

All project routes require a valid Bearer token and only access projects owned by that user.

- `GET /api/projects` lists projects.
- `POST /api/projects` creates a project.
- `GET /api/projects/:id` reads one project.
- `PATCH /api/projects/:id` updates a project.
- `DELETE /api/projects/:id` deletes a project.

## Tasks API

Tasks belong to a project and are scoped to the authenticated owner.

- `GET /api/projects/:projectId/tasks` lists tasks on a project board.
- `POST /api/projects/:projectId/tasks` creates a task.
- `PATCH /api/tasks/:id` updates status, priority, details, or due date.
- `DELETE /api/tasks/:id` deletes a task.

The dashboard includes full edit forms for project details and task details. Existing values are loaded into each form and saved through the protected `PATCH` endpoints.

## Project members

Project owners invite people by email. The invited person receives an in-app notification and must accept before the shared project becomes available. Invitations also remain pending for email addresses that have not created an account yet. Optional SMTP settings in `server/.env` enable email delivery in addition to the in-app notification.

- `GET /api/projects/:id/members` lists the owner and members.
- `POST /api/projects/:id/members` adds an existing user by email (owner only).
- `DELETE /api/projects/:id/members/:userId` removes a member and unassigns their tasks (owner only).
- `GET /api/invitations` lists the signed-in user's pending invitations.
- `PATCH /api/invitations/:id` accepts or declines an invitation.

Tasks can be assigned to the project owner or any current member through the `assignee` field.

## Real-time collaboration

Socket.IO connections authenticate with the same JWT used by the REST API. A connection must pass a project-access check before joining that project's room. Boards then receive live `task:created`, `task:updated`, `task:deleted`, `member:added`, and `member:removed` events.

The client displays a Live/Offline connection indicator. Set `VITE_SOCKET_URL` when the real-time server is hosted somewhere other than `http://localhost:5000`.

For separate production deployments, set both `VITE_API_URL` and `VITE_SOCKET_URL` in the frontend environment to the public backend origin. Local development can leave `VITE_API_URL` empty and continue using the Vite proxy.

## Productivity interface

The professional dashboard includes project search, project status filters, task search, priority and assignee filters, live result counts, board completion metrics, responsive controls, and accessible Lucide interface icons.

## Activity history

Each project stores its latest 50 activity events, including project edits, task creation/updates/deletion, and member additions/removals. `GET /api/projects/:id/activity` returns the protected history, and new events are broadcast live as `activity:created` notifications.

## Project photos

Project forms accept a cover photo that appears on the workspace card. Inside a project board, users can upload multiple project reference photos and attach multiple photos to new or existing tasks. JPG, PNG, WebP, and GIF files are supported up to 5 MB per image. Uploaded files are stored in `server/uploads` and are removed when their attachment, task, or project is deleted.

## Verify the frontend

```powershell
cd client
npm run build
```

## Deploy on Render

The repository includes a `render.yaml` Blueprint for a single Render web service. It builds the React client, serves it from Express, keeps API and Socket.IO traffic on the same origin, and checks `/api/health` during deployment.

Create a Render Blueprint from this repository and provide `MONGODB_URI` when prompted. Render generates `JWT_SECRET` automatically. The free service uses ephemeral storage, so uploaded project and task images can be cleared when the service restarts or redeploys; attach a persistent disk and set `UPLOAD_DIR` to its mount path when durable uploads are required.
