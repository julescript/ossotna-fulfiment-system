// pages/api/shopify/createOrder.js

import axios from "axios";
import config from "@/config/config"; // Ensure this points to your config file

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { order } = req.body;

    if (!order || !order.line_items || order.line_items.length === 0) {
      return res.status(400).json({ error: "Missing required fields: order or line_items" });
    }

    // POST to Shopify's /admin/api/{api_version}/orders.json
    const response = await axios.post(
      `${config.shopify.adminApiEndpoint}/orders.json`,
      { order },
      {
        headers: {
          "X-Shopify-Access-Token": config.shopify.accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error creating order:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Failed to create order",
      details: error.response?.data || error.message,
    });
  }
}