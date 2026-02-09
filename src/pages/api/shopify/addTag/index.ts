import type { NextApiRequest, NextApiResponse } from "next";
import config from "@/config/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(404).json("Route not found");
  }

  const { orderId, tag } = req.body;

  if (!orderId || !tag) {
    return res.status(400).json({ error: "Order ID and tag are required" });
  }

  try {
    // Use tagsAdd mutation to add a tag to the order
    const tagsAddMutation = `
      mutation tagsAdd($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
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
      tags: [tag],
    };

    console.log(`Adding tag "${tag}" to order ${orderId}`);

    const response = await fetch(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
        body: JSON.stringify({ query: tagsAddMutation, variables }),
      }
    );

    if (!response.ok) {
      console.error(`Tag add failed with status: ${response.status}`);
      return res.status(500).json({ error: `Failed to add tag: ${response.statusText}` });
    }

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return res.status(500).json({ error: "Failed to add tag", details: data.errors });
    }

    const userErrors = data.data?.tagsAdd?.userErrors;
    if (userErrors && userErrors.length > 0) {
      console.error("User errors:", userErrors);
      return res.status(500).json({ error: "Failed to add tag", details: userErrors });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in addTag API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
