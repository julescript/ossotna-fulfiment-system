// pages/orders.js
import React, { useEffect, useState } from 'react';
import OrdersTable from '../components/orders-table.component';

const Orders = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch('api/shopify/orders/')
      .then((res) => res.json())
      .then((res) => {
        setOrders(res);
      });
  }, []);

  return (
    <div className='container mx-auto'>
      <h1 className='text-2xl font-bold my-8'>Shopify Orders</h1>
      <OrdersTable orders={orders} />
    </div>
  );
};

export default Orders;
