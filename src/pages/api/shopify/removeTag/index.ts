import type { NextApiRequest, NextApiResponse } from "next";
import config from "@/config/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(404).json("Route not found");
  }

  const { orderId, tags } = req.body;

  if (!orderId || !tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: "Order ID and tags array are required" });
  }

  try {
    const tagsRemoveMutation = `
      mutation tagsRemove($id: ID!, $tags: [String!]!) {
        tagsRemove(id: $id, tags: $tags) {
          node {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      id: `gid://shopify/Order/${orderId}`,
      tags,
    };

    console.log(`Removing tags [${tags.join(', ')}] from order ${orderId}`);

    const response = await fetch(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
        body: JSON.stringify({ query: tagsRemoveMutation, variables }),
      }
    );

    if (!response.ok) {
      console.error(`Tag remove failed with status: ${response.status}`);
      return res.status(500).json({ error: `Failed to remove tags: ${response.statusText}` });
    }

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return res.status(500).json({ error: "Failed to remove tags", details: data.errors });
    }

    const userErrors = data.data?.tagsRemove?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error("User errors:", userErrors);
      return res.status(500).json({ error: "Failed to remove tags", details: userErrors });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in removeTag API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
