// pages/api/shopify/addCustomItem.js
import axios from "axios";
import config from "@/config/config";
import { convertToGid } from "@/utils/orderUtils";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, customItem } = req.body;

  if (!orderId || !customItem || !customItem.title || !customItem.price) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const orderGID = convertToGid("Order", orderId);

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

    // 2. Add Custom Line Item
    const addCustomItemMutation = `
      mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!, $quantity: Int!) {
        orderEditAddCustomItem(id: $id, title: $title, price: $price, quantity: $quantity, requiresShipping: false, taxable: false) {
          calculatedLineItem {
            id
          }
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

    const addCustomItemResponse = await axios.post(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        query: addCustomItemMutation,
        variables: {
          id: calculatedOrderId,
          title: customItem.title,
          price: {
            amount: customItem.price,
            currencyCode: customItem.currencyCode || "USD",
          },
          quantity: 1,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
      }
    );

    const { data: addData } = addCustomItemResponse;
    if (addData.errors || addData.data.orderEditAddCustomItem.userErrors.length > 0) {
      throw new Error(addData.errors?.[0]?.message || addData.data.orderEditAddCustomItem.userErrors[0].message);
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
    console.error("Add Custom Item Error:", error.response?.data || error.message);
    return res.status(500).json({ error: error.message || "Failed to add custom item." });
  }
}