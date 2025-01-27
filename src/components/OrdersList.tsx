// In your OrdersList.tsx component
import React, { useEffect } from 'react';

const OrdersList: React.FC = () => {
    useEffect(() => {
        fetch('/api/shopify/orders')
            .then(response => response.text())  // Fetch and convert the response to text
            .then(text => {
                console.log('Raw response:', text);  // Log the raw response text
            })
            .catch(error => {
                console.error('Fetch error:', error);
            });
    }, []);

    return <p>Loading...</p>;
};

export default OrdersList;
