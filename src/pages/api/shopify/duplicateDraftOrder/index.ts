import axios from "axios";
import config from "@/config/config"; // your custom config

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  try {
    const { draft_order } = req.body;
    if (!draft_order || !draft_order.line_items) {
      return res
        .status(400)
        .json({ error: "Missing draft_order or draft_order.line_items" });
    }

    // POST to Shopify's /draft_orders.json
    const response = await axios.post(
      `${config.shopify.adminApiEndpoint}/draft_orders.json`,
      { draft_order },
      {
        headers: {
          "X-Shopify-Access-Token": config.shopify.accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    // If Shopify returns 202 Accepted, polling is required. Otherwise 200 means it's ready.
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error creating draft order:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Failed to create draft order",
      details: error.response?.data || error.message,
    });
  }
}