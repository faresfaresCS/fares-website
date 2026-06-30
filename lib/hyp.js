import crypto from "node:crypto";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function hypConfigured() {
  return Boolean(
    process.env.HYP_API_URL &&
      process.env.HYP_API_USER &&
      process.env.HYP_API_PASSWORD &&
      process.env.HYP_TERMINAL_NUMBER &&
      process.env.HYP_MID &&
      process.env.HYP_MAC_KEY &&
      process.env.SITE_URL
  );
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildPaymentPageXml({ orderId, totalAgurot, customer, successUrl, errorUrl, cancelUrl }) {
  const userField = (customer?.phone || customer?.email || orderId).slice(0, 19);
  return `<ashrait>
  <request>
    <version>2000</version>
    <language>HEB</language>
    <command>doDeal</command>
    <doDeal>
      <terminalNumber>${escapeXml(requireEnv("HYP_TERMINAL_NUMBER"))}</terminalNumber>
      <transactionType>Debit</transactionType>
      <creditType>RegularCredit</creditType>
      <currency>ILS</currency>
      <transactionCode>Internet</transactionCode>
      <total>${totalAgurot}</total>
      <validation>TxnSetup</validation>
      <mpiValidation>${escapeXml(requireEnv("HYP_MID"))}</mpiValidation>
      <mid>${escapeXml(requireEnv("HYP_MID"))}</mid>
      <uniqueid>${escapeXml(orderId)}</uniqueid>
      <user>${escapeXml(userField)}</user>
      <successUrl>${escapeXml(successUrl)}</successUrl>
      <errorUrl>${escapeXml(errorUrl)}</errorUrl>
      <cancelUrl>${escapeXml(cancelUrl)}</cancelUrl>
    </doDeal>
  </request>
</ashrait>`;
}

function parsePaymentPageUrl(xml) {
  const match = xml.match(/<mpiHostedPageUrl>([^<]+)<\/mpiHostedPageUrl>/i);
  return match?.[1] || null;
}

/** Create a Hyp hosted payment page. Requires env vars — see .env.example */
export async function createPaymentPage({ orderId, total, customer }) {
  if (!hypConfigured()) {
    const err = new Error("Hyp Pay is not configured yet");
    err.code = "HYP_NOT_CONFIGURED";
    throw err;
  }

  const siteUrl = requireEnv("SITE_URL").replace(/\/$/, "");
  const totalAgurot = Math.round(total * 100);
  const intIn = buildPaymentPageXml({
    orderId,
    totalAgurot,
    customer,
    successUrl: `${siteUrl}/api/hyp/return?status=success`,
    errorUrl: `${siteUrl}/api/hyp/return?status=error`,
    cancelUrl: `${siteUrl}/checkout/error.html`,
  });

  const body = new URLSearchParams({
    user: requireEnv("HYP_API_USER"),
    password: requireEnv("HYP_API_PASSWORD"),
    int_in: intIn,
  });

  const res = await fetch(requireEnv("HYP_API_URL"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Hyp API HTTP ${res.status}`);
  }

  const paymentUrl = parsePaymentPageUrl(text);
  if (!paymentUrl) {
    throw new Error("Hyp did not return a payment page URL");
  }

  return paymentUrl;
}

/** Verify MAC on Hyp redirect query params — refine field order per Hyp docs when credentials arrive. */
export function verifyReturnMac(query, macKey) {
  const received = String(query.mac || query.MAC || "");
  if (!received || !macKey) return false;

  const parts = [];
  for (const [key, value] of Object.entries(query)) {
    if (key.toLowerCase() === "mac") continue;
    parts.push(`${key}=${value}`);
  }
  parts.sort();
  const payload = parts.join("&");
  const expected = crypto.createHmac("sha256", macKey).update(payload).digest("hex");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}

export { hypConfigured };
