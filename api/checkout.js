import crypto from "node:crypto";
import { validateCart } from "../lib/catalog.js";
import { createPaymentPage, hypConfigured } from "../lib/hyp.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ configured: hypConfigured() });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, customer } = req.body || {};
    const { lines, total } = validateCart(items);
    const orderId = `ord_${crypto.randomBytes(8).toString("hex")}`;

    const paymentUrl = await createPaymentPage({
      orderId,
      total,
      customer: customer || {},
    });

    return res.status(200).json({
      orderId,
      paymentUrl,
      total,
      lines,
    });
  } catch (err) {
    if (err.code === "HYP_NOT_CONFIGURED") {
      return res.status(503).json({
        error: "hyp_not_configured",
        message: "תשלום מאובטח יהיה זמין לאחר חיבור Hyp Pay",
      });
    }
    console.error("checkout error:", err);
    return res.status(400).json({ error: err.message || "Checkout failed" });
  }
}
