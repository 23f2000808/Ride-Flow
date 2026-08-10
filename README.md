# RideFlow

RideFlow is a full-stack ride-booking platform with three role-aware experiences:

- `customer`: book rides, see fare previews, track active trips, review ride history, and view analytics
- `driver`: go online, receive dispatch requests, accept or reject trips, manage active rides, and monitor earnings/performance
- `admin`: review platform activity, approve drivers, inspect rides, and monitor marketplace health

The backend is an Express + MongoDB + Redis API with real-time Socket.IO updates, BullMQ dispatch jobs, Redis-backed idempotency and rate limiting, and Prometheus metrics. The frontend is a React + Vite single-page app with animated dashboards, Leaflet maps, and role-based routing.

## What Is Implemented

- JWT access tokens plus refresh-token rotation using an HTTP-only cookie
- Customer, driver, and admin signup/login flows
- Customer ride booking with fare preview and live ride status updates
- Driver availability toggling, driver location updates, and nearby-driver geo queries
- Ride dispatch batching through BullMQ and Redis
- Ride lifecycle transitions: `requested -> accepted -> arriving -> in_progress -> completed` plus cancellation paths
- Ride history with server-side filtering and sorting for customers and drivers
- Customer and driver analytics dashboards backed by MongoDB aggregations
- Admin analytics, driver approval workflow, ride cleanup, and bulk ride status updates
- Socket.IO rooms for user-, driver-, and ride-scoped realtime events
- Health and metrics endpoints for operations visibility

## Stack

- Frontend: React 19, Vite, React Router, Framer Motion, Recharts, Leaflet, Socket.IO client
- Backend: Node.js, Express 5, Socket.IO, BullMQ
- Database: MongoDB with Mongoose and geospatial indexes
- Cache / infra: Redis via `ioredis`
- Observability: Pino logs and Prometheus metrics

## Architecture Notes

- `backend/app.js` starts the Express API, static file serving, Socket.IO, the dispatch worker, and the outbox worker.
- `frontend/` contains the current role-based React app.
- `backend/public/index.html` is a legacy API dashboard fallback served when `frontend/dist` is not available.
- Redis is used for four things: BullMQ jobs, Socket.IO pub/sub adapter, idempotency keys, and rate limiting.
- The backend can use OpenRouteService for routing distance/ETA, but fare calculation falls back to a Haversine estimate when ORS is unavailable or not configured.
- The customer dashboard also calls public geocoding/routing services directly from the browser:
  - Nominatim for search/reverse geocoding
  - OSRM for drawing route lines on the map

## Repository Layout

```text
frontend/      React + Vite frontend
backend/       Express API, MongoDB models, Redis workers, scripts
README.md      project overview and local setup
package.json   root helper scripts for frontend/backend commands
```

## Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Optional: an OpenRouteService API key for more realistic route distance and ETA calculations

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Environment Variables

Create `backend/.env` for the backend:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/uber-clone
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

CLIENT_URL=http://localhost:5173
LOG_LEVEL=info

JWT_SECRET=change_me
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me
JWT_EXPIRES_IN=24h
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_REMEMBER_EXPIRES_IN=30d

ADMIN_SIGNUP_CODE=change_me
ORS_API_KEY=optional_openrouteservice_key
```

Frontend environment variables are optional. The code currently supports:

```env
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=http://localhost:3000
VITE_BACKEND_URL=http://localhost:3000
```

Notes:

- `VITE_API_BASE_URL` is used by the Axios client in the React app.
- `VITE_SOCKET_URL` overrides the Socket.IO connection target.
- `VITE_BACKEND_URL` is used by the Vite dev proxy config.
- If you do not set `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET`, the app falls back to `JWT_SECRET`.
- Set `ADMIN_SIGNUP_CODE` explicitly for any non-local environment.

## Running The App

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in a second terminal:

```bash
npm run dev:frontend
```

Build the frontend:

```bash
npm run build:frontend
```

When `frontend/dist` exists, the backend serves that build. Otherwise, it serves the legacy `backend/public/` dashboard.

## Available Scripts

Root helper scripts:

```bash
npm run dev:backend
npm run dev:frontend
npm run build:frontend
npm run lint:frontend
npm run preview:frontend
npm run start:backend
npm run migrate:ride-dates
npm run migrate:ride-query-fields
```

Backend package:

```bash
cd backend
npm start
npm run dev
npm run migrate:ride-dates
npm run migrate:ride-query-fields
```

Frontend package:

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

Additional utility script:

```bash
cd backend
node scripts/seed.js
```

## Seed And Maintenance Scripts

- `backend/scripts/seed.js`
  - approves existing drivers
  - places them around Bangalore coordinates
  - marks them online and available
  - seeds or updates a default admin-style account record for local development
- `backend/scripts/fixRideCreatedAt.js`
  - repairs string-based `createdAt` values in ride documents
- `backend/scripts/backfillRideQueryFields.js`
  - backfills `requestedAt`
  - backfills `effectiveFare`
  - recreates indexes used by ride filtering and sorting

## Frontend Routes

Main frontend entry points:

- `/`
  - role selection landing page
- `/login?role=customer|driver|admin`
- `/signup?role=customer|driver|admin`
- `/dashboard/customer`
- `/dashboard/customer/rides`
- `/dashboard/customer/analytics`
- `/dashboard/customer/profile`
- `/dashboard/customer/settings`
- `/dashboard/driver`
- `/dashboard/driver/rides`
- `/dashboard/driver/analytics`
- `/dashboard/driver/settings`
- `/dashboard/admin`
- `/dashboard/admin/rides`
- `/dashboard/admin/profile`
- `/dashboard/admin/settings`

## API Overview

Mounted route groups:

- `/api/auth`
  - `POST /signup`
  - `POST /login`
  - `POST /refresh`
  - `POST /logout`
- `/api/users`
  - legacy-style registration/login plus shared profile/password endpoints
- `/api/drivers`
  - driver creation, lookup, nearby search, status, location, availability
- `/api/rides`
  - booking, fare preview, ride retrieval, ride history, analytics, lifecycle updates
- `/api/admin`
  - users, drivers, analytics, ride moderation, cleanup, bulk status updates

Compatibility aliases that still exist:

- `/users` -> same handlers as `/api/users`
- `/api/driver` -> same handlers as `/api/drivers`

Important behavior:

- `POST /api/rides` requires:
  - auth
  - customer/admin role
  - `Idempotency-Key` header
  - Redis-backed user rate limiting
- `PATCH /api/rides/:id/status` requires:
  - auth
  - driver/admin role
  - `Idempotency-Key` header
  - Redis-backed driver rate limiting
- analytics endpoint:
  - `GET /api/rides/analytics?scope=user|driver&range=today|7d|30d|6m`

## Realtime And Background Processing

- Socket.IO auth uses the access token from `socket.handshake.auth.token`
- Connected clients join:
  - personal rooms like `customer_<id>`, `driver_<id>`, `admin_<id>`
  - `drivers_lobby` for driver-side dispatch broadcasting
  - ride rooms like `ride_<rideId>`
- Dispatch worker behavior:
  - queues batches of nearby candidate drivers
  - emits `new-ride-request` to driver rooms
  - processes candidates in batches of 3 with a 15-second delay between batches
- Outbox worker behavior:
  - polls pending outbox events every 3 seconds
  - can emit Socket.IO events or enqueue dispatch jobs
- Driver heartbeat monitor:
  - runs every 15 seconds
  - marks stale online drivers offline when heartbeat timestamps age out

## Operations

- `GET /health`
  - checks MongoDB and Redis readiness
- `GET /api/health`
  - lightweight JSON health endpoint
- `GET /metrics`
  - Prometheus metrics

The backend also records request latency with `prom-client` and logs request completions with Pino.

## Current Caveats

- There are two auth styles in the project:
  - the newer mounted flow under `/api/auth`
  - older `/api/users/register` and `/api/users/login` endpoints still present for compatibility
- Role naming is mixed in a few places:
  - backend auth normalizes `user` to `customer`
  - some legacy data models and endpoints still use `user`
- There is no automated test suite wired up for the backend package yet.
- `frontend/dist/` is a generated build artifact, but the intended source of truth for frontend code is `frontend/src/`.
- `backend/public/index.html` documents a smaller legacy API dashboard than the current React app.

## Suggested Local Workflow

1. Start MongoDB and Redis.
2. Install backend and frontend dependencies.
3. Set `backend/.env`.
4. Run `npm run dev:backend` in the project root.
5. Run `npm run dev:frontend` in a second terminal.
6. Optionally run `cd backend && node scripts/seed.js` to approve drivers and seed local data.

## Status

This repository is a working multi-role ride-booking platform with a polished React dashboard layer and a backend that already includes real-time updates, dispatch jobs, ride analytics, and admin operations, but it is still in an active development state rather than a fully hardened production deployment.
