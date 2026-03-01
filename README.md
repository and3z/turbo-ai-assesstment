# MedSupp — Medical Supply Order Management

A web-based platform for managing medical supply orders, replacing manual Excel
workflows with an internal tool for CSV import, order tracking, and automated
vendor routing.

![Next.js](https://img.shields.io/badge/Next.js-15.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)

---

## Overview

MedSupp streamlines the medical supply distribution workflow for internal staff
by providing:

- **CSV Bulk Import** — Upload orders from existing Excel sheets
- **Manual Order Entry** — Create and edit individual orders with patient,
  product, and financial data
- **Status Tracking** — Track payment (Waiting → Paid) and vendor shipment
  (Waiting → Sent) states
- **Automated Vendor Routing** — Send approved orders to vendors via Make.com
  webhook integration
- **Financial Dashboard** — View margins, patient responsibility, and payer
  coverage at a glance

> **Note:** This is a prototype. Data is stored in browser localStorage and
> authentication uses a shared passcode.

---

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| Framework     | Next.js 15 (App Router)             |
| UI            | React 19, Tailwind CSS 3.4          |
| Language      | TypeScript 5.8                      |
| Notifications | Sonner (toast notifications)        |
| Integrations  | Make.com (webhook for vendor email) |
| Deployment    | Vercel                              |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd TurboAI-assestment

# Install dependencies
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable           | Description                             | Required |
| ------------------ | --------------------------------------- | -------- |
| `GLOBAL_PASSCODE`  | Shared login passcode for all staff     | Yes      |
| `MAKE_WEBHOOK_URL` | Make.com webhook URL for vendor routing | No*      |

> \* If `MAKE_WEBHOOK_URL` is not set, vendor sends will run in **mock mode** —
> the payload is validated but not forwarded.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the passcode
defined in `.env.local`.

### Other Commands

```bash
npm run build       # Production build
npm run start       # Start production server
npm run typecheck   # TypeScript type checking (no emit)
```

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/login/          # POST — validates passcode, sets session cookie
│   │   ├── auth/logout/         # POST — clears session cookie
│   │   ├── auth/session/        # GET  — returns authentication status
│   │   └── orders/send-to-vendor/ # POST — forwards order payload to Make.com
│   ├── orders/                  # Orders dashboard page
│   ├── globals.css              # Global styles & design tokens
│   ├── layout.tsx               # Root layout with Toaster
│   ├── manifest.ts              # PWA manifest config
│   └── page.tsx                 # Login page
├── components/
│   ├── orders-workspace.tsx     # Main orders UI (table, modals, editor)
│   ├── login-form.tsx           # Login form component
│   └── app-logo.tsx             # Brand logo SVG
├── lib/
│   ├── auth.ts                  # Passcode validation
│   ├── demo-data.ts             # 60 seed orders for prototyping
│   ├── order-financials.ts      # Financial calculations (margin, coverage, etc.)
│   ├── order-storage.ts         # localStorage persistence
│   └── order-utils.ts           # CSV parser, search, validation, payload builder
├── types/
│   └── order.ts                 # Order, OrderDraft, enums, payload types
├── middleware.ts                # Auth guard — redirects unauthenticated users
├── public/
│   └── template.csv             # Downloadable CSV import template
└── tailwind.config.ts           # Tailwind theme (custom colors, fonts, shadows)
```

---

## Key Features

### CSV Import

Upload a `.csv` with the following required headers:

```
patient_first_name, patient_last_name, shipping_address,
product_details, vendor_name, vendor_email,
financial_cost_per_unit, financial_billable_amount, financial_coverage_pct
```

Optional columns: `payment_state`, `vendor_state`

A downloadable template is available within the Import CSV modal.

### Business Rules

1. **Vendor Lock:** An order cannot be marked as "Sent" unless its payment
   status is "Paid"
2. **Webhook Trigger:** When vendor status changes to "Sent", a POST request is
   fired to the configured Make.com webhook
3. **Financial Exclusion:** Margins, costs, and billable amounts are **never**
   included in webhook payloads to protect internal data

### Webhook Payload

When an order is sent to a vendor, the following JSON is delivered:

```json
{
    "order_id": "ORD-00053",
    "patient_first_name": "Sophia",
    "patient_last_name": "Guerrero",
    "shipping_address": "415 Recovery Ave, Austin, TX 78701",
    "product_details": "Compression sleeve, medium support, right arm",
    "vendor_name": "Northline Medical",
    "vendor_email": "routing@northline.test",
    "timestamp": "2026-03-01T06:30:00.000Z"
}
```

---

## Prototype Limitations

This is an MVP prototype with the following known limitations:

- **No database** — All data persists in browser `localStorage` only
- **Shared passcode auth** — No user identity, roles, or session tokens
- **Single-browser state** — Data is not synced between devices or users
- **No automated tests** — Business logic and UI are untested

See the [PRD](./prd-platform.md) and [MVP Plan](./mvp_plan_to_do.md) for the
full scope and roadmap.

---

## License

This project is private and intended for internal use only.
