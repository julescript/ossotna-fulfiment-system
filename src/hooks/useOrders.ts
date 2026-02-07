// hooks/useOrders.js
import { useState, useEffect } from "react";
import { fetchOrdersAPI } from "../services/orderService";

export function useOrders(apiEndpoint = "api/shopify/orders") {
  const [orders, setOrders] = useState([]);
  const [limit, setLimit] = useState(100); // default limit
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async (limitValue) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${apiEndpoint}?limit=${limitValue}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
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
   if ("NDEFReader" in window) {
     setIsNFCSupported(true);
   } else {
     setIsNFCSupported(false);
   }
 }, []);

 return isNFCSupported;
};