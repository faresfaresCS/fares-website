export async function sendOrderEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.warn("Order email skipped: RESEND_API_KEY or NOTIFY_EMAIL not set");
    return false;
  }

  const from = process.env.NOTIFY_FROM || "פארס פארס <onboarding@resend.dev>";
  const lines = order.lines
    .map((l) => `• ${l.name} × ${l.qty} — ₪${l.lineTotal.toFixed(2)}`)
    .join("\n");

  const body = {
    from,
    to: [to],
    subject: `הזמנה חדשה #${order.id} — ₪${order.total.toFixed(2)}`,
    text: [
      "התקבלה הזמנה חדשה באתר פארס פארס",
      "",
      `מספר הזמנה: ${order.id}`,
      `סה״כ: ₪${order.total.toFixed(2)}`,
      "",
      "פריטים:",
      lines,
      "",
      order.customer?.name ? `שם: ${order.customer.name}` : null,
      order.customer?.phone ? `טלפון: ${order.customer.phone}` : null,
      order.customer?.email ? `אימייל: ${order.customer.email}` : null,
      order.paymentRef ? `אסמכתא תשלום: ${order.paymentRef}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend failed: ${res.status} ${detail}`);
  }

  return true;
}
