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
    const { namespace, key, value, type } = metafield;

    const isEmpty = value === "" || value === null || value === undefined || (typeof value === "string" && value.trim() === "");

    if (isEmpty) {
      // If value is empty, try to find and delete the existing metafield
      try {
        const listRes = await axios({
          method: "GET",
          url: `${config.shopify.adminApiEndpoint}/orders/${orderId}/metafields.json`,
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": config.shopify.accessToken,
          },
        });
        const existing = listRes.data.metafields?.find(
          (mf: any) => mf.namespace === namespace && mf.key === key
        );
        if (existing) {
          await axios({
            method: "DELETE",
            url: `${config.shopify.adminApiEndpoint}/orders/${orderId}/metafields/${existing.id}.json`,
            headers: {
              "X-Shopify-Access-Token": config.shopify.accessToken,
            },
          });
          return res.status(200).json({ success: true, message: "Metafield deleted (empty value)" });
        }
      } catch (deleteErr) {
        console.error("Error deleting metafield:", deleteErr.response?.data || deleteErr.message);
      }
      // If no existing metafield to delete, just return success
      return res.status(200).json({ success: true, message: "No metafield to clear" });
    }

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
          type
        },
      },
    });

    res.status(200).json({ success: true, metafield: response.data.metafield });
  } catch (error) {
    console.error("Error saving metafield:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to save metafield",
      details: error.response?.data || error.message,
    });
  }
}