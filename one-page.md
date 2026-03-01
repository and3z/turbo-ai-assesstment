# Product One-Pager: Order Automation MVP

## **What is it?**

An MVP designed to systematize and automate the team's daily operations by
centralizing order management into a single platform. Its purpose is to
eliminate reliance on a fragile Excel spreadsheet, putting an end to data
structure errors, operational overloads, and lags caused by nested tables,
manual task execution, and the rewriting of information across the different
platforms the user must interact with to successfully complete an order,
creating a much faster and safer workflow.

## **Problem: What problem is this solving?**

Currently, the fulfillment process is fragmented and manual. The medical
distribution team relies on a complex and fragile Excel sheet to process orders.
The biggest operational bottleneck occurs after the patient pays: the staff must
invest part of their day manually transcribing information (which already exists
in their Excel) into various vendor portals. This causes delays in the time it
takes the company to receive payments from insurance companies and the patient,
double data entry fatigue, and a high risk of transcription errors, preventing
the operation from scaling.

## **Why: How do we know this is a real problem and worth solving?**

The client (Alex) has pointed out that re-entering data into vendor portals is a
repetitive and highly time-consuming task. Our hypothesis is that by targeting
the "output" of data (sending it to the vendor) with a product that performs the
minimum calculations required to place the order, we can deliver the highest
operational value with the least technical effort. If we aim directly at the
pain point that impacts the business, we can better evaluate the operational
impact of the proposed solution.

## **Success: How do we know if we’ve solved this problem?**

As an MVP, our goal is to validate the integration of manual order entry,
calculate the values needed to place the order, and send the request to the
vendor:

1. **Reduction in payment time:** Does the average time from when the patient
   pays until the order is sent to the vendor decrease?

2. **Reduction in order cycle time:** Does the time from when the order request
   is made until payment is received from the insurance decrease?

3. **Reduction in manual workload:** Does the number of weekly hours the team
   spends transcribing data to third-party portals decrease? In other words, can
   more orders or tasks be completed in a day?

4. **Adoption and friction (Qualitative):** Does the team prefer using CSV
   import and status changes on the platform, or does the intermediate process
   cause more friction than the current manual workflow?

## Audience: Who are we building for?

The internal medical supply operations and distribution team. It is an
administrative user who needs tools to reduce friction in their day-to-day, not
a patient-facing interface.

## **What: Roughly, what does this look like in the product?**

- **Main Interface:** A clean dashboard (data table) listing patient orders.

- **Data Entry:** A module to import processed orders via a `.csv` file (from
  the current Excel), and a basic form to manually edit details if necessary.

- **Status Management:** Direct controls in the table to mark the `Payment`
  status (Waiting/Paid) and the `Vendor` status (Waiting/Sent).

- **Business Rule (Vendor Lock):** The system will block the option to change
  the vendor status to "Sent" unless the payment is registered as "Paid".

- **Automation (Webhook):** Changing the status to "Sent" will trigger a
  background request sending only logistical and product data (excluding
  financial data) to Make.com, to route the email to the corresponding vendor.

## **How: What is the experiment plan?**

1. **Lean Construction:** Develop the PWA scaffolding integrating the flat data
   model and connecting the Webhook.

2. **Shadowing / Parallel Testing:** During the first week, the team will
   continue using the traditional manual method but will upload the CSV to the
   PWA at the end of the day to verify that data maps correctly and test emails
   simulating the vendors.

3. **Evaluation:** Analyze the information required by one of the vendors to see
   what other requirements are needed to scale the solution and send the first
   orders to the vendor.

**When: When does it ship and what are the milestones?**

- **Milestone 1 (Data Ingestion and Auto-calculations):** Database configuration
  for manual and bulk (CSV) order capture, and implementation of the internal
  engine for calculating fees and financial fields.

- **Milestone 2 (Vendor Order Request Generation):** Development of operational
  logic and automation via webhooks to send shipping data to the different
  vendors.

- **Milestone 3 (Document Managers):** Creation of a module to attach, organize,
  and store order-specific documents (e.g., medical measurement forms required
  by therapists).

- **Milestone 4 (Integrations and Automated Patient Emails with Payment Link):**
  Integration of third-party APIs (Stripe, DocuSign) to automate invoice
  generation and directly send payment links to patients.

- **Milestone 5 (Auto orders creation):** Create an order automatically on the
  system when is sent by Clinic or therapist
