import type { NextApiRequest, NextApiResponse } from "next";
import config from "@/config/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(404).json("Route not found");
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  try {
    // First, get the fulfillment orders for this order
    const fulfillmentOrdersQuery = `
      {
        order(id: "gid://shopify/Order/${orderId}") {
          id
          fulfillmentOrders(first: 5) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      }
    `;

    console.log(`Fetching fulfillment orders for orderId: ${orderId}`);
    console.log(`Using API endpoint: ${config.shopify.adminApiEndpoint}/graphql.json`);
    
    const orderResponse = await fetch(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
        body: JSON.stringify({ query: fulfillmentOrdersQuery }),
      }
    );
    
    if (!orderResponse.ok) {
      console.error(`Order fetch failed with status: ${orderResponse.status}`);
      console.error(`Response text: ${await orderResponse.text()}`);
      return res.status(500).json({ error: `Failed to fetch fulfillment orders: ${orderResponse.statusText}` });
    }

    const orderData = await orderResponse.json();
    
    if (orderData.errors) {
      console.error("Error fetching fulfillment orders:", orderData.errors);
      return res.status(500).json({ error: "Failed to fetch fulfillment orders" });
    }

    // Extract fulfillment order IDs
    const fulfillmentOrders = orderData.data.order.fulfillmentOrders.edges.map(
      (edge: any) => edge.node
    );

    if (fulfillmentOrders.length === 0) {
      return res.status(400).json({ error: "No fulfillment orders found for this order" });
    }

    // Find the first open fulfillment order
    const openFulfillmentOrder = fulfillmentOrders.find(
      (fo: any) => fo.status === "OPEN"
    );

    if (!openFulfillmentOrder) {
      return res.status(400).json({ 
        error: "No open fulfillment orders found for this order. It may already be fulfilled.",
        fulfillmentOrders
      });
    }

    // Create a fulfillment using fulfillmentCreateV2
    const fulfillmentMutation = `
      mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    console.log(`Creating fulfillment for fulfillment order: ${openFulfillmentOrder.id}`);
    
    const variables = {
      fulfillment: {
        lineItemsByFulfillmentOrder: {
          fulfillmentOrderId: openFulfillmentOrder.id
        },
        trackingInfo: {
          company: "Ossotna",
          number: `${orderId}-${Date.now()}`
        },
        notifyCustomer: true
      }
    };
    
    const fulfillmentResponse = await fetch(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
        body: JSON.stringify({ 
          query: fulfillmentMutation,
          variables: variables
        }),
      }
    );
    
    if (!fulfillmentResponse.ok) {
      console.error(`Fulfillment creation failed with status: ${fulfillmentResponse.status}`);
      console.error(`Response text: ${await fulfillmentResponse.text()}`);
      return res.status(500).json({ error: `Failed to create fulfillment: ${fulfillmentResponse.statusText}` });
    }

    const fulfillmentData = await fulfillmentResponse.json();

    if (fulfillmentData.errors || 
        (fulfillmentData.data && 
         fulfillmentData.data.fulfillmentCreateV2 && 
         fulfillmentData.data.fulfillmentCreateV2.userErrors && 
         fulfillmentData.data.fulfillmentCreateV2.userErrors.length > 0)) {
      console.error("Error creating fulfillment:", 
        fulfillmentData.errors || 
        fulfillmentData.data.fulfillmentCreateV2.userErrors);
      return res.status(500).json({ 
        error: "Failed to create fulfillment",
        details: fulfillmentData.errors || 
                fulfillmentData.data.fulfillmentCreateV2.userErrors 
      });
    }

    return res.status(200).json({
      success: true,
      fulfillment: fulfillmentData.data.fulfillmentCreateV2.fulfillment,
    });
  } catch (error) {
    console.error("Error in fulfillment API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
