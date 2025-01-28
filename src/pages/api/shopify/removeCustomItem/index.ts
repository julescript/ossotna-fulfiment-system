// pages/api/shopify/addCustomItem.js
import axios from "axios";
import config from "@/config/config";
import { convertToGid } from "@/utils/orderUtils";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, lineItemId } = req.body;

  if (!orderId || !lineItemId) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const orderGID = convertToGid("Order", orderId);
    const lineItemGID = convertToGid("LineItem", lineItemId); // Ensure correct type

    // 1. Begin Edit Session
    const beginEditMutation = `
      mutation orderEditBegin($id: ID!) {
        orderEditBegin(id: $id) {
          calculatedOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const beginEditResponse = await axios.post(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        query: beginEditMutation,
        variables: { id: orderGID },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
      }
    );

    const { data: beginData } = beginEditResponse;
    if (beginData.errors || beginData.data.orderEditBegin.userErrors.length > 0) {
      throw new Error(beginData.errors?.[0]?.message || beginData.data.orderEditBegin.userErrors[0].message);
    }

    const calculatedOrderId = beginData.data.orderEditBegin.calculatedOrder.id;

    // 2. Remove Line Item
    const removeLineItemMutation = `
      mutation orderEditRemoveLineItem($id: ID!, $lineItemId: ID!) {
        orderEditRemoveLineItem(id: $id, lineItemId: $lineItemId) {
          calculatedOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const removeLineItemResponse = await axios.post(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        query: removeLineItemMutation,
        variables: {
          id: calculatedOrderId,
          lineItemId: lineItemGID,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
      }
    );

    const { data: removeData } = removeLineItemResponse;
    if (removeData.errors || removeData.data.orderEditRemoveLineItem.userErrors.length > 0) {
      throw new Error(removeData.errors?.[0]?.message || removeData.data.orderEditRemoveLineItem.userErrors[0].message);
    }

    // 3. Commit Edit Session
    const commitEditMutation = `
      mutation orderEditCommit($id: ID!) {
        orderEditCommit(id: $id) {
          order {
            id
            lineItems(first: 250) {
              edges {
                node {
                  id
                  title
                  price
                  customAttributes {
                    key
                    value
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const commitEditResponse = await axios.post(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        query: commitEditMutation,
        variables: { id: calculatedOrderId },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
      }
    );

    const { data: commitData } = commitEditResponse;
    if (commitData.errors || commitData.data.orderEditCommit.userErrors.length > 0) {
      throw new Error(commitData.errors?.[0]?.message || commitData.data.orderEditCommit.userErrors[0].message);
    }

    return res.status(200).json({ success: true, order: commitData.data.orderEditCommit.order });
  } catch (error) {
    console.error("Remove Custom Item Error:", error.response?.data || error.message);
    return res.status(500).json({ error: error.message || "Failed to remove custom item." });
  }
}