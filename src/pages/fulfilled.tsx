import OrdersPage from './orders';

const FulfilledOrdersPage = () => {
  return <OrdersPage apiEndpoint="api/shopify/orders/fulfilled" />;
};

export default FulfilledOrdersPage;
