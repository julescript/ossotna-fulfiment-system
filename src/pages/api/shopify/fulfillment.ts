import type { NextApiRequest, NextApiResponse } from 'next';
import config from '@/config/config';

async function shopifyGraphQL(query: string, variables?: any) {
  const body: any = { query };
  if (variables) body.variables = variables;

  const response = await fetch(
    `${config.shopify.adminApiEndpoint}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.shopify.accessToken,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${text}`);
  }

  return response.json();
}

// ACTION: fulfill - Creates a Shopify fulfillment (no customer notification, no tracking)
async function handleFulfill(orderId: string, res: NextApiResponse) {
  // Get fulfillment orders
  const orderData = await shopifyGraphQL(`
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
  `);

  if (orderData.errors) {
    return res.status(500).json({ error: "Failed to fetch fulfillment orders", details: orderData.errors });
  }

  const fulfillmentOrders = orderData.data.order.fulfillmentOrders.edges.map((edge: any) => edge.node);

  if (fulfillmentOrders.length === 0) {
    return res.status(400).json({ error: "No fulfillment orders found for this order" });
  }

  const openFulfillmentOrder = fulfillmentOrders.find((fo: any) => fo.status === "OPEN");

  if (!openFulfillmentOrder) {
    // Already fulfilled - return success
    return res.status(200).json({
      success: true,
      message: 'Order is already fulfilled',
      fulfillmentOrders
    });
  }

  // Create fulfillment - NO customer notification, NO tracking
  const fulfillmentData = await shopifyGraphQL(`
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
  `, {
    fulfillment: {
      lineItemsByFulfillmentOrder: {
        fulfillmentOrderId: openFulfillmentOrder.id
      },
      notifyCustomer: false
    }
  });

  if (fulfillmentData.errors ||
      fulfillmentData.data?.fulfillmentCreateV2?.userErrors?.length > 0) {
    const errors = fulfillmentData.errors || fulfillmentData.data.fulfillmentCreateV2.userErrors;
    console.error("Error creating fulfillment:", errors);
    return res.status(500).json({ error: "Failed to create fulfillment", details: errors });
  }

  console.log(`Order ${orderId} fulfilled successfully (no notification sent)`);
  return res.status(200).json({
    success: true,
    message: 'Order marked as fulfilled',
    fulfillment: fulfillmentData.data.fulfillmentCreateV2.fulfillment
  });
}

// ACTION: markPaid - Only marks the order as paid
async function handleMarkPaid(orderId: string, res: NextApiResponse) {
  // Check if already paid
  const statusData = await shopifyGraphQL(`
    {
      order(id: "gid://shopify/Order/${orderId}") {
        id
        displayFinancialStatus
      }
    }
  `);

  if (!statusData.errors && statusData.data?.order?.displayFinancialStatus === "PAID") {
    console.log(`Order ${orderId} is already paid.`);
    return res.status(200).json({
      success: true,
      message: 'Order is already paid'
    });
  }

  // Mark as paid
  const paidData = await shopifyGraphQL(`
    mutation {
      orderMarkAsPaid(input: {id: "gid://shopify/Order/${orderId}"}) {
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
  `);

  console.log('Mark as paid response:', JSON.stringify(paidData, null, 2));

  if (paidData.errors || paidData.data?.orderMarkAsPaid?.userErrors?.length > 0) {
    const errors = paidData.errors || paidData.data.orderMarkAsPaid.userErrors;
    const alreadyPaid = errors.some((e: any) => e.message?.includes("already paid"));

    if (alreadyPaid) {
      return res.status(200).json({ success: true, message: 'Order is already paid' });
    }

    console.error("Error marking order as paid:", errors);
    return res.status(500).json({ error: "Failed to mark order as paid", details: errors });
  }

  return res.status(200).json({
    success: true,
    message: 'Order marked as paid',
    order: paidData.data.orderMarkAsPaid.order
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, action = 'fulfill' } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    console.log(`Fulfillment API called: action=${action}, orderId=${orderId}`);

    if (action === 'markPaid') {
      return await handleMarkPaid(orderId, res);
    }

    // Default: fulfill
    return await handleFulfill(orderId, res);

  } catch (error) {
    console.error('Error in fulfillment API:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
