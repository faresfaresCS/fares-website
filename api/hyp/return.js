import { sendOrderEmail } from "../../lib/notify.js";
import { verifyReturnMac } from "../../lib/hyp.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const siteUrl = (process.env.SITE_URL || "https://www.faresfares.online").replace(/\/$/, "");
  const status = req.query.status || "unknown";
  const macKey = process.env.HYP_MAC_KEY;

  if (status === "success" && macKey) {
    const valid = verifyReturnMac(req.query, macKey);
    if (!valid) {
      return res.redirect(302, `${siteUrl}/checkout/error.html?reason=mac`);
    }

    try {
      await sendOrderEmail({
        id: req.query.uniqueid || req.query.orderId || "unknown",
        total: Number(req.query.sum || req.query.total || 0) / 100,
        lines: [],
        customer: { phone: req.query.cell || req.query.phone || "" },
        paymentRef: req.query.cgUid || req.query.tranId || "",
      });
    } catch (err) {
      console.error("order email failed:", err);
    }
  }

  if (status === "success") {
    return res.redirect(302, `${siteUrl}/checkout/success.html`);
  }

  return res.redirect(302, `${siteUrl}/checkout/error.html`);
}
