import { composeFinancialFields } from "@/lib/order-financials";
import type { Order } from "@/types/order";

/**
 * Helper: returns an ISO string for `daysAgo` days before now,
 * offset by a random number of hours / minutes so timestamps look realistic.
 */
function daysAgo(days: number, hourOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hourOffset, Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString();
}

/* ------------------------------------------------------------------ */
/*  60 seed orders                                                     */
/*  • ORD-00001 → ORD-00048: COMPLETED  (payment_state = Paid,        */
/*                                        vendor_state  = Sent)        */
/*  • ORD-00049 → ORD-00060: ACTIONABLE (various pending states)       */
/* ------------------------------------------------------------------ */

const vendors = [
  { name: "Northline Medical", email: "routing@northline.test" },
  { name: "Pulse Harbor", email: "ops@pulseharbor.test" },
  { name: "MediFlow Partners", email: "orders@mediflow.test" },
  { name: "Summit Health Supplies", email: "dispatch@summitHS.test" },
  { name: "ClearPath DME", email: "orders@clearpathdme.test" },
  { name: "ProCare Distribution", email: "fulfillment@procare.test" },
];

const products = [
  "Compression sleeve, medium support, right arm",
  "Mobility brace, carbon fiber hinge, adult size",
  "Pediatric airway kit, sterile pack",
  "Walker frame, foldable, silver",
  "Knee immobilizer, adjustable, 18-inch",
  "Wheelchair cushion, gel memory foam",
  "Cervical collar, rigid, medium",
  "CPAP mask, full-face, size L",
  "Lumbar support belt, breathable mesh",
  "Ankle stabilizer, lace-up, left",
  "Wrist splint, carpal tunnel, right hand",
  "Oxygen concentrator, portable, 5L",
  "Blood pressure monitor, automatic, digital",
  "Nebulizer kit, compressor, pediatric",
  "Elbow brace, tennis elbow strap",
  "Hip abduction pillow, post-op, adult",
  "Forearm crutches, aluminum, pair",
  "TENS unit, dual channel, rechargeable",
  "Heel protector boot, pressure relief",
  "Diabetic testing kit, starter pack",
  "Shower chair, adjustable height, white",
  "Rollator walker, 4-wheel, burgundy",
  "Suction machine, portable, battery-operated",
  "Hospital bed rail, adjustable, chrome",
  "Enteral feeding pump, ambulatory",
  "IV pole, stainless steel, mobile",
  "Pulse oximeter, fingertip, Bluetooth",
  "Cold therapy unit, shoulder wrap",
  "Traction device, cervical, over-door",
  "Cast boot, walking, medium",
];

const firstNames = [
  "Alicia", "Jon", "Marisol", "Derek", "Camila", "Lucas",
  "Sophia", "Ethan", "Isabella", "Mason", "Mia", "Liam",
  "Olivia", "Noah", "Ava", "James", "Emily", "Benjamin",
  "Charlotte", "Logan", "Amelia", "Daniel", "Harper", "Samuel",
  "Evelyn", "Matthew", "Abigail", "David", "Ella", "Joseph",
  "Grace", "Henry", "Lily", "Andrew", "Chloe", "Sebastian",
  "Aria", "Jack", "Scarlett", "Owen", "Zoey", "Gabriel",
  "Riley", "Julian", "Nora", "Wyatt", "Hannah", "Leo",
  "Layla", "Carter", "Penelope", "Jayden", "Luna", "Luke",
  "Brooklyn", "Isaac", "Savannah", "Lincoln", "Victoria", "Nathan",
];

const lastNames = [
  "Stone", "Bishop", "Fleming", "Mills", "Reeves", "Tran",
  "Guerrero", "Hartley", "Nakamura", "Owens", "Petrov", "Chen",
  "Kumar", "Silva", "Anderson", "Thompson", "Ramirez", "Patel",
  "Williams", "Johnson", "Garcia", "Martinez", "Robinson", "Clark",
  "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen",
  "Young", "Hernandez", "King", "Wright", "Lopez", "Hill",
  "Scott", "Green", "Adams", "Baker", "Nelson", "Carter",
  "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell",
  "Parker", "Evans", "Edwards", "Collins", "Stewart", "Sanchez",
  "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell",
];

const streets = [
  "415 Recovery Ave, Austin, TX 78701",
  "88 Clearpoint Rd, Dallas, TX 75001",
  "12 Weston Loop, Houston, TX 77002",
  "320 Sunrise Blvd, San Antonio, TX 78205",
  "7700 Cedar Park Dr, Plano, TX 75024",
  "1423 Magnolia St, Fort Worth, TX 76102",
  "550 Ridgemont Way, El Paso, TX 79901",
  "219 Lakeview Terrace, Corpus Christi, TX 78401",
  "3305 Oakdale Ct, Lubbock, TX 79401",
  "6100 Palm Springs Ave, Laredo, TX 78040",
  "1890 Riverside Dr, Arlington, TX 76010",
  "4422 Sunstone Ln, Irving, TX 75038",
  "915 Briarwood Pl, Amarillo, TX 79101",
  "2601 Beacon Hill Rd, McAllen, TX 78501",
  "738 Midtown Pkwy, Frisco, TX 75034",
  "5520 Greenfield St, McKinney, TX 75069",
  "1105 Crescent Oak Dr, Denton, TX 76201",
  "672 Willow Creek Blvd, Round Rock, TX 78664",
  "3340 Sunset Ridge, Brownsville, TX 78520",
  "4980 Harborview Rd, Galveston, TX 77550",
];

function buildOrder(
  index: number,
  paymentState: "Paid" | "Waiting",
  vendorState: "Sent" | "Waiting",
  dayOffset: number,
  shippingAddress?: string,
): Order {
  const v = vendors[index % vendors.length];
  const p = products[index % products.length];
  const created = daysAgo(dayOffset, Math.floor(Math.random() * 8));
  const updated = daysAgo(Math.max(dayOffset - 1, 0), Math.floor(Math.random() * 6));
  const addr = shippingAddress !== undefined ? shippingAddress : streets[index % streets.length];
  const financial_cost_per_unit = +(30 + Math.random() * 120).toFixed(2);
  const financial_billable_amount = +(financial_cost_per_unit + 25 + Math.random() * 180).toFixed(2);
  const financial_coverage_pct = +(55 + Math.random() * 35).toFixed(1);

  return {
    order_id: `ORD-${String(index).padStart(5, "0")}`,
    patient_first_name: firstNames[(index - 1) % firstNames.length],
    patient_last_name: lastNames[(index - 1) % lastNames.length],
    shipping_address: addr,
    product_details: p,
    vendor_name: v.name,
    vendor_email: v.email,
    ...composeFinancialFields({
      financial_cost_per_unit,
      financial_billable_amount,
      financial_coverage_pct,
    }),
    payment_state: paymentState,
    vendor_state: vendorState,
    created_at: created,
    updated_at: updated,
  };
}

export const seedOrders: Order[] = [
  /* ───── 48 COMPLETED orders (Paid + Sent) ───── */
  /* Spread across the last 30 days so dates feel real */
  ...Array.from({ length: 48 }, (_, i) => {
    const idx = i + 1;
    const dayOffset = 2 + Math.floor((i / 48) * 28); // spread from 2 to 30 days ago
    return buildOrder(idx, "Paid", "Sent", dayOffset);
  }),

  /* ───── 12 ACTIONABLE orders ───── */

  // 4 × Waiting payment, Waiting vendor (need payment)
  buildOrder(49, "Waiting", "Waiting", 1),
  buildOrder(50, "Waiting", "Waiting", 1),
  buildOrder(51, "Waiting", "Waiting", 0),
  buildOrder(52, "Waiting", "Waiting", 0),

  // 4 × Paid, Waiting vendor (ready to send)
  buildOrder(53, "Paid", "Waiting", 1),
  buildOrder(54, "Paid", "Waiting", 1),
  buildOrder(55, "Paid", "Waiting", 0),
  buildOrder(56, "Paid", "Waiting", 0),

  // 2 × Paid, Waiting vendor but missing shipping address (blocked send)
  buildOrder(57, "Paid", "Waiting", 0, ""),
  buildOrder(58, "Paid", "Waiting", 0, ""),

  // 2 × Waiting payment, Waiting vendor, missing address too
  buildOrder(59, "Waiting", "Waiting", 0, ""),
  buildOrder(60, "Waiting", "Waiting", 0, ""),
];
