// hooks/useOrders.js
import { useState, useEffect } from "react";
import { fetchOrdersAPI } from "../services/orderService";

export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [limit, setLimit] = useState(25); // default limit
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async (limitValue) => {
    try {
      setIsLoading(true);
      const data = await fetchOrdersAPI(limitValue);
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount / whenever limit changes
  useEffect(() => {
    fetchOrders(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return {
    orders,
    limit,
    setLimit,
    isLoading,
    fetchOrders, // in case you want to refresh manually
  };
}

export const useIsNFCSupported = () => {
 const [isNFCSupported, setIsNFCSupported] = useState(false);

 useEffect(() => {
   if ("NDEFWriter" in window) {
     setIsNFCSupported(true);
   } else {
     setIsNFCSupported(false);
   }
 }, []);

 return isNFCSupported;
};