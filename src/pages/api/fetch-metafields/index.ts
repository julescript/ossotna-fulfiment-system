import config from "@/config/config";

export default async function handler(req, res) {
    const { orderId } = req.query;
  
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }
  
    try {
      const response = await fetch(
        `${config.shopify.adminApiEndpoint}/orders/${orderId}/metafields.json`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": config.shopify.accessToken,
          },
        }
      );
  
      if (!response.ok) {
        throw new Error("Failed to fetch metafields");
      }
  
      const result = await response.json();
      res.status(200).json(result.metafields);
    } catch (error) {
      console.error("Error fetching metafields:", error.message);
      res.status(500).json({ error: "Failed to fetch metafields" });
    }
  }