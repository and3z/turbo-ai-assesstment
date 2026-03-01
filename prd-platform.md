# Product Requirements Document (PRD): Medical Supply Order MVP

## 1. Executive Summary

The objective of this MVP is to begin transitioning an internal medical supply
distribution team from a fragile, fully manual Excel-based workflow to a
scalable, web-based platform. To deliver immediate value, this initial phase
focuses on eliminating manual data entry into individual vendor portals. The
platform will ingest order data (via CSV or manual entry), track payment and
fulfillment statuses, and automate the routing of approved orders directly to
vendors via webhooks. Complex financial calculations will temporarily remain in
Excel.

## 2. Scope & Technical Stack

- **Framework:** Next.js (React) configured as a Progressive Web App (PWA).
- **Deployment:** Vercel.
- **Automation/Integrations:** Make.com (Webhook endpoint for automated vendor
  email routing).
- **Target Users:** Internal staff (Single global access role).

## 3. Core User Stories (MVP)

- **US1 - Authentication:** As an internal staff member, I need to log in via a
  simple global authentication screen so that unauthorized users cannot access
  sensitive patient and financial data.
- **US2 - Bulk Import (The Bridge):** As a staff member, I want to upload a CSV
  containing multiple calculated orders from our existing Excel sheet so that I
  can populate the database quickly without manual data entry.
- **US3 - Manual Data Entry:** As a staff member, I want to manually create or
  edit an order—including patient info, product details, and financial
  calculations—so that I can process one-off requests or make corrections.
- **US4 - Status Tracking:** As a staff member, I want to view and update the
  `Payment` and `Vendor` statuses of each order so that I know exactly where the
  order is in the fulfillment pipeline.
- **US5 - Automated Vendor Routing:** As a staff member, I want the system to
  automatically send the shipping and product data to the vendor once I mark the
  order as "Sent", so that I do not have to manually email them or log into
  their portal.

## 4. Functional Requirements

### 4.1. Data Model (The "Order" Entity)

To facilitate a rapid MVP, the system will utilize a flat data structure
centered around the Order entity.

- **Identifiers:**
- `order_id` (String, auto-generated unique identifier)

- **Patient & Shipping Info:**
- `patient_first_name` (String)
- `patient_last_name` (String)
- `shipping_address` (String - Required for drop-shipping)

- **Product & Vendor Info:** -`product_details` (String / Text) -`vendor_name`
  (String)
- `vendor_email` (String - Required for webhook)

- **Financial Calculations:** _(Note: These fields are manually inputted or
  imported via CSV for the MVP)_
- `financial_margin` (Number / Float)
- `financial_cost_per_unit` (Number / Float)
- `financial_billable_amount` (Number / Float)
- `financial_patient_owes` (Number / Float)

- **State Management:**
- `payment_state` (ENUM: `Waiting` | `Paid` — Default: `Waiting`)
- `vendor_state` (ENUM: `Waiting` | `Sent` — Default: `Waiting`)

### 4.2. Business Rules & State Management

- **Rule 1 - Vendor Lock:** The UI and Backend **must strictly prevent** the
  `vendor_state` from being changed to `Sent` if the `payment_state` is
  currently set to `Waiting`. The UI must disable this action to prevent unpaid
  orders from being shipped.
- **Rule 2 - Webhook Trigger:** When the `vendor_state` successfully transitions
  to `Sent`, the backend must immediately fire a POST request to the configured
  Make.com webhook URL.

### 4.3. User Interface Components

- **Login View:** Basic shared passcode entry.
- **Dashboard (Order List):** A data table displaying all orders. It must
  include interactive UI elements (dropdowns/toggles) to change the Payment and
  Vendor states directly from the table.
- **Upload Modal:** A file selection zone restricted to `.csv` format that maps
  columns to the Data Model.
- **Order Detail/Edit View:** A form modal to modify all text and financial
  fields on an existing order.

## 5. Webhook Payload Specification (Make.com Integration)

Upon the `vendor_state` changing to `Sent`, the Next.js API route will send a
JSON payload to Make.com.

_Security Note: Financial calculations (margins, costs, billable amounts) are
explicitly excluded from this payload to protect internal business data from
vendors._

```json
{
  "order_id": "ORD-12345",
  "patient_first_name": "John",
  "patient_last_name": "Doe",
  "shipping_address": "123 Recovery Lane, Springfield, IL 62701",
  "product_details": "Medi Compression Sleeve L",
  "vendor_name": "Medi",
  "vendor_email": "orders@medivendor.com",
  "timestamp": "2026-02-28T14:30:00Z"
}
```

## 6. Out of Scope for MVP

- **Internal Calculation Engine:** System auto-calculation of margins/costs
  using fee schedules and product tables (deferred to Phase 2).
- **Document Management:** PDF generation and uploads for encounter forms,
  patient invoices, or proof of delivery (POD).
- **Direct API Integrations:** Native connections to Stripe or DocuSign.
- **Approval Workflows:** Digitalization of the manager's HCPCS code approval
  flow (currently in SharePoint).
- **Complex CSV Validation:** Duplicate handling and conflict resolution for CSV
  uploads.
