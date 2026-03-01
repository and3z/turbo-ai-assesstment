import { NextResponse } from "next/server";

type VendorPayload = {
  order_id: string;
  patient_first_name: string;
  patient_last_name: string;
  shipping_address: string;
  product_details: string;
  vendor_name: string;
  vendor_email: string;
  timestamp: string;
};

function sanitizePayload(input: unknown): VendorPayload | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const payload: VendorPayload = {
    order_id: String(candidate.order_id ?? "").trim(),
    patient_first_name: String(candidate.patient_first_name ?? "").trim(),
    patient_last_name: String(candidate.patient_last_name ?? "").trim(),
    shipping_address: String(candidate.shipping_address ?? "").trim(),
    product_details: String(candidate.product_details ?? "").trim(),
    vendor_name: String(candidate.vendor_name ?? "").trim(),
    vendor_email: String(candidate.vendor_email ?? "").trim(),
    timestamp: String(candidate.timestamp ?? "").trim(),
  };

  const requiredValues = Object.values(payload);
  const hasEmpty = requiredValues.some((value) => value.length === 0);

  return hasEmpty ? null : payload;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = sanitizePayload(body);

  if (!payload) {
    return NextResponse.json(
      { error: "Payload is incomplete. Financial data is never accepted here." },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json({
      ok: true,
      mocked: true,
      message: "MAKE_WEBHOOK_URL is not configured. Payload validated in mock mode.",
      payload,
    });
  }

  const upstreamResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);

  if (!upstreamResponse || !upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "The Make.com webhook did not accept the request.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, mocked: false });
}

