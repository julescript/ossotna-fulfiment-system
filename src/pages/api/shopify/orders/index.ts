import type { NextApiRequest, NextApiResponse } from "next";
import config from "@/config/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(404).json("Route not found");
  }

  const { sku, limit = 50 } = req.query;

  try {
    // --- GraphQL Query: Request the fields needed for the frontend ---
    const query = `
    {
  orders(first: ${limit}, sortKey: CREATED_AT, reverse: true, query: "status:open") {
        edges {
          node {
            id
            name
            createdAt
            updatedAt
            processedAt
            email
            phone
            currencyCode
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  variant {
                    id
                    sku
                    price
                    title
                  }
                  customAttributes {
                    key
                    value
                  }
                }
              }
            }
            shippingAddress {
              firstName
              lastName
              address1
              address2
              city
              province
              zip
              country
              phone
            }
            shippingLines(first: 10) {
              edges {
                node {
                  id
                  code
                  price
                  title
                }
              }
            }
            metafields(first: 50) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                }
              }
            }
            customer {
              firstName
              lastName
            }
          }
        }
      }
    }
    `;

    const response = await fetch(
      `${config.shopify.adminApiEndpoint}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.shopify.accessToken,
        },
        body: JSON.stringify({ query }),
      }
    );

    const result = await response.json();

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return res.status(500).json({ error: "GraphQL errors", details: result.errors });
    }

    let orders = result.data.orders.edges.map(({ node }) => {
      // Convert the global ID (e.g. "gid://shopify/Order/4403849986097") to the numeric order ID.
      node.id = node.id.split('/').pop();
    
      // Flatten metafields
      node.metafields = node.metafields.edges.map(({ node }) => node);
    
      // Transform line items:
      node.line_items = node.lineItems.edges.map(({ node: li }) => ({
        id: li.id,
        title: li.title,
        quantity: li.quantity,
        variant: li.variant,
        // Transform customAttributes from { key, value } to { name, value }
        properties: li.customAttributes.map(attr => ({
          name: attr.key,
          value: attr.value
        })),
        // Add a variant_title field for convenience
        variant_title: li.variant ? li.variant.title : ""
      }));
      delete node.lineItems;
    
      // Transform shipping lines similarly
      node.shipping_lines = node.shippingLines.edges.map(({ node: sl }) => sl);
      delete node.shippingLines;
    
      // Transform shippingAddress to shipping_address with snake_case keys.
      if (node.shippingAddress) {
        node.shipping_address = {
          first_name: node.shippingAddress.firstName,
          last_name: node.shippingAddress.lastName,
          address1: node.shippingAddress.address1,
          address2: node.shippingAddress.address2,
          city: node.shippingAddress.city,
          province: node.shippingAddress.province,
          zip: node.shippingAddress.zip,
          country: node.shippingAddress.country,
          phone: node.shippingAddress.phone
        };
      } else if (node.customer) {
        node.shipping_address = {
          first_name: node.customer.firstName,
          last_name: node.customer.lastName
        };
      } else {
        node.shipping_address = null;
      }
      delete node.shippingAddress;
    
      return node;
    });

    // Filter orders by SKU if provided
    if (sku) {
      orders = orders.filter(order =>
        order.line_items.some(item => item.variant && item.variant.sku === sku)
      );
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching Shopify orders:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
}