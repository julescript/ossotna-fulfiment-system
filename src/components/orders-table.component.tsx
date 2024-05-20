const OrdersTable = ({ orders }) => {
  return (
    <div className='max-w-full overflow-x-auto my-8'>
      <div className='min-w-[1920px] border border-gray-300 rounded-md overflow-hidden'>
        <div className='flex bg-gray-200 border-b border-gray-300'>
          <div className='w-[8.33%] p-4 font-bold text-gray-700'>Order ID</div>
          <div className='w-[8.33%] p-4 font-bold text-gray-700'>
            Order Name
          </div>
          <div className='w-[16.67%] p-4 font-bold text-gray-700'>Email</div>
          <div className='w-[8.33%] p-4 font-bold text-gray-700'>Phone</div>
          <div className='w-[16.67%] p-4 font-bold text-gray-700'>
            Customer Name
          </div>
          <div className='w-[16.67%] p-4 font-bold text-gray-700'>
            Shipping Address
          </div>
          <div className='w-[16.67%] p-4 font-bold text-gray-700'>
            Product Properties
          </div>
          <div className='w-[8.33%] p-4 font-bold text-gray-700'>Actions</div>
        </div>
        {orders.map((order) => (
          <div key={order.id} className='flex border-b border-gray-200'>
            <div className='w-[8.33%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.id}
            </div>
            <div className='w-[8.33%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.name}
            </div>
            <div className='w-[16.67%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.email}
            </div>
            <div className='w-[8.33%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.shipping_address.phone || 'N/A'}
            </div>
            <div className='w-[16.67%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.shipping_address.first_name}{' '}
              {order.shipping_address.last_name}
            </div>
            <div className='w-[16.67%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.shipping_address.address1}, {order.shipping_address.city},{' '}
              {order.shipping_address.country}
            </div>
            <div className='w-[16.67%] p-4 border-r border-gray-200 whitespace-normal'>
              {order.line_items[0].properties.map((prop) => (
                <div key={prop.name}>
                  {prop.name}: {prop.value}
                </div>
              ))}
            </div>
            <div className='w-[8.33%] p-4'>
              <button className='px-4 py-2 bg-blue-500 text-white rounded'>
                Fulfill Order
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrdersTable;
