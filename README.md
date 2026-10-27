# Day 17 — CORS & Middleware

Exercise on custom middleware and CORS policy, grown into an admin storefront (products, orders, dashboard) with an AI assistant on top.

## Stack

**Backend** ASP.NET Core Web API · custom middleware · CORS policy · JWT bearer authentication · EF Core (SQL Server) · MailKit · Swagger
**Frontend** Angular · TypeScript
**AI** Google Gemini via a hand-rolled client

## What it does

- **Custom middleware pipeline** — the point of the exercise: request logging and
  cross-cutting concerns handled before the request reaches a controller
- **Explicit CORS policy** so the Angular client on another origin can call the API
- **Storefront admin** — products, orders and a dashboard
- **AI assistant** (`Assistant/GeminiLlmClient.cs`) answering questions against store data
- **Seeded database** — `DatabaseSeeder` and `SeedData` fill demo products and orders, so
  the app has something to show on first run
- Email via MailKit, JWT-protected endpoints

## Layout

```
day17-cors/
├─ backend/     .NET Web API — Day17MiddlewareCors.csproj at this level
│  └─ Assistant/  Gemini client and types
└─ frontend/    Angular (day17-cors-client)
```

## Run

```bash
# backend  →  https://localhost:7001
cd day17-cors/backend && dotnet run

# frontend →  http://localhost:4200
cd day17-cors/frontend && npm install && npm start
```

The assistant needs a Gemini API key in configuration — set it with
`dotnet user-secrets` rather than committing it.
