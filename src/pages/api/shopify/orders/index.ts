import type { NextApiRequest, NextApiResponse } from 'next';
import config from '@/config/config';

/* /api/shopify/orders
  accepts
    - GET request with an optional `sku` query param. It returns a list of orders.
*/
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method !== 'GET') {
    return res.status(404).json('route not found');
  }

  const result = await (
    await fetch(`${config.shopify.adminApiEndpoint}/orders.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.shopify.accessToken,
      },
    })
  ).json();

  let orders: { [key: string]: any; line_items: { sku: string }[] }[] =
    result.orders;

  if (req.query.sku) {
    orders = orders.filter((order) =>
      order.line_items.some((item) => item.sku === req.query.sku)
    );
  }
  res.status(200).json(orders);
}
