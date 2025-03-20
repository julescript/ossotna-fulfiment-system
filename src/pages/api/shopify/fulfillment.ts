import type { NextApiRequest, NextApiResponse } from 'next';
import config from '@/config/config';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

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

    // Now update the order's financial status to paid
    const updateOrderMutation = `
      mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          order {
            id
            displayFinancialStatus
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateOrderVariables = {
      input: {
        id: `gid://shopify/Order/${orderId}`
      }
    };

    const updateOrderResponse = await fetch(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
        body: JSON.stringify({ 
          query: updateOrderMutation,
          variables: updateOrderVariables
        }),
      }
    );

    if (!updateOrderResponse.ok) {
      console.error(`Order update failed with status: ${updateOrderResponse.status}`);
      console.error(`Response text: ${await updateOrderResponse.text()}`);
      // We still return success since the fulfillment was created
      return res.status(200).json({
        success: true,
        fulfillment: fulfillmentData.data.fulfillmentCreateV2.fulfillment,
        warning: "Order was fulfilled but could not be marked as paid"
      });
    }

    const updateOrderData = await updateOrderResponse.json();

    if (updateOrderData.errors || 
        (updateOrderData.data && 
         updateOrderData.data.orderMarkAsPaid && 
         updateOrderData.data.orderMarkAsPaid.userErrors && 
         updateOrderData.data.orderMarkAsPaid.userErrors.length > 0)) {
      console.error("Error marking order as paid:", 
        updateOrderData.errors || 
        updateOrderData.data.orderMarkAsPaid.userErrors);
      // We still return success since the fulfillment was created
      return res.status(200).json({
        success: true,
        fulfillment: fulfillmentData.data.fulfillmentCreateV2.fulfillment,
        warning: "Order was fulfilled but could not be marked as paid",
        details: updateOrderData.errors || updateOrderData.data.orderMarkAsPaid.userErrors
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order marked as fulfilled and paid',
      fulfillment: fulfillmentData.data.fulfillmentCreateV2.fulfillment,
      orderUpdate: updateOrderData.data.orderMarkAsPaid.order
    });
  } catch (error) {
    console.error('Error in fulfillment API:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
