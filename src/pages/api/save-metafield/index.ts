import axios from "axios";
import config from "@/config/config";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, metafield } = req.body;

  if (!orderId || !metafield) {
    return res.status(400).json({ error: "Missing required fields: orderId or metafield" });
  }

  try {
    const { namespace, key, value } = metafield;

    // Make a POST request to Shopify's order-specific metafield endpoint
    const response = await axios({
      method: "POST",
      url: `${config.shopify.adminApiEndpoint}/orders/${orderId}/metafields.json`,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.shopify.accessToken,
      },
      data: {
        metafield: {
          namespace,
          key,
          value,
          type: "single_line_text_field", // Define the type (new Shopify API standard)
        },
      },
    });

    res.status(200).json({ success: true, metafield: response.data.metafield });
  } catch (error) {
    console.error("Error saving metafield:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to save metafield",
      details: error.response?.data || error.message, // Add detailed error
    });
  }
}