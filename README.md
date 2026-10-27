# Kiyaara

A full-stack e-commerce application — a customer storefront, a separate staff admin panel,
and an AI shopping assistant over the catalogue.

It began as a Day 17 exercise on custom middleware and CORS policy, and grew into a
complete app. The middleware pipeline and CORS policy are still at its core.

## Stack

**Backend** ASP.NET Core Web API · custom middleware · CORS policy · JWT bearer authentication · EF Core (SQL Server) with migrations · MailKit · Swagger
**Frontend** Angular · TypeScript · Angular Material
**AI** Google Gemini via a hand-rolled client

## Storefront

Browse by gender, product detail pages, bag, wishlist, checkout and order confirmation.
Customers register, sign in, reset a forgotten password, and review their own orders and
profile under `account/`.

## Admin

A separate login at `admin/login`, gated behind a staff role:

| Section | What it does |
|---|---|
| Dashboard | Order and sales summary |
| Orders | List, detail view and status changes |
| Products | Create and edit, with photo upload |

## AI assistant

`Assistant/GeminiLlmClient.cs` answers questions against the live catalogue — searching
products and summarising orders rather than replying from a fixed script.

## Under the hood

- **Custom middleware** — `RequestLoggingMiddleware` plus extension methods that keep
  `Program.cs` readable, the original point of the exercise
- **Explicit CORS policy**, so the Angular client on another origin can reach the API
- **JWT auth with role separation** between customers and staff
- **EF Core migrations** — schema versioned across products, customers, roles and orders
- **Services** for email (MailKit/SMTP), order notification, photo storage and tokens
- **Seeded demo data**, so the app has a populated catalogue on first run

## Layout

```
kiyaara-ecommerce/
├─ backend/     ASP.NET Core Web API
│  ├─ Assistant/   Gemini client and types
│  ├─ Middleware/  request logging, pipeline extensions
│  ├─ Services/    email, notifications, photo storage, tokens
│  └─ Data/        DbContext, seeders
└─ frontend/    Angular — pages/ for the storefront, admin/ for staff
```

## Run

```bash
# backend  →  https://localhost:7001
cd backend && dotnet run

# frontend →  http://localhost:4200
cd frontend && npm install && npm start
```

The assistant needs a Gemini API key in configuration — set it with
`dotnet user-secrets` rather than committing it.
