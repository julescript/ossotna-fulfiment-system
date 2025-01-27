import type { NextApiRequest, NextApiResponse } from "next";
import config from "@/config/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(404).json("Route not found");
  }

  const { sku, limit = 50, page_info, fulfillment_status } = req.query;

  const params = new URLSearchParams({
    limit: String(limit),
    status: "open", // Explicitly fetch all orders, regardless of status
  });

  if (page_info) {
    params.append("page_info", String(page_info));
  }

  if (fulfillment_status) {
    params.append("fulfillment_status", String(fulfillment_status));
  }

  try {
    // Fetch orders
    const response = await fetch(
      `${config.shopify.adminApiEndpoint}/orders.json?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
      }
    );

    const result = await response.json();
    let orders = result.orders;

    // Filter by SKU if provided
    if (sku) {
      orders = orders.filter((order) =>
        order.line_items.some((item) => item.sku === sku)
      );
    }

    // Fetch metafields for each order
    const ordersWithMetafields = await Promise.all(
      orders.map(async (order) => {
        try {
          const metafieldsResponse = await fetch(
            `${config.shopify.adminApiEndpoint}/orders/${order.id}/metafields.json`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": config.shopify.accessToken,
              },
            }
          );

          const metafieldsData = await metafieldsResponse.json();
          order.metafields = metafieldsData.metafields || [];
        } catch (error) {
          console.error(`Error fetching metafields for order ${order.id}:`, error);
          order.metafields = [];
        }

        return order;
      })
    );

    res.status(200).json(ordersWithMetafields);
  } catch (error) {
    console.error("Error fetching Shopify orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
}