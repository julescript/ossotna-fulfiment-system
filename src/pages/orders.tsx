import React, { useEffect, useState, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from 'next/dynamic'; // Import dynamic from Next.js
import ImageUploadModal from '../components/ImageUploadModal';
import OrdersTable from '../components/OrdersTable';
import LogoutButton from '../components/LogoutButton';
import VersionDisplay from '../components/VersionDisplay';
// Dynamically import QR Scanner components
const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), { ssr: false });
// Custom hook for fetching orders:
import { useOrders } from "../hooks/useOrders";

// Utility functions:
import { getDefaultSubdomain, getOrderURL, processQrCodeSvg } from "../utils/orderUtils";
import { formatLebanesePhoneNumber, formatPhoneForWhatsApp, getWhatsAppUrl } from '../utils/whatsapp';

// Service functions:
import {
  saveSubdomainAPI,
  generateQRCodeAPI,
  processAndUploadImagesAPI,
  downloadImagesAsZipAPI,
  saveMetafieldAPI,
  markOrderReadyForDeliveryAPI,
} from "../services/orderService";
import TwoFramesPreview, { OnePDFWithTwoFramesRef } from "@/components/CardsPreview";
import Image from "next/image";

const OrdersPage = ({ apiEndpoint }: { apiEndpoint?: string }) => {
  // 1) State + custom hook usage
  const { orders, limit, setLimit, isLoading, fetchOrders } = useOrders(apiEndpoint);
  // Add this alongside your existing useState declarations
  const [isSubdomainCheckOpen, setIsSubdomainCheckOpen] = useState(false);

  // Ref for the TwoFramesPreview component
  const cardPreviewRef = useRef<OnePDFWithTwoFramesRef>(null);

  // For subdomain inputs
  const [subdomains, setSubdomains] = useState({});
  // Add these state variables alongside your existing states
  const [dedicationLines, setDedicationLines] = useState({});
  const [storyTitles, setStoryTitles] = useState({});
  const [milestoneDates, setMilestoneDates] = useState({});
  const [generatedQRCodes, setGeneratedQRCodes] = useState({});

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  // Using new QR scanner that handles all QR code types automatically

  // For toggling row expansions
  const [toggledRows, setToggledRows] = useState({});

  // For tracking loading states on a per-order basis
  const [loadingOrders, setLoadingOrders] = useState({});
  const [loadingOrders2, setLoadingOrders2] = useState({});

  // Track per-order progress for uploading
  const [uploadProgress, setUploadProgress] = useState({});
  // Track per-order progress for downloading
  const [downloadProgress, setDownloadProgress] = useState({});

  // Right after other useState definitions:
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("details"); // "details" | "story" | "images"
  const [clipboardContent, setClipboardContent] = useState("");
  const [generatedStory, setGeneratedStory] = useState("");
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isNfcWriteModalOpen, setIsNfcWriteModalOpen] = useState(false);
  const [nfcUrl, setNfcUrl] = useState("");
  // NFC step: "idle" | "writing" | "waitingVerify" | "verifying" | "done"
  const [nfcStep, setNfcStep] = useState<"idle" | "writing" | "waitingVerify" | "verifying" | "done">("idle");
  const [nfcWriteAttempts, setNfcWriteAttempts] = useState(0);
  const [showFulfillConfirmation, setShowFulfillConfirmation] = useState(false);
  const [orderToFulfill, setOrderToFulfill] = useState(null);
  const [lastReadUrl, setLastReadUrl] = useState("");
  const [nfcVerifyMatch, setNfcVerifyMatch] = useState<boolean | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const nfcUrlRef = useRef(nfcUrl);
  // Keep nfcUrlRef in sync
  useEffect(() => { nfcUrlRef.current = nfcUrl; }, [nfcUrl]);
  // Cleanup NFC on unmount
  useEffect(() => {
    return () => {
      nfcAbortRef.current?.abort();
      nfcAbortRef.current = null;
    };
  }, []);
  const [isDeliveryScanOpen, setIsDeliveryScanOpen] = useState(false);
  const [isSentForDeliveryScanOpen, setIsSentForDeliveryScanOpen] = useState(false);
  const [showDeliveryProviderSelect, setShowDeliveryProviderSelect] = useState(false);
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] = useState<string | null>(null);
  const [currentScanOrder, setCurrentScanOrder] = useState(null);
  const [scanStatus, setScanStatus] = useState("ready"); // ready, loading, success, error
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [tableFilter, setTableFilter] = useState<"all" | "new" | "edits" | "printing" | "ready" | "delivery" | "sent">(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'delivery') return 'delivery';
    return 'all';
  });

  // Statuses (new)
  const [storyStages, setStoryStages] = useState({});
  const [printablesStatuses, setPrintablesStatuses] = useState({});
  const [fulfillmentStatuses, setFulfillmentStatuses] = useState({});

  const printablesStatusOptions = ["Pending", "Review", "Printing", "Ready"];
  const storyStageOptions = ["Pending", "Waiting", "Review", "Live"];
  const fulfillmentStatusOptions = ["New Order", "Ready For Delivery", "Sent For Delivery", "Delivered"];

  // Listen for sidebar action events
  // Keep selectedOrder in sync with latest orders data (e.g. after fetchOrders)
  useEffect(() => {
    if (selectedOrder && orders.length > 0) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && updated !== selectedOrder) {
        setSelectedOrder(updated);
      }
    }
  }, [orders]);

  useEffect(() => {
    const handleScanOrder = () => setIsCameraOpen(true);
    const handleUploadImages = () => setIsImageUploadModalOpen(true);
    window.addEventListener('sidebar:scan-order', handleScanOrder);
    window.addEventListener('sidebar:upload-images', handleUploadImages);
    return () => {
      window.removeEventListener('sidebar:scan-order', handleScanOrder);
      window.removeEventListener('sidebar:upload-images', handleUploadImages);
    };
  }, []);

  const getMetafieldValue = (order, key) => {
    return order.metafields?.find((mf) => mf.namespace === "custom" && mf.key === key)?.value;
  };

  const mapLegacyStatusToNew = (legacyStatus) => {
    const legacy = (legacyStatus || "").trim();

    // Fulfillment
    const fulfillment = legacy === "Ready for Delivery" ? "Ready For Delivery" : "New Order";

    // Story
    let story = "Pending";
    if (legacy === "Waiting Story") story = "Waiting";
    if (legacy === "Story Draft") story = "Review";
    if (legacy === "QA Review") story = "Review";
    if (["Story Live", "Story Approved", "Printables Ready", "Sent for Printing", "Packaging", "Ready for Delivery"].includes(legacy)) {
      story = "Live";
    }

    // Printables
    let printables = "Pending";
    if (legacy === "Printables Ready") printables = "Ready";
    if (legacy === "Sent for Printing") printables = "Printing";
    if (["Packaging", "QA Review", "Ready for Delivery"].includes(legacy)) printables = "Ready";

    return { story, printables, fulfillment };
  };

  const getStatusSelectClassName = (value) => {
    const v = (value || "").toString().toLowerCase();

    if (v.includes("draft") || v.includes("review")) {
      return "border-yellow-500 text-yellow-200 dark:bg-yellow-900";
    }

    if (v.includes("ready") || v.includes("live")) {
      return "border-green-500 text-green-200 dark:bg-green-900";
    }

    return "border-gray-500 text-gray-200 dark:bg-gray-700";
  };

  const getPrintablesStatusSelectClassName = (value) => {
    const v = (value || "").toString().toLowerCase();

    if (v.includes("draft") || v.includes("review")) {
      return "border-yellow-500 text-yellow-200 dark:bg-yellow-900";
    }

    if (v.includes("printing")) {
      return "border-green-500 text-green-200 dark:bg-green-900";
    }

    if (v === "ready" || v.includes("ready")) {
      return "border-sky-500 text-sky-200 dark:bg-sky-900";
    }

    return "border-gray-500 text-gray-200 dark:bg-gray-700";
  };

  const getRowBackgroundClass = (order) => {
    const story = storyStages[order.id] || "Pending";
    const printables = printablesStatuses[order.id] || "Pending";
    const fulfillment = fulfillmentStatuses[order.id] || "New Order";

    if (story === "Waiting") return "bg-red-900";
    if (fulfillment === "Ready For Delivery") return "bg-green-900";
    if (fulfillment === "Sent For Delivery") return "bg-sky-200 dark:bg-sky-900";
    if (story === "Pending" && printables === "Pending" && fulfillment === "New Order") return "bg-gray-100 dark:bg-gray-700";
    return "";
  };

  const subdomainValue = (order) => {
    return subdomains[order.id] || "";
  }

  const handleOpenModal = (order) => {
    // Abort any in-progress NFC operations from previous order
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setNfcStep("idle");
    setNfcWriteAttempts(0);
    setLastReadUrl("");
    setNfcVerifyMatch(null);
    setIsNfcWriteModalOpen(false);
    setIsSubdomainCheckOpen(false);

    setSelectedOrder(order);
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
    setActiveModalTab(userRole === 'delivery' ? "delivery" : "details");
    setClipboardContent("");
    setGeneratedStory("");
    setIsModalOpen(true);
  };

  // Handle sending preview link
  const handleSendPreviewLink = (order) => {
    if (!order) return;

    try {
      const phoneNumber = getPhoneNumber(order);
      if (!phoneNumber) {
        toast.error('No phone number available for this order');
        return;
      }

      // Format the phone number for WhatsApp
      const cleanPhone = formatPhoneForWhatsApp(phoneNumber);

      // Get the story URL from metafields
      const storyUrl = order.metafields?.find(
        (mf) => mf.namespace === "custom" && mf.key === "story-url"
      )?.value;

      // Get the password if it exists
      const passwordProperty = order.line_items[0].properties.find(
        (prop) => prop.name === "password"
      );

      // If no story URL is available
      if (!storyUrl) {
        toast.error('No story URL available for this order');
        return;
      }

      // Create the preview message
      const previewMessage = `Hello ${order?.shipping_address?.first_name}, Please find below the first draft of your story. Feel free to point out any edits you'd like us to make.\n\nhttps://${storyUrl}.ossotna.com/\n${passwordProperty
        ? `password: ${passwordProperty.value}`
        : ""
        }\n\nHope you like it as much as we do!`;

      // Generate WhatsApp URL based on device
      const whatsappUrl = getWhatsAppUrl(cleanPhone, previewMessage);

      // Open WhatsApp link in a new tab
      window.open(whatsappUrl, '_blank');
      toast.success('Preview link sent via WhatsApp');
    } catch (error) {
      console.error('Error sending preview link:', error);
      toast.error(`Error: ${error.message || 'Unknown error sending preview link to client'}`);
    }
  };

  // Handle sending delivery message
  const handleSendDeliveryMessage = async (order) => {
    if (!order) return;

    try {
      const phoneNumber = getPhoneNumber(order);
      if (!phoneNumber) {
        toast.error('No phone number available for this order');
        return;
      }

      // Format the phone number for WhatsApp
      const cleanPhone = formatPhoneForWhatsApp(phoneNumber);

      // Get customer name
      const customerName = order?.shipping_address?.first_name || '';
      
      // Get the currency and total price using the same approach as in the fulfill order modal
      const currencyCode = order.currencyCode || 'USD';
      const totalAmount = order.totalPriceSet?.shopMoney?.amount || order.total_price || '75.00';
      
      // Create delivery message text with customer name and total amount
      const messageText = `📦 Hello ${customerName}, we're delivering your Ossotna order ${order.name || ''}. Please share your location and have the exact amount of ${currencyCode} ${totalAmount} prepared as we cannot guarantee change. Thank you!`

      // Generate WhatsApp URL based on device
      const whatsappUrl = getWhatsAppUrl(cleanPhone, messageText);

      // Open WhatsApp link in a new tab
      window.open(whatsappUrl, '_blank');
      toast.success('WhatsApp message ready to send');
    } catch (error) {
      console.error('Error sending delivery message:', error);
      toast.error(`Error: ${error.message || 'Unknown error sending delivery message'}`);
    }
  };

  // Show confirmation before marking as delivered
  const handleMarkDelivered = (order) => {
    if (!order) return;
    setOrderToFulfill(order);
    setShowFulfillConfirmation(true);
  };

  // Mark order as delivered: fulfill in Shopify + mark as paid + update status + add tag
  const confirmFulfillOrder = async () => {
    if (!orderToFulfill) return;

    try {
      setIsFulfilling(true);
      setShowFulfillConfirmation(false);

      // 1) Fulfill the order in Shopify (no customer notification)
      try {
        const fulfillRes = await fetch('/api/shopify/fulfillment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderToFulfill.id, action: 'fulfill' }),
        });
        const fulfillData = await fulfillRes.json();
        if (fulfillData.success) {
          console.log('Order fulfilled in Shopify');
        } else {
          console.warn('Shopify fulfillment warning:', fulfillData.error);
        }
      } catch (err) {
        console.error('Error fulfilling order in Shopify:', err);
      }

      // 2) Mark as paid in Shopify
      try {
        const paidRes = await fetch('/api/shopify/fulfillment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderToFulfill.id, action: 'markPaid' }),
        });
        const paidData = await paidRes.json();
        if (paidData.success) {
          console.log('Order marked as paid in Shopify');
        } else {
          console.warn('Shopify mark paid warning:', paidData.error);
        }
      } catch (err) {
        console.error('Error marking order as paid in Shopify:', err);
      }

      // 3) Remove stale delivery tags, then add DELIVERED tag in Shopify
      try {
        await fetch('/api/shopify/removeTag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderToFulfill.id, tags: ['READY FOR DELIVERY', 'SENT FOR DELIVERY'] }),
        });
        await fetch('/api/shopify/addTag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderToFulfill.id, tag: 'DELIVERED' }),
        });
      } catch (err) {
        console.error('Error syncing DELIVERED tag:', err);
      }

      // 4) Update local fulfillment status to "Delivered"
      setFulfillmentStatuses((prev) => ({ ...prev, [orderToFulfill.id]: "Delivered" }));
      await saveMetafieldAPI(orderToFulfill.id, "fulfillment-status", "single_line_text_field", "Delivered");

      toast.success('Order marked as delivered, fulfilled & paid!');
      fetchOrders(limit);
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast.error('Error marking order as delivered');
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setIsModalOpen(false);
  };

  // 2) Populate initial subdomains each time orders change
  useEffect(() => {
    // If no orders exist, do nothing.
    if (!orders || orders.length === 0) return;

    // We use JSON.stringify(orders) as the dependency so that changes
    // in the orders’ content (even if length stays the same) will trigger this effect.
    // (Note: For production code, consider using a deep comparison hook instead.)
    console.log("orders", orders)
    // Initialize new statuses from new metafields; if missing, map from legacy `custom.story-status`.
    setFulfillmentStatuses((prev) => {
      let updated = false;
      const next = { ...prev };
      orders.forEach((order) => {
        const explicit = getMetafieldValue(order, "fulfillment-status");
        const legacy = getMetafieldValue(order, "story-status");
        const mapped = mapLegacyStatusToNew(legacy);
        const value = explicit || mapped.fulfillment;
        if (next[order.id] !== value) {
          next[order.id] = value;
          updated = true;
        }
      });
      return updated ? next : prev;
    });

    setStoryStages((prev) => {
      let updated = false;
      const next = { ...prev };
      orders.forEach((order) => {
        const explicit = getMetafieldValue(order, "story-stage");
        const legacy = getMetafieldValue(order, "story-status");
        const mapped = mapLegacyStatusToNew(legacy);
        const value = explicit || mapped.story;
        if (next[order.id] !== value) {
          next[order.id] = value;
          updated = true;
        }
      });
      return updated ? next : prev;
    });

    setPrintablesStatuses((prev) => {
      let updated = false;
      const next = { ...prev };
      orders.forEach((order) => {
        const explicit = getMetafieldValue(order, "printables-status");
        const legacy = getMetafieldValue(order, "story-status");
        const mapped = mapLegacyStatusToNew(legacy);
        const value = explicit || mapped.printables;
        if (next[order.id] !== value) {
          next[order.id] = value;
          updated = true;
        }
      });
      return updated ? next : prev;
    });

    // Update subdomains.
    setSubdomains(prev => {
      let updated = false;
      const newSubs = { ...prev };
      orders.forEach(order => {
        const defaultSub = getDefaultSubdomain(order);
        if (newSubs[order.id] !== defaultSub) {
          newSubs[order.id] = defaultSub;
          updated = true;
        }
      });
      return updated ? newSubs : prev;
    });

    // Update dedication lines.
    setDedicationLines(prev => {
      let updated = false;
      const newDedications = { ...prev };
      orders.forEach(order => {
        if (order.metafields && order.metafields.length > 0) {
          const dedicationMetafield = order.metafields.find(
            mf => mf.namespace === "custom" && mf.key === "story-dedication"
          );
          const newDed = dedicationMetafield?.value || "";
          if (newDedications[order.id] !== newDed) {
            newDedications[order.id] = newDed;
            updated = true;
          }
        }
      });
      return updated ? newDedications : prev;
    });

    // Update story titles.
    setStoryTitles(prev => {
      let updated = false;
      const newTitles = { ...prev };
      orders.forEach(order => {
        if (order.metafields && order.metafields.length > 0) {
          const titleMetafield = order.metafields.find(
            mf => mf.namespace === "custom" && mf.key === "story-title"
          );
          const newTitle = titleMetafield?.value || "";
          if (newTitles[order.id] !== newTitle) {
            newTitles[order.id] = newTitle;
            updated = true;
          }
        }
      });
      return updated ? newTitles : prev;
    });

    // Update milestone dates.
    setMilestoneDates(prev => {
      let updated = false;
      const newMilestones = { ...prev };
      orders.forEach(order => {
        if (order.metafields && order.metafields.length > 0) {
          const milestoneMetafield = order.metafields.find(
            mf => mf.namespace === "custom" && mf.key === "story-date"
          );
          const newMilestone = milestoneMetafield?.value || "";
          if (newMilestones[order.id] !== newMilestone) {
            newMilestones[order.id] = newMilestone;
            updated = true;
          }
        }
      });
      return updated ? newMilestones : prev;
    });

    // We list JSON.stringify(orders) as the dependency so that any change in the orders' content (e.g., metafields loading)
    // will trigger this effect.
  }, [JSON.stringify(orders)]);

  useEffect(() => {
    if (isModalOpen) {
      // Prevent background scrolling
      document.body.style.overflow = "hidden";
    } else {
      // Allow scrolling again
      document.body.style.overflow = "";
    }
  }, [isModalOpen]);

  useEffect(() => {
    console.log(selectedOrder ? selectedOrder : "no");
  }, [selectedOrder]);

  // 3) Handlers

  // Toggle row to show/hide full properties
  const handleRowClick = (orderId) => {
    setToggledRows((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Save a subdomain to the metafield
  const handleSaveSubdomain = async (orderId, subdomain) => {
    try {
      await saveSubdomainAPI(orderId, subdomain);
      toast.success("Subdomain saved successfully!", { autoClose: 2000 });
      // Refresh orders to load the updated metafield
      fetchOrders(limit);
    } catch (error) {
      console.error("Error saving subdomain:", error);
      toast.error("Failed to save subdomain!", { autoClose: 2000 });
    }
  };

  const handleScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0) {
      try {
        const data = detectedCodes[0].rawValue;
        console.log(data);
        // Assuming the QR code contains a Shopify order URL like https://yourstore.com/orders/{orderId}
        const url = new URL(data);
        const pathSegments = url.pathname.split('/');
        console.log(pathSegments);
        const orderId = pathSegments[pathSegments.length - 1]; // Extract the last segment as orderId
        console.log(orderId);
        // Find the order with the extracted orderId
        const order = orders.find(o => o.id === String(orderId) || o.name === String(orderId)); // Adjust based on how orderId is stored
        console.log(orders);
        if (order) {
          handleOpenModal(order);
          setIsCameraOpen(false); // Close the camera after successful scan
        } else {
          toast.error("Order not found", { autoClose: 2000 });
        }
      } catch (error) {
        console.error("Error processing QR code:", error);
        toast.error("Invalid QR code format", { autoClose: 2000 });
      }
    }
  };

  const handleError = (err) => {
    console.error(err);
    toast.error("Failed to access camera", { autoClose: 2000 });
  };



  // Generate and download a QR code (SVG)
  const createQR = async (subdomain) => {
    try {
      // Fetch the raw SVG data from the API
      const rawSvg = await generateQRCodeAPI(subdomain);

      // Process the SVG to remove unwanted elements and ensure scalability
      const cleanedSvg = processQrCodeSvg(rawSvg);

      if (!cleanedSvg) {
        throw new Error("Processed SVG is empty.");
      }
      return cleanedSvg;
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code!", { autoClose: 2000 });
    }
  };

  useEffect(() => {
    const generateQRCodes = async () => {
      if (!selectedOrder) return;
      const subdomain = subdomains[selectedOrder.id];
      if (!subdomain) return;

      try {
        const rawSvg = await generateQRCodeAPI(subdomain);
        const cleanedSvg = processQrCodeSvg(rawSvg);

        if (!cleanedSvg) {
          throw new Error("Processed SVG is empty.");
        }

        setGeneratedQRCodes((prev) => ({
          ...prev,
          [selectedOrder.id]: cleanedSvg,
        }));
      } catch (error) {
        console.error("Error generating QR code:", error);
        toast.error("Failed to generate QR code!", { autoClose: 2000 });
        // Optionally, you can set a default SVG or remove the entry
        setGeneratedQRCodes((prev) => ({
          ...prev,
          [selectedOrder.id]: "",
        }));
      }
    };

    generateQRCodes();
  }, [selectedOrder, subdomains]);

  // Generate and download a QR code (SVG)
  const handleGenerateQRCode = async (subdomain) => {
    try {
      // Fetch the raw SVG data from the API
      const rawSvg = await generateQRCodeAPI(subdomain);

      // Process the SVG to remove unwanted elements and ensure scalability
      const cleanedSvg = processQrCodeSvg(rawSvg);

      if (!cleanedSvg) {
        throw new Error("Processed SVG is empty.");
      }

      // Create a Blob from the cleaned SVG string
      const svgBlob = new Blob([cleanedSvg], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Create a temporary link to initiate the download
      const link = document.createElement("a");
      link.href = svgUrl;
      link.download = `${subdomain}.svg`;
      document.body.appendChild(link); // Append to the DOM to make it clickable
      link.click(); // Trigger the download
      document.body.removeChild(link); // Clean up the DOM

      // Revoke the object URL after the download
      URL.revokeObjectURL(svgUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code!", { autoClose: 2000 });
    }
  };

  // Process images on server & upload them to Cloudinary, then save to metafield
  const handleProcessAndUploadImages = async (order) => {
    setLoadingOrders((prev) => ({ ...prev, [order.id]: true }));
    try {
      const folderName = order.name;
      const imageUrls = order.line_items[0].properties
        .filter((prop) => prop.value.startsWith("https://") && prop.name !== "_original_view_2" && prop.name !== "youtube")
        .map((prop) => prop.value);

      if (imageUrls.length === 0) {
        toast.warn("No images found in the properties.", { autoClose: 2000 });
        return;
      }

      // 1) Process + upload to Cloudinary
      const processedImages = await processAndUploadImagesAPI({
        orderId: order.id,
        folderName,
        imageUrls,
      });

      // 2) Save the final URLs to a "story-photos" metafield
      const photoUrls = processedImages.map((img) => img.url);
      const photoJson = JSON.stringify(photoUrls);
      await saveMetafieldAPI(order.id, "story-photos", "json_string", photoJson);

      // Update selectedOrder locally so thumbnails refresh immediately
      if (selectedOrder && selectedOrder.id === order.id) {
        const existingMf = selectedOrder.metafields?.find((mf) => mf.namespace === "custom" && mf.key === "story-photos");
        const updatedMetafields = existingMf
          ? selectedOrder.metafields.map((mf) =>
              mf.namespace === "custom" && mf.key === "story-photos" ? { ...mf, value: photoJson } : mf
            )
          : [...(selectedOrder.metafields || []), { namespace: "custom", key: "story-photos", value: photoJson }];
        setSelectedOrder({ ...selectedOrder, metafields: updatedMetafields });
      }

      toast.success(`Images processed and uploaded for ${folderName}!`, { autoClose: 2000 });
      fetchOrders(limit);
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to process and upload images!", { autoClose: 2000 });
    } finally {
      setLoadingOrders((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Download images as a ZIP file
  const handleDownloadImagesAsZip = async (order) => {
    setLoadingOrders2((prev) => ({ ...prev, [order.id]: true }));
    try {
      const folderName = order.name;
      const imageUrls = order.line_items[0].properties
        .filter((prop) => prop.value.startsWith("https://") && prop.name !== "_original_view_2")
        .map((prop) => prop.value);

      if (imageUrls.length === 0) {
        toast.warn("No valid images found in the properties.", { autoClose: 2000 });
        return;
      }

      // 1) Request a Blob of zipped/processed images
      const zipBlob = await downloadImagesAsZipAPI(folderName, imageUrls);

      // 2) Trigger browser download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`All images processed & downloaded as ${folderName}.zip`, { autoClose: 2000 });
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error("Failed to process images!", { autoClose: 2000 });
    } finally {
      setLoadingOrders2((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Copy properties to clipboard, substituting `story-photos` if needed
  const handleCopyProperties = (order) => {
    // 1. Get key fields from state or fallback to the line-item properties.
    const subdomainValue =
      subdomains[order.id] ||
      order.line_items[0].properties.find((prop) => prop.name === "subdomain")?.value ||
      "No story-id available";

    const storyTitleValue =
      storyTitles[order.id] ||
      order.line_items[0].properties.find((prop) => prop.name === "title")?.value ||
      "No story title available";

    const dedicationLineValue =
      dedicationLines[order.id] ||
      order.line_items[0].properties.find((prop) => prop.name === "dedication_line")?.value ||
      "No dedication line available";

    // Get milestone date if available (do not return anything if missing)
    const milestoneCandidate =
      milestoneDates[order.id] ||
      order.line_items[0].properties.find((prop) => prop.name === "milestone date")?.value;

    // Build the initial text string with the key fields.
    let textToCopy =
      `Order ID: ${order.name}\n` +
      `Subdomain: ${subdomainValue}\n` +
      `Story Title: ${storyTitleValue}\n` +
      `Dedication Line: ${dedicationLineValue}\n`;

    // Only add the milestone date if a value is present.
    if (milestoneCandidate) {
      textToCopy += `Milestone Date: ${milestoneCandidate}\n`;
    }
    textToCopy += "\n";

    // 2. Prepare the rest of the line-item properties.
    // Exclude keys that are either internal or already handled as key fields.
    const excludedKeys = [
      "_cl_options",
      "_cl_options_id",
      "_cl_options_price",
      "_original_view_2",
      "subdomain",
      "url_option",
      "custom URL",
      "title",
      "dedication_line",
      "milestone date"
    ];

    const remainingProperties = order.line_items[0].properties.filter(
      (prop) => !excludedKeys.includes(prop.name)
    );

    // 3. Process photo-related properties by checking for a "story-photos" metafield.
    const storyPhotosMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-photos"
    );

    // Process photo-related properties if story-photos metafield exists
    let propertiesToUse = [...remainingProperties];

    if (storyPhotosMetafield) {
      try {
        const storyPhotoUrls = JSON.parse(storyPhotosMetafield.value);

        // Filter out any existing photo properties - we'll replace them entirely
        propertiesToUse = propertiesToUse.filter(prop =>
          !prop.name.includes('photo') &&
          !prop.name.includes('photos') &&
          !prop.name.match(/chapter_\d+_photo/)
        );

        // Add photo properties only from the story-photos metafield
        if (storyPhotoUrls && storyPhotoUrls.length > 0) {
          // Check if authors_note_photo exists in the original properties
          const hasAuthorsNote = remainingProperties.some(prop => prop.name === "authors_note_photo");

          // If authors_note_photo exists in properties, keep the traditional mapping
          if (hasAuthorsNote) {
            // Add authors_note_photo (first photo)
            if (storyPhotoUrls[0]) {
              propertiesToUse.push({
                name: "authors_note_photo",
                value: storyPhotoUrls[0]
              });
            }

            // Add numbered chapter photos
            for (let i = 1; i < storyPhotoUrls.length - 1; i++) {
              if (storyPhotoUrls[i]) {
                propertiesToUse.push({
                  name: `chapter_${i}_photo`,
                  value: storyPhotoUrls[i]
                });
              }
            }

            // Add epilogue_photo if it exists (last photo)
            if (storyPhotoUrls.length > 1) {
              propertiesToUse.push({
                name: "epilogue_photo",
                value: storyPhotoUrls[storyPhotoUrls.length - 1]
              });
            }
          } else {
            // If no authors_note_photo in properties, map photos directly to chapters
            // Start from chapter_1_photo for the first photo
            for (let i = 0; i < storyPhotoUrls.length - 1; i++) {
              if (storyPhotoUrls[i]) {
                propertiesToUse.push({
                  name: `chapter_${i + 1}_photo`,
                  value: storyPhotoUrls[i]
                });
              }
            }

            // Add epilogue_photo if it exists (last photo)
            if (storyPhotoUrls.length > 0) {
              propertiesToUse.push({
                name: "epilogue_photo",
                value: storyPhotoUrls[storyPhotoUrls.length - 1]
              });
            }
          }
        }
      } catch (error) {
        console.error("Error parsing story photos:", error);
        // If there's an error parsing, keep the original properties
      }
    }

    // 4. Append all remaining properties to the text.
    textToCopy += propertiesToUse
      .map((prop) => `${prop.name}: ${prop.value}`)
      .join("\n");

    // 5. Copy the final text to the clipboard and store it for the story modal.
    setClipboardContent(textToCopy);
    setSelectedOrder(order);

    navigator.clipboard.writeText(textToCopy).then(
      () => toast.success(`${order.name} properties copied`, { autoClose: 2000 }),
      (err) => {
        console.error("Failed to copy text:", err);
        toast.error("Failed to copy properties!", { autoClose: 2000 });
      }
    );
  };

  // Copy password and open the subdomain in a new tab
  const handleCopyPasswordAndOpenSubdomain = (order) => {
    // 1) Copy password
    const passwordProperty = order.line_items[0].properties.find(
      (prop) => prop.name.toLowerCase() === "password"
    );

    if (passwordProperty?.value) {
      navigator.clipboard.writeText(passwordProperty.value).then(
        () => toast.success("Password copied to clipboard!", { autoClose: 2000 }),
        (err) => toast.error("Failed to copy password!", { autoClose: 2000 })
      );
    } else {
      toast.warn("No password available to copy.", { autoClose: 2000 });
    }

    // 2) Open the subdomain
    const storyUrlMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-url"
    );
    if (storyUrlMetafield?.value) {
      const url = `https://${storyUrlMetafield.value}.ossotna.com`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.warn("No story URL available to open.", { autoClose: 2000 });
    }
  };

  // Copy domain URL and open NFC modal on mobile
  const handleCopySubdomainOpenNFC = (order) => {
    // Get the subdomain from metafields
    const storyUrlMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-url"
    );

    if (storyUrlMetafield?.value) {
      const subdomain = storyUrlMetafield.value;
      const domainOnly = `${subdomain}.ossotna.com`;
      const fullUrl = `https://${domainOnly}`;

      if (isMobile()) {
        // For mobile, open the NFC write modal with the complete URL
        console.log("Setting NFC URL from handleCopySubdomainOpenNFC:", fullUrl);
        setNfcUrl(fullUrl);
        setNfcWriteAttempts(0);
        setNfcStep("idle");
        setLastReadUrl("");
        setNfcVerifyMatch(null);
        setIsNfcWriteModalOpen(true);
      } else {
        // For desktop, just copy to clipboard (domain only, no protocol)
        navigator.clipboard.writeText(domainOnly).then(
          () => toast.success("Domain copied to clipboard!", { autoClose: 2000 }),
          (err) => toast.error("Failed to copy domain!", { autoClose: 2000 })
        );
      }
    } else {
      toast.warn("No story URL available.", { autoClose: 2000 });
    }
  };

  const copyToClipboard = (dataToCopy) => {
    if (dataToCopy) {
      navigator.clipboard.writeText(dataToCopy).then(
        () => toast.success("Copied to clipboard", { autoClose: 2000 }),
        (err) => toast.error("Failed to Copy", { autoClose: 2000 })
      );
    } else {
      toast.warn("Nothing to Copy", { autoClose: 2000 });
    }
  }

  // 1) Duplicates the order's line items into a new Shopify Draft Order
  const handleDuplicateDraftOrder = async (originalOrder) => {
    try {
      // Prompt user for custom item name & price:
      const customItemName = window.prompt("Enter custom item name (leave blank to skip):");
      let customItemPrice = window.prompt("Enter custom item price in USD (leave blank to skip):");

      // If the user canceled or left blank, we won't add anything.
      // Otherwise, convert price to a number if provided.
      if (customItemName && customItemPrice) {
        // Basic parse; you can add more validation if needed
        const parsedPrice = parseFloat(customItemPrice) || 0;
        customItemPrice = parsedPrice.toString();
      }

      // 1) Destructure fields from original order:
      const {
        line_items = [],
        customer,
        email,
        shipping_address,
        billing_address,
      } = originalOrder;

      // 2) Convert the existing line_items to draft-friendly format
      const draftLineItems = line_items.map((item) => ({
        variant_id: item.variant_id, // If it exists
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        properties: item.properties?.map(({ name, value }) => ({ name, value })),
      }));

      // 3) If user entered a custom item, push it to draftLineItems
      if (customItemName && parseFloat(customItemPrice) > 0) {
        draftLineItems.push({
          title: customItemName,
          price: customItemPrice.toString(), // must be a string
          quantity: 1,
          taxable: false, // Usually non-physical items aren't taxable
          requires_shipping: false, // Non-physical items don't require shipping
        });
      }

      // 4) Create the new draft_order payload
      const draftOrderPayload = {
        draft_order: {
          line_items: draftLineItems,
          customer: customer ? { id: customer.id } : null,
          email,
          shipping_address: shipping_address
            ? {
              address1: shipping_address.address1,
              address2: shipping_address.address2,
              city: shipping_address.city,
              province: shipping_address.province,
              country: shipping_address.country,
              zip: shipping_address.zip,
              phone: shipping_address.phone,
              first_name: shipping_address.first_name,
              last_name: shipping_address.last_name,
            }
            : null,
          billing_address: billing_address
            ? {
              address1: billing_address.address1,
              address2: billing_address.address2,
              city: billing_address.city,
              province: billing_address.province,
              country: billing_address.country,
              zip: billing_address.zip,
              phone: billing_address.phone,
              first_name: billing_address.first_name,
              last_name: billing_address.last_name,
            }
            : null,
        },
      };

      // 5) POST the payload to your Next.js API route
      const response = await fetch("/api/shopify/duplicateDraftOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftOrderPayload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create draft order: ${response.statusText}`);
      }

      // Success
      toast.success("Draft order created successfully!", { autoClose: 2000 });
    } catch (error) {
      console.error("Error creating draft order:", error);
      toast.error("Failed to create draft order!", { autoClose: 2000 });
    }
  };

  // Example: Inside your OrdersPage component

  // Example: Inside your OrdersPage component

  const handleCreateDirectOrder = async (originalOrder) => {
    try {
      // Prompt user for custom item name & price:
      const customItemName = window.prompt("Enter custom item name (leave blank to skip):");
      let customItemPrice = window.prompt("Enter custom item price in USD (leave blank to skip):");

      // If the user canceled or left blank, we won't add anything.
      // Otherwise, convert price to a number if provided.
      let customItems = [];
      let numericPrice = 0;
      if (customItemName && customItemPrice) {
        numericPrice = parseFloat(customItemPrice);
        if (!isNaN(numericPrice) && numericPrice > 0) {
          customItems.push({
            title: customItemName,
            price: numericPrice.toFixed(2), // Ensure two decimal places as string
            quantity: 1,
            taxable: false, // Non-physical items typically aren't taxable
            requires_shipping: false, // Non-physical items don't require shipping
            properties: [
              { name: "is_custom", value: "true" }, // Optional: flag to identify custom items
            ],
          });
        } else {
          toast.error("Invalid price entered for custom item.", { autoClose: 2000 });
          return;
        }
      }

      // 1) Destructure fields from original order:
      const {
        line_items = [],
        customer,
        email,
        shipping_address,
        billing_address,
        financial_status, // e.g., 'paid', 'pending'
        fulfillment_status, // e.g., 'fulfilled', 'unfulfilled'
        shipping_lines = [],
        transactions = [],
        // Add other necessary fields if required
      } = originalOrder;

      // 2) Convert the existing line_items to order-friendly format
      const newLineItems = line_items.map((item) => {
        // Extract numeric variant_id from GID format (e.g. "gid://shopify/ProductVariant/123" -> 123)
        const variantId = item.variant?.id ? item.variant.id.split('/').pop() : null;
        const lineItem: any = {
          title: item.title,
          quantity: item.quantity,
          price: item.variant?.price || "0.00",
          properties: item.properties?.map(({ name, value }) => ({ name, value })),
        };
        if (variantId) lineItem.variant_id = parseInt(variantId, 10);
        return lineItem;
      });

      // 3) If user entered a custom item, push it to newLineItems
      if (customItems.length > 0) {
        newLineItems.push(...customItems);
      }

      // 4) Clone shipping_lines from the original order
      const newShippingLines = shipping_lines.map((shippingLine) => ({
        title: shippingLine.title,
        price: shippingLine.price,
        code: shippingLine.code || "",
        source: shippingLine.source || "custom",
      }));

      // 5) Build address from shipping_address
      const addr = shipping_address || null;

      // 6) Create the new order payload
      const orderPayload = {
        order: {
          line_items: newLineItems,
          email: email || undefined,
          shipping_address: addr,
          billing_address: addr,
          financial_status: "pending",
          shipping_lines: newShippingLines,
        },
      };

      // 7) POST the payload to your Next.js API route to create a direct order
      const response = await fetch("/api/shopify/createOrder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Order created successfully!", { autoClose: 2000 });
        // Optionally, refresh orders or redirect as needed
        fetchOrders(limit);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order.", { autoClose: 2000 });
    }
  };

  // **New** helper to copy story-photos JSON if it exists
  const handleCopyStoryPhotosJSON = (order) => {
    const storyPhotosMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-photos"
    );

    if (!storyPhotosMetafield) {
      toast.warn("No story-photos metafield to copy.", { autoClose: 2000 });
      return;
    }

    try {
      // Pretty-print JSON with 2 spaces indentation
      const formattedJSON = JSON.stringify(
        JSON.parse(storyPhotosMetafield.value),
        null,
        2
      );

      navigator.clipboard.writeText(formattedJSON).then(
        () => {
          toast.success("Copied story-photos JSON to clipboard!", { autoClose: 2000 });
        },
        (err) => {
          toast.error("Failed to copy JSON!", { autoClose: 2000 });
          console.error("Failed to copy JSON:", err);
        }
      );
    } catch (error) {
      console.error("Error parsing story-photos JSON:", error);
      toast.error("Invalid story-photos JSON format!", { autoClose: 2000 });
    }
  };

  // Limit change handler
  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value, 10);
    setLimit(newLimit > 250 ? 250 : newLimit); // Shopify max limit is 250
  };

  const DELIVERY_TAGS = ['READY FOR DELIVERY', 'SENT FOR DELIVERY', 'DELIVERED'];
  const STATUS_TO_TAG: Record<string, string> = {
    'Ready For Delivery': 'READY FOR DELIVERY',
    'Sent For Delivery': 'SENT FOR DELIVERY',
    'Delivered': 'DELIVERED',
  };

  const handleFulfillmentStatusChange = async (orderId, newStatus) => {
    setFulfillmentStatuses((prev) => ({ ...prev, [orderId]: newStatus }));
    try {
      await saveMetafieldAPI(orderId, "fulfillment-status", "single_line_text_field", newStatus);
      toast.success("Fulfillment status updated successfully!", { autoClose: 2000 });

      // Sync tags in Shopify: remove all old delivery tags, then add the correct one
      const newTag = STATUS_TO_TAG[newStatus];
      const tagsToRemove = DELIVERY_TAGS.filter(t => t !== newTag);

      // Remove stale tags
      if (tagsToRemove.length > 0) {
        try {
          await fetch('/api/shopify/removeTag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, tags: tagsToRemove }),
          });
        } catch (err) {
          console.error("Error removing old tags:", err);
        }
      }

      // Add the new tag (if status maps to one)
      if (newTag) {
        try {
          const response = await fetch('/api/shopify/addTag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, tag: newTag }),
          });
          const data = await response.json();
          if (data.success) {
            toast.info(`Order tagged as ${newTag} in Shopify`, { autoClose: 3000 });
          } else {
            console.warn("Shopify tag warning:", data.error);
          }
        } catch (err) {
          console.error("Error adding tag in Shopify:", err);
        }
      }
    } catch (error) {
      console.error("Error updating fulfillment status:", error);
      toast.error("Failed to update fulfillment status!", { autoClose: 2000 });
    }
  };

  const handleStoryStageChange = async (orderId, newStatus) => {
    setStoryStages((prev) => ({ ...prev, [orderId]: newStatus }));
    try {
      await saveMetafieldAPI(orderId, "story-stage", "single_line_text_field", newStatus);
      toast.success("Story status updated successfully!", { autoClose: 2000 });
    } catch (error) {
      console.error("Error updating story status:", error);
      toast.error("Failed to update story status!", { autoClose: 2000 });
    }
  };

  const handlePrintablesStatusChange = async (orderId, newStatus) => {
    setPrintablesStatuses((prev) => ({ ...prev, [orderId]: newStatus }));
    try {
      await saveMetafieldAPI(orderId, "printables-status", "single_line_text_field", newStatus);
      toast.success("Printables status updated successfully!", { autoClose: 2000 });
    } catch (error) {
      console.error("Error updating printables status:", error);
      toast.error("Failed to update printables status!", { autoClose: 2000 });
    }
  };

  const handleAddCustomItem = async (order) => {
    try {
      // Prompt user for custom item details
      const customItemName = window.prompt("Enter custom item name:");
      if (!customItemName) {
        toast.warn("Custom item name is required.", { autoClose: 2000 });
        return;
      }

      let customItemPrice = window.prompt("Enter custom item price in USD:");
      if (!customItemPrice) {
        toast.warn("Custom item price is required.", { autoClose: 2000 });
        return;
      }

      const parsedPrice = parseFloat(customItemPrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        toast.error("Invalid price entered.", { autoClose: 2000 });
        return;
      }

      // Convert back to string for API compatibility
      customItemPrice = parsedPrice.toString();

      // Call the API to add the custom item
      const response = await fetch("/api/shopify/addCustomItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          customItem: {
            title: customItemName,
            price: parsedPrice.toFixed(2),
            currencyCode: order.currencyCode || "USD",
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Custom item added successfully!", { autoClose: 2000 });
        fetchOrders(limit);
      } else {
        const errMsg = data.error || "Unknown error";
        if (errMsg.includes("cannot be edited")) {
          toast.error("This order cannot be edited (fulfilled/closed). Use 'Create Order' instead.", { autoClose: 4000 });
        } else {
          toast.error(`Failed: ${errMsg}`, { autoClose: 3000 });
        }
      }
    } catch (error) {
      console.error("Error adding custom item:", error);
      toast.error("Failed to add custom item.", { autoClose: 2000 });
    }
  };

  const handleRemoveCustomItem = async (order, lineItemId) => {
    try {
      // Confirm removal
      const confirm = window.confirm("Are you sure you want to remove this custom item?");
      if (!confirm) return;

      // Call the API to remove the custom item
      const response = await fetch("/api/shopify/removeCustomItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          lineItemId, // The ID of the line item to remove
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Custom item removed successfully!", { autoClose: 2000 });
        // Optionally, refresh order data here
        fetchOrders(limit);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error removing custom item:", error);
      toast.error("Failed to remove custom item.", { autoClose: 2000 });
    }
  };

  /**
   * Generic handler to save a metafield.
   * @param {string} orderId - The ID of the order.
   * @param {string} key - The metafield key.
   * @param {string} value - The value to save.
   */
  const handleSaveMetafield = async (orderId, key, value) => {
    try {
      await saveMetafieldAPI(orderId, key, "single_line_text_field", value); // Assuming 'string' type
      toast.success(`${key.replace("_", " ")} saved successfully!`, { autoClose: 2000 });
      fetchOrders(limit); // Refresh orders to get updated metafields
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      toast.error(`Failed to save ${key.replace("_", " ")}!`, { autoClose: 2000 });
    }
  };

  /**
   * Specific handlers for each field.
   */
  const handleSaveDedicationLine = async (orderId, dedicationLine) => {
    try {
      await saveMetafieldAPI(orderId, "story-dedication", "multi_line_text_field", dedicationLine);
      toast.success("Dedication line saved successfully!", { autoClose: 2000 });
      fetchOrders(limit);
    } catch (error) {
      console.error("Error saving dedication line:", error);
      toast.error("Failed to save dedication line!", { autoClose: 2000 });
    }
  };

  const handleSaveStoryTitle = (orderId, storyTitle) => {
    console.log("handleSaveMetafield", orderId, storyTitle)
    // Use multi_line_text_field for story title since it can now contain multiple lines
    saveMetafieldAPI(orderId, "story-title", "multi_line_text_field", storyTitle)
      .then(() => {
        toast.success(`story title saved successfully!`, { autoClose: 2000 });
        fetchOrders(limit); // Refresh orders to get updated metafields
      })
      .catch(error => {
        console.error(`Error saving story title:`, error);
        toast.error(`Failed to save story title!`, { autoClose: 2000 });
      });
  };

  const handleSaveMilestoneDate = (orderId, milestoneDate) => {
    console.log("handleSaveMilestoneDate", orderId, milestoneDate);
    // Save to the metafield
    handleSaveMetafield(orderId, "story-date", milestoneDate);
  };

  /**
   * Handler to restore all fields at once
   */
  const handleRestoreAllFields = (order) => {
    console.log("Restoring all fields for order:", order.id);
    
    // Check if story type is mother
    const storyType = order.line_items[0].properties.find(
      (prop) => prop.name === "story-type"
    );
    
    // Restore Milestone Date
    let milestoneDateValue = "";
    if (storyType?.value === "mother") {
      // For mother stories, use localized "A Mother's Story" based on language
      const languageProp = order.line_items[0].properties.find(
        (prop) => prop.name === "story-language"
      );
      const language = languageProp?.value || "en";

      // Set default value based on language
      if (language === "ar") {
        milestoneDateValue = "قصّة أمّ";
      } else if (language === "fr") {
        milestoneDateValue = "L'histoire d'une mère";
      } else {
        milestoneDateValue = "A Mother's Story";
      }
    } else {
      // For non-mother stories, try all possible property name variations
      const possibleNames = ["milestone_date", "milestone date", "milestone-date"];
      
      for (const name of possibleNames) {
        const property = order.line_items[0].properties.find(
          (prop) => prop.name === name
        );
        if (property?.value) {
          milestoneDateValue = property.value;
          break;
        }
      }
    }
    
    // Restore Story Title
    let storyTitleValue = "";
    if (storyType?.value === "mother") {
      const momNameProp = order.line_items[0].properties.find(
        (prop) => prop.name === "mom_name"
      );
      storyTitleValue = momNameProp?.value || "";
    } else {
      const titleProperty = order.line_items[0].properties.find(
        (prop) => prop.name === "title"
      );
      storyTitleValue = titleProperty?.value || "";
    }
    
    // Restore Dedication Line
    let dedicationLineValue = "";
    if (storyType?.value === "mother") {
      const kidsNameProp = order.line_items[0].properties.find(
        (prop) => prop.name === "kids_name"
      );
      const kidsName = kidsNameProp?.value || "";
      dedicationLineValue = kidsName ? `By ${kidsName}` : "";
    } else {
      const dedicationProperty = order.line_items[0].properties.find(
        (prop) => prop.name === "dedication_line"
      );
      dedicationLineValue = dedicationProperty?.value || "";
      
      if (!dedicationLineValue) {
        const theirNameProperty = order.line_items[0].properties.find(
          (prop) => prop.name === "their_name"
        );
        const yourNameProperty = order.line_items[0].properties.find(
          (prop) => prop.name === "your_name"
        );
        
        const theirName = theirNameProperty?.value || "";
        const yourName = yourNameProperty?.value || "";
        
        if (theirName && yourName) {
          dedicationLineValue = `For ${theirName}, By ${yourName}`;
        }
      }
    }
    
    // Update state for all fields
    setMilestoneDates((prev) => ({
      ...prev,
      [order.id]: milestoneDateValue,
    }));
    
    setStoryTitles((prev) => ({
      ...prev,
      [order.id]: storyTitleValue,
    }));
    
    setDedicationLines((prev) => ({
      ...prev,
      [order.id]: dedicationLineValue,
    }));
    
    // Update input fields directly for immediate feedback
    const milestoneDateInput = document.getElementById("milestone-date") as HTMLInputElement;
    const storyTitleInput = document.getElementById("story-title") as HTMLInputElement;
    const dedicationLineInput = document.getElementById("dedication-line") as HTMLInputElement;
    
    if (milestoneDateInput) milestoneDateInput.value = milestoneDateValue;
    if (storyTitleInput) storyTitleInput.value = storyTitleValue;
    if (dedicationLineInput) dedicationLineInput.value = dedicationLineValue;
    
    toast.success("All fields restored from order data", { autoClose: 2000 });
  };

  /**
   * Handler to save all fields at once
   */
  const handleSaveAllFields = (order) => {
    console.log("Saving all fields for order:", order.id);
    
    // Save Milestone Date
    handleSaveMetafield(order.id, "story-date", milestoneDates[order.id] || "");
    
    // Save Story Title
    handleSaveMetafield(order.id, "story-title", storyTitles[order.id] || "");
    
    // Save Dedication Line
    handleSaveDedicationLine(order.id, dedicationLines[order.id] || "");
    
    toast.success("All fields saved successfully!", { autoClose: 2000 });
  };

  // Helper functions to check if fields are in sync
  const isDedicationLineInSync = (order) => {
    const metafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-dedication"
    );
    if (!metafield?.value) return false; // Metafield is empty or doesn't exist
    return dedicationLines[order.id] === metafield.value;
  };

  const isStoryTitleInSync = (order) => {
    const metafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-title"
    );
    if (!metafield?.value) return false; // Metafield is empty or doesn't exist
    return storyTitles[order.id] === metafield.value;
  };

  const isMilestoneDateInSync = (order) => {
    const metafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-date"
    );
    // We don't need to check the property here, just if the state matches the metafield
    if (!metafield?.value) return false; // Metafield is empty or doesn't exist
    return milestoneDates[order.id] === metafield.value;
  };

  // Handle sending card preview as image via WhatsApp
  const handleSendCardPreview = async (imageData) => {
    if (!selectedOrder) return;

    try {
      // Show loading toast
      const loadingToast = toast.loading('Preparing card preview...');
      
      // Get the phone number
      const phoneNumber = getPhoneNumber(selectedOrder);
      if (!phoneNumber) {
        toast.dismiss(loadingToast);
        toast.error('No phone number available for this order');
        return;
      }

      // Format the phone number for WhatsApp
      const cleanPhone = formatPhoneForWhatsApp(phoneNumber);
      
      if (!imageData) {
        toast.dismiss(loadingToast);
        toast.error('Failed to generate card preview image');
        return;
      }
      
      // Create the preview message
      const previewMessage = `Hello ${selectedOrder?.shipping_address?.first_name}, Please find attached the preview of your Ossotna card design. The story preview link will be sent separately once ready. Let me know if you'd like any changes before we proceed with printing.\n\nThank you!`;
      
      // Generate WhatsApp URL based on device
      const whatsappUrl = getWhatsAppUrl(cleanPhone, previewMessage);
      
      // Create a temporary link to download the image
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `ossotna_card_${selectedOrder.name.replace('#', '')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Dismiss loading toast and show success message
      toast.dismiss(loadingToast);
      toast.success('Card preview image downloaded. Please attach it to your WhatsApp message.');
      
      // Open WhatsApp with the message
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error sending card preview:', error);
      toast.error(`Error: ${error.message || 'Unknown error sending card preview to client'}`);
    }
  };

  // Function to determine the number of cards needed based on variant title
  const getCardQuantityFromVariant = (variantTitle) => {
    if (!variantTitle) return 1; // Default to 1 if no variant title
    
    const variantLower = variantTitle.toLowerCase();
    
    if (variantLower.includes('solo')) {
      return 1; // SOLO = 1 card
    } else if (variantLower.includes('unity') || variantLower.includes('dual')) {
      return 2; // UNITY or DUAL = 2 cards
    }
    
    // Default to 1 if we can't determine
    return 1;
  };

  // Handle sending PDF to printing company via WhatsApp
  const handleSendToPrinter = async (pdfUrl) => {
    if (!selectedOrder) return;

    try {
      // Show loading toast
      const loadingToast = toast.loading('Preparing print order...');
      
      // Get the number of cards needed based on variant
      const variantTitle = selectedOrder.line_items[0]?.variant_title || '';
      const cardQuantity = getCardQuantityFromVariant(variantTitle);
      
      // Fixed WhatsApp number for the printing company (Lebanese format)
      const printerPhoneNumber = "+96170958877"; // Replace with the actual printer's number
      
      // Create the print order message
      const orderNumber = selectedOrder.name;
      const customerName = selectedOrder.shipping_address?.name || 'Customer';
      
      const printMessage = `Hello, ${cardQuantity}x card${cardQuantity > 1 ? 's' : ''} 🙏`.trim();
      
      // Create a temporary link to download the PDF
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Ossotna ${cardQuantity} card${cardQuantity > 1 ? 's' : ''} ${selectedOrder.name.replace('#', '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Open WhatsApp with the message - no need to format the fixed number
      const whatsappUrl = getWhatsAppUrl(printerPhoneNumber, printMessage);
      window.open(whatsappUrl, '_blank');
      
      // Dismiss loading toast and show success message
      toast.dismiss(loadingToast);
      toast.success('Print order prepared. Please attach the downloaded PDF to the WhatsApp message.');
    } catch (error) {
      console.error('Error sending to printer:', error);
      toast.error(`Error: ${error.message || 'Unknown error sending to printer'}`);
    }
  };

  /**
   * Handler for scanning the QR code and comparing subdomains.
   * @param {Object} data - The data returned from the QR scanner.
   */
  // State to track if scanner is paused after mismatch
  const [isScannerPaused, setIsScannerPaused] = useState(false);

  const handleSubdomainScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0 && !isScannerPaused) {
      try {
        // Pause the scanner to prevent multiple scans
        setIsScannerPaused(true);

        const scannedText = detectedCodes[0].rawValue.trim();

        // Attempt to parse the scanned text as a URL
        let scannedSubdomain = "";
        try {
          const url = new URL(scannedText);
          scannedSubdomain = url.hostname.split('.')[0]; // Extract subdomain
        } catch (err) {
          // If not a valid URL, assume the scanned text is the subdomain itself
          scannedSubdomain = scannedText;
        }

        const currentSubdomain = subdomainValue(selectedOrder);
        console.log(`Scanned Subdomain: ${scannedSubdomain}`);
        console.log(`Current Subdomain: ${currentSubdomain}`);

        if (scannedSubdomain.toLowerCase() === currentSubdomain.toLowerCase()) {
          toast.success("Subdomain matches!");
          // Close the scanner modal and open NFC modal
          setIsSubdomainCheckOpen(false);
          setIsScannerPaused(false);
          // Open NFC modal with the current subdomain
          const fullUrl = `https://${currentSubdomain}.ossotna.com`;
          setNfcUrl(fullUrl);
          console.log("Setting NFC URL to:", fullUrl);
          setNfcWriteAttempts(0);
          setNfcStep("idle");
          setLastReadUrl("");
          setNfcVerifyMatch(null);
          setIsNfcWriteModalOpen(true);
          // Update printables status to Ready on successful QR verification
          if (selectedOrder?.id) {
            saveMetafieldAPI(selectedOrder.id, "printables-status", "single_line_text_field", "Ready")
              .then(() => {
                setPrintablesStatuses((prev) => ({ ...prev, [selectedOrder.id]: "Ready" }));
                console.log("Printables status set to Ready after QR verification");
              })
              .catch((err) => console.error("Failed to update printables status:", err));
          }
        } else {
          toast.error("Subdomain does not match.", { autoClose: 2000 });
          // Keep scanner paused until user clicks Scan Again
        }
      } catch (error) {
        console.error("Error processing scanned QR code:", error);
        toast.error("Invalid QR code data.", { autoClose: 2000 });
        setIsSubdomainCheckOpen(false);
      }
    }
  };

  /**
   * Handler for errors during QR scanning.
   * @param {Error} err - The error encountered.
   */
  const handleSubdomainError = (err) => {
    console.error("QR Scanner Error:", err);
    toast.error("Failed to access camera for scanning.", { autoClose: 2000 });
    // Pause the scanner on error instead of closing it
    setIsScannerPaused(true);
  };

  /**
   * Handler for scanning order labels to mark as Ready for Delivery
   * @param {Object} detectedCodes - The QR codes detected by the scanner
   */
  const handleDeliveryScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0 && scanStatus === "ready") {
      try {
        const data = detectedCodes[0].rawValue;
        console.log("Delivery scan data:", data);

        // Assuming the QR code contains a Shopify order URL or ID
        let orderId;

        // Try to parse as URL first
        try {
          const url = new URL(data);
          const pathSegments = url.pathname.split('/');
          orderId = pathSegments[pathSegments.length - 1]; // Extract the last segment as orderId
        } catch {
          // If not a URL, use the raw value as the order ID
          orderId = data.trim();
        }

        console.log("Extracted order ID for delivery:", orderId);

        // Find the order with the extracted orderId
        const order = orders.find(o => o.id === String(orderId) || o.name === String(orderId));

        if (order) {
          // Set current order and loading state
          setCurrentScanOrder(order);
          setScanStatus("loading");

          // Update the metafield status and sync tags in Shopify
          saveMetafieldAPI(order.id, "fulfillment-status", "single_line_text_field", "Ready For Delivery")
            .then(async () => {
              // Update local state
              setFulfillmentStatuses((prev) => ({
                ...prev,
                [order.id]: "Ready For Delivery",
              }));

              // Remove stale delivery tags, then add the correct one
              try {
                await fetch('/api/shopify/removeTag', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: order.id, tags: ['SENT FOR DELIVERY', 'DELIVERED'] }),
                });
                await fetch('/api/shopify/addTag', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: order.id, tag: 'READY FOR DELIVERY' }),
                });
                console.log("Order tagged as READY FOR DELIVERY in Shopify via scan");
              } catch (err) {
                console.error("Error syncing tags in Shopify:", err);
              }

              // Show success state
              setScanStatus("success");

              // Reset after a delay to allow for the next scan
              setTimeout(() => {
                setScanStatus("ready");
                setCurrentScanOrder(null);
              }, 2000);
            })
            .catch(error => {
              console.error("Error updating order status:", error);

              // Show error state
              setScanStatus("error");

              // Reset after a delay
              setTimeout(() => {
                setScanStatus("ready");
                setCurrentScanOrder(null);
              }, 2000);
            });
        } else {
          setScanStatus("error");
          setCurrentScanOrder({ name: "Unknown Order", error: "Order not found" });
          setTimeout(() => {
            setScanStatus("ready");
            setCurrentScanOrder(null);
          }, 2000);
        }
      } catch (error) {
        console.error("Error processing delivery QR code:", error);
        setScanStatus("error");
        setCurrentScanOrder({ name: "Error", error: "Invalid QR code format" });
        setTimeout(() => {
          setScanStatus("ready");
          setCurrentScanOrder(null);
        }, 2000);
      }
    }
  };

  /**
   * Handler for errors during delivery QR scanning
   * @param {Error} err - The error encountered
   */
  const handleDeliveryError = (err) => {
    console.error("Error scanning for delivery:", err);
    toast.error("Failed to access camera for delivery scanning", { autoClose: 2000 });
  };

  /**
   * Handler for scanning order labels to mark as Sent for Delivery
   */
  const handleSentForDeliveryScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0 && scanStatus === "ready") {
      try {
        const data = detectedCodes[0].rawValue;
        console.log("Sent for delivery scan data:", data);

        let orderId;
        try {
          const url = new URL(data);
          const pathSegments = url.pathname.split('/');
          orderId = pathSegments[pathSegments.length - 1];
        } catch {
          orderId = data.trim();
        }

        console.log("Extracted order ID for sent for delivery:", orderId);
        const order = orders.find(o => o.id === String(orderId) || o.name === String(orderId));

        if (order) {
          setCurrentScanOrder(order);
          setScanStatus("loading");

          saveMetafieldAPI(order.id, "fulfillment-status", "single_line_text_field", "Sent For Delivery")
            .then(async () => {
              setFulfillmentStatuses((prev) => ({
                ...prev,
                [order.id]: "Sent For Delivery",
              }));

              // Remove stale tags, then add SENT FOR DELIVERY + provider tag
              try {
                await fetch('/api/shopify/removeTag', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: order.id, tags: ['READY FOR DELIVERY', 'DELIVERED', 'WAKILNI', 'UNIPARCEL', 'ROADRUNNER', 'OSSDRIVER'] }),
                });
                const tagsToAdd = ['SENT FOR DELIVERY'];
                if (selectedDeliveryProvider) tagsToAdd.push(selectedDeliveryProvider);
                for (const tag of tagsToAdd) {
                  await fetch('/api/shopify/addTag', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id, tag }),
                  });
                }
                console.log(`Order tagged as SENT FOR DELIVERY (${selectedDeliveryProvider}) in Shopify via scan`);
              } catch (err) {
                console.error("Error syncing tags in Shopify:", err);
              }

              setScanStatus("success");
              setTimeout(() => {
                setScanStatus("ready");
                setCurrentScanOrder(null);
              }, 2000);
            })
            .catch(error => {
              console.error("Error updating order status:", error);
              setScanStatus("error");
              setTimeout(() => {
                setScanStatus("ready");
                setCurrentScanOrder(null);
              }, 2000);
            });
        } else {
          setScanStatus("error");
          setCurrentScanOrder({ name: "Unknown Order", error: "Order not found" });
          setTimeout(() => {
            setScanStatus("ready");
            setCurrentScanOrder(null);
          }, 2000);
        }
      } catch (error) {
        console.error("Error processing scanned QR code:", error);
        setScanStatus("error");
        setCurrentScanOrder({ name: "Error", error: "Invalid QR code format" });
        setTimeout(() => {
          setScanStatus("ready");
          setCurrentScanOrder(null);
        }, 2000);
      }
    }
  };

  const handleSentForDeliveryError = (err) => {
    console.error("Error scanning for sent for delivery:", err);
    toast.error("Failed to access camera for scanning", { autoClose: 2000 });
  };

  // Handler to open Shopify order page
  const handleOpenShopifyOrderPage = (order) => {
    const shopifyAdminBaseURL = "https://admin.shopify.com/store/83637c-4/orders"; // Replace with your actual Shopify admin URL
    const shopifyOrderURL = `${shopifyAdminBaseURL}/${order.id}`;
    window.open(shopifyOrderURL, "_blank", "noopener,noreferrer");
  };

  // Handler to open Shopify order page
  const handleOpenShopifyPrintPage = (order) => {
    const shopifyAdminBaseURL = "https://admin.shopify.com/store/83637c-4/apps/shopify-order-printer/app/orders/bulk?id="; // Replace with your actual Shopify admin URL
    const shopifyOrderURL = `${shopifyAdminBaseURL}${order.id}`;
    window.open(shopifyOrderURL, "_blank", "noopener,noreferrer");
  };

  // WhatsApp utility functions are now imported at the top of the file


  const getPhoneNumber = (order) => {
    if (!order) return '';
    // Return order.phone if it exists
    if (order.phone) return order.phone;
    // Otherwise, return the phone from shipping_address (if available)
    if (order.shipping_address && order.shipping_address.phone) {
      return order.shipping_address.phone;
    }
    return ''; // Otherwise, return an empty string
  };
  // Handler to copy subdomain and open in localhost
  const handleCopySubdomainAndOpenLocalhost = (order) => {
    const storyUrlMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-url"
    );
    const passwordProperty = order.line_items[0].properties.find(
      (prop) => prop.name.toLowerCase() === "password"
    );

    if (storyUrlMetafield?.value) {
      const subdomain = storyUrlMetafield.value;

      // **Add the protocol (http://) to the URL**
      const localhostURL = `http://${subdomain}.localhost:3001`;


      if (passwordProperty?.value) {
        navigator.clipboard.writeText(passwordProperty.value).then(
          () => toast.success("Password copied to clipboard!", { autoClose: 2000 }),
          (err) => toast.error("Failed to copy Password!", { autoClose: 2000 })
        );
      }
      // Open the URL in a new tab
      window.open(localhostURL, "_blank", "noopener,noreferrer");
    } else {
      toast.warn("No story URL available to open in localhost.", { autoClose: 2000 });
    }
  };

  // 4) Render
  return (
    <>
      <div className="p-4 md:p-6 bg-gray-900 min-h-screen relative pb-40 md:pb-6">
        {/* Mobile Footer Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-700 p-3 flex flex-col gap-2 border-t border-gray-500 shadow-lg">
          <button
            onClick={() => setIsCameraOpen(true)}
            className="p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full flex items-center justify-center gap-2 transition-colors border border-blue-500"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            <span className="font-medium">Scan Order Label</span>
          </button>
          <button
            onClick={() => setIsDeliveryScanOpen(true)}
            className="p-3 bg-green-600 text-white rounded-md hover:bg-green-700 w-full flex items-center justify-center gap-2 transition-colors border border-green-500"
          >
            <span className="material-symbols-outlined text-[20px]">local_shipping</span>
            <span className="font-medium">Mark Ready for Delivery</span>
          </button>
          <button
            onClick={() => setShowDeliveryProviderSelect(true)}
            className="p-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 w-full flex items-center justify-center gap-2 transition-colors border border-orange-500"
          >
            <span className="material-symbols-outlined text-[20px]">delivery_truck_speed</span>
            <span className="font-medium">Sent for Delivery</span>
          </button>
        </div>

        {/* Limit Selector + Quick Filters */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="limit" className="text-white text-sm">
              Orders Fetched
            </label>
            <select
              id="limit"
              value={limit}
              onChange={handleLimitChange}
              className="p-1.5 bg-gray-600 text-white rounded border border-gray-500 text-sm"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
            </select>
          </div>

          {(() => {
            const counts = {
              new: orders.filter(o => (storyStages[o.id] || "Pending") === "Pending" && (printablesStatuses[o.id] || "Pending") === "Pending" && (fulfillmentStatuses[o.id] || "New Order") === "New Order").length,
              edits: orders.filter(o => (storyStages[o.id] || "Pending") === "Review").length,
              printing: orders.filter(o => printablesStatuses[o.id] === "Printing").length,
              ready: orders.filter(o => printablesStatuses[o.id] === "Ready" && (fulfillmentStatuses[o.id] || "New Order") === "New Order").length,
              delivery: orders.filter(o => fulfillmentStatuses[o.id] === "Ready For Delivery").length,
              sent: orders.filter(o => fulfillmentStatuses[o.id] === "Sent For Delivery").length,
            };
            return <>
              {/* Mobile: dropdown select */}
              <select
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value as any)}
                className="md:hidden ml-auto p-1.5 bg-gray-600 text-white rounded border border-gray-500 text-sm"
              >
                <option value="all">All ({orders.length})</option>
                {(counts.new > 0 || tableFilter === "new") && <option value="new">New ({counts.new})</option>}
                {(counts.edits > 0 || tableFilter === "edits") && <option value="edits">Edits ({counts.edits})</option>}
                {(counts.printing > 0 || tableFilter === "printing") && <option value="printing">Printing ({counts.printing})</option>}
                {(counts.ready > 0 || tableFilter === "ready") && <option value="ready">To Fulfill ({counts.ready})</option>}
                {(counts.delivery > 0 || tableFilter === "delivery") && <option value="delivery">Delivery ({counts.delivery})</option>}
                {(counts.sent > 0 || tableFilter === "sent") && <option value="sent">Sent ({counts.sent})</option>}
              </select>

              {/* Desktop: filter buttons */}
              <div className="hidden md:flex flex-wrap items-center gap-1.5 ml-auto">
                <button
                  onClick={() => setTableFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "all" ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-gray-300 hover:border-gray-500'}`}
                >
                  All ({orders.length})
                </button>
                {(counts.new > 0 || tableFilter === "new") && <button
                  onClick={() => setTableFilter("new")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "new" ? 'bg-purple-500 text-white border-purple-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-gray-300 hover:border-gray-500'}`}
                >
                  New ({counts.new})
                </button>}
                {(counts.edits > 0 || tableFilter === "edits") && <button
                  onClick={() => setTableFilter("edits")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "edits" ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-orange-300 hover:border-orange-700'}`}
                >
                  ✏️ Edits ({counts.edits})
                </button>}
                {(counts.printing > 0 || tableFilter === "printing") && <button
                  onClick={() => setTableFilter("printing")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "printing" ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-yellow-300 hover:border-yellow-700'}`}
                >
                  🖨 Printing ({counts.printing})
                </button>}
                {(counts.ready > 0 || tableFilter === "ready") && <button
                  onClick={() => setTableFilter("ready")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "ready" ? 'bg-green-500 text-white border-green-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-green-300 hover:border-green-700'}`}
                >
                  ✅ To Fulfill ({counts.ready})
                </button>}
                {(counts.delivery > 0 || tableFilter === "delivery") && <button
                  onClick={() => setTableFilter("delivery")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "delivery" ? 'bg-sky-500 text-white border-sky-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-sky-300 hover:border-sky-700'}`}
                >
                  🚚 Delivery ({counts.delivery})
                </button>}
                {(counts.sent > 0 || tableFilter === "sent") && <button
                  onClick={() => setTableFilter("sent")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${tableFilter === "sent" ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-gray-500 border-gray-600 hover:text-orange-300 hover:border-orange-700'}`}
                >
                  📦 Sent ({counts.sent})
                </button>}
              </div>
            </>;
          })()}
        </div>

        {/* Main Table */}
        <OrdersTable
          orders={
            tableFilter === "new" ? orders.filter(o => (storyStages[o.id] || "Pending") === "Pending" && (printablesStatuses[o.id] || "Pending") === "Pending" && (fulfillmentStatuses[o.id] || "New Order") === "New Order") :
            tableFilter === "edits" ? orders.filter(o => (storyStages[o.id] || "Pending") === "Review") :
            tableFilter === "printing" ? orders.filter(o => printablesStatuses[o.id] === "Printing") :
            tableFilter === "ready" ? orders.filter(o => printablesStatuses[o.id] === "Ready" && (fulfillmentStatuses[o.id] || "New Order") === "New Order") :
            tableFilter === "delivery" ? orders.filter(o => fulfillmentStatuses[o.id] === "Ready For Delivery") :
            tableFilter === "sent" ? orders.filter(o => fulfillmentStatuses[o.id] === "Sent For Delivery") :
            orders
          }
          isLoading={isLoading}
          subdomains={subdomains}
          toggledRows={toggledRows}
          loadingOrders={loadingOrders}
          storyStages={storyStages}
          printablesStatuses={printablesStatuses}
          fulfillmentStatuses={fulfillmentStatuses}
          uploadProgress={uploadProgress}
          downloadProgress={downloadProgress}
          storyStageOptions={storyStageOptions}
          printablesStatusOptions={printablesStatusOptions}
          fulfillmentStatusOptions={fulfillmentStatusOptions}
          setSubdomains={setSubdomains}
          handleOpenModal={handleOpenModal}
          handleCopyProperties={handleCopyProperties}
          handleProcessAndUploadImages={handleProcessAndUploadImages}
          handleCopyStoryPhotosJSON={handleCopyStoryPhotosJSON}
          handleCopyPasswordAndOpenSubdomain={handleCopyPasswordAndOpenSubdomain}
          handleCopySubdomainAndOpenLocalhost={handleCopySubdomainAndOpenLocalhost}
          handleOpenShopifyOrderPage={handleOpenShopifyOrderPage}
          handleOpenShopifyPrintPage={handleOpenShopifyPrintPage}
          handleSendPreviewLink={handleSendPreviewLink}
          handleSaveSubdomain={handleSaveSubdomain}
          handleGenerateQRCode={handleGenerateQRCode}
          handleStoryStageChange={handleStoryStageChange}
          handlePrintablesStatusChange={handlePrintablesStatusChange}
          handleFulfillmentStatusChange={handleFulfillmentStatusChange}
          setSelectedOrder={setSelectedOrder}
          setActiveModalTab={setActiveModalTab}
          setIsModalOpen={setIsModalOpen}
        />

        {/* Image Upload Modal */}
        <ImageUploadModal
          isOpen={isImageUploadModalOpen}
          onClose={() => setIsImageUploadModalOpen(false)}
        />

        <ToastContainer
          position="bottom-center"
          limit={3}
          newestOnTop
          closeOnClick
          autoClose={2000}
          hideProgressBar
          className="!mb-20 md:!mb-0"
        />
      </div>
      {isModalOpen && selectedOrder && (
        // Backdrop
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(false);
          }}
        >
          {/* Outer container (stopPropagation so clicks inside don't close) */}
          <div
            className={`relative bg-white dark:bg-gray-800 rounded shadow-lg ${
              /* Make full screen without padding on mobile, retain original size on desktop */
              "w-full h-full md:w-[90dvw] md:h-[90dvh] " +
              (isMobile() ? "p-0 pb-16" : "p-0")
              }`}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Flex layout for header and content */}
            <div className="flex flex-col h-full">

              {/* HEADER (fixed within the modal: use "sticky" or "shrink-0") */}
              <div className="block md:sticky top-0 p-4 md:p-6 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 z-10 flex flex-col md:flex-row md:items-center md:justify-between relative">
                <div className="flex flex-col flex-1 pr-10">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">{selectedOrder.name}</h2>
                    {(() => {
                      const storyType = selectedOrder.line_items[0].properties.find(p => p.name === "story-type")?.value || "Standard";
                      const storyLanguage = selectedOrder.line_items[0].properties.find(p => p.name === "story-language")?.value || "";
                      let bgColor = "bg-gray-600";
                      if (storyType.toLowerCase() === "mother") bgColor = "bg-purple-600";
                      else if (storyType.toLowerCase() === "love") bgColor = "bg-red-600";
                      else if (storyType.toLowerCase() === "friendship") bgColor = "bg-blue-500";
                      let langColor = "bg-gray-600";
                      if (storyLanguage.toLowerCase() === "ar") langColor = "bg-amber-800";
                      else if (storyLanguage.toLowerCase() === "en") langColor = "bg-green-800";
                      else if (storyLanguage.toLowerCase() === "fr") langColor = "bg-blue-900";
                      return (
                        <>
                          <span className={`px-2 py-0.5 ${bgColor} rounded text-white text-xs font-bold`}>
                            {storyType.toUpperCase()}
                          </span>
                          {storyLanguage && (
                            <span className={`px-2 py-0.5 ${langColor} rounded text-white text-xs font-bold`}>
                              {storyLanguage.toUpperCase()}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{selectedOrder.line_items[0].variant_title}</span>
                </div>

                {/* Statuses */}
                <div className={`text-gray-800 dark:text-gray-300 mt-2 md:mt-0 ${isMobile() ? "w-full" : "w-auto"}`}>
                  {/* Mobile: Story+Printables side by side, Fulfillment below */}
                  <div className="flex flex-col gap-2 md:hidden">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Story</label>
                        <select
                          className={`w-full p-1.5 text-sm border rounded text-gray-800 dark:text-gray-100 ${getStatusSelectClassName(storyStages[selectedOrder.id] || "Pending")}`}
                          value={storyStages[selectedOrder.id] || "Pending"}
                          onChange={(e) => handleStoryStageChange(selectedOrder.id, e.target.value)}
                        >
                          {storyStageOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Printables</label>
                        <select
                          className={`w-full p-1.5 text-sm border rounded text-gray-800 dark:text-gray-100 ${getPrintablesStatusSelectClassName(printablesStatuses[selectedOrder.id] || "Pending")}`}
                          value={printablesStatuses[selectedOrder.id] || "Pending"}
                          onChange={(e) => handlePrintablesStatusChange(selectedOrder.id, e.target.value)}
                        >
                          {printablesStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fulfillment</label>
                      <select
                        className={`w-full p-1.5 text-sm border rounded text-gray-800 dark:text-gray-100 ${getStatusSelectClassName(fulfillmentStatuses[selectedOrder.id] || "New Order")}`}
                        value={fulfillmentStatuses[selectedOrder.id] || "New Order"}
                        onChange={(e) => handleFulfillmentStatusChange(selectedOrder.id, e.target.value)}
                      >
                        {fulfillmentStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Desktop: all 3 in a row */}
                  <div className="hidden md:grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Story</label>
                      <select
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 ${getStatusSelectClassName(storyStages[selectedOrder.id] || "Pending")}`}
                        value={storyStages[selectedOrder.id] || "Pending"}
                        onChange={(e) => handleStoryStageChange(selectedOrder.id, e.target.value)}
                      >
                        {storyStageOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Printables</label>
                      <select
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 ${getPrintablesStatusSelectClassName(printablesStatuses[selectedOrder.id] || "Pending")}`}
                        value={printablesStatuses[selectedOrder.id] || "Pending"}
                        onChange={(e) => handlePrintablesStatusChange(selectedOrder.id, e.target.value)}
                      >
                        {printablesStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fulfillment</label>
                      <select
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 ${getStatusSelectClassName(fulfillmentStatuses[selectedOrder.id] || "New Order")}`}
                        value={fulfillmentStatuses[selectedOrder.id] || "New Order"}
                        onChange={(e) => handleFulfillmentStatusChange(selectedOrder.id, e.target.value)}
                      >
                        {fulfillmentStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 z-10 absolute top-3 right-3 md:top-6 md:right-6 p-2 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center h-8 w-8"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* TAB BAR */}
              <div className="flex border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 md:px-6 shrink-0">
                {[
                  { key: "delivery", label: "Delivery", icon: "local_shipping" },
                  { key: "details", label: "Details", icon: "info" },
                  { key: "story", label: "Story", icon: "auto_stories" },
                  { key: "images", label: "Images", icon: "photo_library" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (tab.key === "story" && !clipboardContent && selectedOrder) {
                        handleCopyProperties(selectedOrder);
                      }
                      setActiveModalTab(tab.key);
                    }}
                    className={`flex items-center gap-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeModalTab === tab.key
                        ? "border-blue-500 text-blue-500"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT */}

              {/* TAB 0: Delivery Info */}
              {activeModalTab === "delivery" && (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-48 md:pb-6">
                <div className="max-w-2xl mx-auto flex flex-col gap-5">

                  {/* Key Info - Big for driver visibility */}
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">City</div>
                      <div className="text-3xl md:text-2xl font-black text-yellow-400">{(selectedOrder?.shipping_address?.city || "—").toUpperCase()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total</div>
                      <div className="text-3xl md:text-2xl font-black text-green-400">{selectedOrder?.currencyCode} {selectedOrder?.totalPriceSet?.shopMoney?.amount || "—"}</div>
                    </div>
                  </div>

                  {/* Customer + Contact */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Customer</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gray-700 text-gray-300 font-bold text-lg">
                          {selectedOrder?.shipping_address?.first_name?.[0] || "?"}{selectedOrder?.shipping_address?.last_name?.[0] || ""}
                        </div>
                        <div>
                          <div className="font-bold text-lg text-white">{selectedOrder?.shipping_address?.first_name} {selectedOrder?.shipping_address?.last_name}</div>
                          {selectedOrder?.email && <div className="text-sm text-gray-400">{selectedOrder.email}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)), `Hello ${selectedOrder?.shipping_address?.first_name}`)} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-700 hover:bg-green-600 text-white transition text-sm font-medium">
                          <span className="material-symbols-outlined text-[22px]">chat</span>
                          WhatsApp
                        </a>
                        <a href={`tel:${getPhoneNumber(selectedOrder)}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition text-sm font-medium">
                          <span className="material-symbols-outlined text-[22px]">call</span>
                          Call
                        </a>
                      </div>
                      {/* Quick Action: Send "Ready for Delivery" WhatsApp message */}
                      <a
                        href={getWhatsAppUrl(
                          formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)),
                          `Hello ${selectedOrder?.shipping_address?.first_name || ''}, your Ossotna order ${selectedOrder?.name || ''} is ready for delivery and getting sent out today. The driver will contact you for location and time. Thank you!`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition text-sm font-medium mt-1"
                      >
                        <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                        Send "Ready for Delivery" Message
                      </a>
                    </div>
                  </div>

                  {/* Delivery Notes - prominent */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Delivery Notes</h3>
                    {selectedOrder?.note ? (
                      <div className="text-base text-yellow-200 bg-yellow-900/30 rounded-lg p-4 border-2 border-yellow-700/50 whitespace-pre-wrap font-medium">{selectedOrder.note}</div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">No delivery notes</div>
                    )}
                  </div>

                  {/* Shipping Address */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Shipping Address</h3>
                    {selectedOrder?.shipping_address ? (
                      <div className="text-base text-gray-300 leading-relaxed">
                        <div className="font-bold text-white text-lg">{selectedOrder.shipping_address.first_name} {selectedOrder.shipping_address.last_name}</div>
                        {selectedOrder.shipping_address.address1 && <div>{selectedOrder.shipping_address.address1}</div>}
                        {selectedOrder.shipping_address.address2 && <div>{selectedOrder.shipping_address.address2}</div>}
                        <div className="font-semibold text-white">
                          {[selectedOrder.shipping_address.city, selectedOrder.shipping_address.province, selectedOrder.shipping_address.zip].filter(Boolean).join(", ")}
                        </div>
                        {selectedOrder.shipping_address.country && <div>{selectedOrder.shipping_address.country}</div>}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">No shipping address</div>
                    )}
                  </div>

                  {/* Shipping Method */}
                  {selectedOrder?.shipping_lines?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Shipping Method</h3>
                    {selectedOrder.shipping_lines.map((sl, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{sl.title || sl.code || "Standard"}</span>
                        {sl.price && <span className="text-gray-400">{selectedOrder.currencyCode} {sl.price}</span>}
                      </div>
                    ))}
                  </div>
                  )}

                  {/* Line Items */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Items</h3>
                    <div className="flex flex-col gap-2">
                      {selectedOrder?.line_items?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                          <div>
                            <div className="text-gray-200 font-medium">{item.title}</div>
                            {item.variant_title && <div className="text-xs text-gray-500">{item.variant_title}</div>}
                          </div>
                          <div className="text-gray-400 text-xs">x{item.quantity}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Quick Actions */}
                  <div className="hidden md:block">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Quick Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleSendDeliveryMessage(selectedOrder); }} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition">
                        <span className="material-symbols-outlined text-[18px]">chat</span>Delivery Message
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleMarkDelivered(selectedOrder); }} disabled={isFulfilling} className="flex items-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm font-medium transition disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">{isFulfilling ? 'hourglass_top' : 'check_circle'}</span>{isFulfilling ? 'Processing...' : 'Delivered'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenShopifyOrderPage(selectedOrder); }} className="flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-md text-sm font-medium transition">
                        <span className="material-symbols-outlined text-[18px]">shoppingmode</span>Shopify
                      </button>
                    </div>
                  </div>

                </div>

                {/* Mobile Fixed Footer - Delivery actions only */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-700 p-3 border-t border-gray-400 shadow-lg">
                  <div className="flex flex-row gap-2">
                    <button
                      className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2 flex-1 border-blue-500 border"
                      onClick={(e) => { e.stopPropagation(); handleSendDeliveryMessage(selectedOrder); }}
                    >
                      <span className="material-symbols-outlined text-[20px]">chat</span>
                      <span className="font-medium text-sm">Delivery Msg</span>
                    </button>
                    <button
                      className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center justify-center gap-2 flex-1 border-gray-500 border"
                      onClick={(e) => { e.stopPropagation(); handleMarkDelivered(selectedOrder); }}
                      disabled={isFulfilling}
                    >
                      <span className="material-symbols-outlined text-[20px]">{isFulfilling ? 'hourglass_top' : 'check_circle'}</span>
                      <span className="font-medium text-sm">{isFulfilling ? '...' : 'Delivered'}</span>
                    </button>
                  </div>
                </div>
              </div>
              )}

              {/* TAB 1: Details */}
              {activeModalTab === "details" && (
              <div className="flex-1 overflow-hidden p-0">
                <div className={`flex flex-col md:flex-row h-full overflow-hidden overflow-y-auto`}>

                  {/* LEFT PANEL: Split into Inputs (left) + PDF Preview (right) */}
                  <div className="w-full md:w-2/3 p-4 md:p-5 md:overflow-y-auto md:border-r border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col-reverse md:flex-row gap-4 h-full">

                      {/* Left half: Input Fields */}
                      <div className="w-full md:w-1/2 flex flex-col gap-3">

                        {/* Section Title */}
                        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest border-b border-gray-700 pb-1">Card Fields</h3>

                        {/* Bulk Actions - at top */}
                        <div className="flex gap-2">
                          <button onClick={() => handleRestoreAllFields(selectedOrder)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm font-medium transition" title="Restore All">
                            <span className="material-symbols-outlined text-[18px]">restore</span>Restore All
                          </button>
                          <button onClick={() => handleSaveAllFields(selectedOrder)} disabled={isMilestoneDateInSync(selectedOrder) && isStoryTitleInSync(selectedOrder) && isDedicationLineInSync(selectedOrder)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition disabled:opacity-40" title="Save All">
                            <span className="material-symbols-outlined text-[18px]">save</span>Save All
                          </button>
                        </div>

                        {/* Milestone Date */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Milestone Date</label>
                          <input
                                type="text"
                                id="milestone-date"
                                value={milestoneDates[selectedOrder.id] || ""}
                                onChange={(e) => setMilestoneDates((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-md border text-sm dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${isMilestoneDateInSync(selectedOrder) ? "border-green-500" : "border-gray-500 dark:text-gray-100"}`}
                                placeholder="Enter milestone date"
                              />
                              <div className="flex gap-1.5 mt-1.5">
                                <button onClick={() => copyToClipboard(milestoneDates[selectedOrder.id] || "")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition" title="Copy"><span className="material-symbols-outlined text-[16px]">content_copy</span>Copy</button>
                                <button onClick={() => {
                                  const stType = selectedOrder.line_items[0].properties.find((p) => p.name === "story-type");
                                  if (stType?.value === "mother") {
                                    const lang = selectedOrder.line_items[0].properties.find((p) => p.name === "story-language")?.value || "en";
                                    const val = lang === "ar" ? "قصّة أمّ" : lang === "fr" ? "L'histoire d'une mère" : "A Mother's Story";
                                    setMilestoneDates((prev) => ({ ...prev, [selectedOrder.id]: val }));
                                  } else {
                                    const names = ["milestone_date", "milestone date", "milestone-date"];
                                    let val = "";
                                    for (const n of names) { const p = selectedOrder.line_items[0].properties.find((pr) => pr.name === n); if (p?.value) { val = p.value; break; } }
                                    setMilestoneDates((prev) => ({ ...prev, [selectedOrder.id]: val }));
                                  }
                                }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white text-xs transition" title="Load from order"><span className="material-symbols-outlined text-[16px]">restore</span>Load</button>
                                <button onClick={() => handleSaveMilestoneDate(selectedOrder.id, milestoneDates[selectedOrder.id] || "")} disabled={isMilestoneDateInSync(selectedOrder)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs transition disabled:opacity-40" title="Save"><span className="material-symbols-outlined text-[16px]">save</span>Save</button>
                              </div>
                        </div>

                        {/* Story Title */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Story Title</label>
                          <textarea
                                id="story-title"
                                value={storyTitles[selectedOrder.id] || ""}
                                onChange={(e) => setStoryTitles((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-md border text-sm dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${isStoryTitleInSync(selectedOrder) ? "border-green-500" : "border-gray-500 dark:text-gray-100"}`}
                                placeholder="Enter story title"
                                rows={2}
                                style={{ resize: "vertical", minHeight: "56px" }}
                              />
                              <div className="flex gap-1.5 mt-1.5">
                                <button onClick={() => copyToClipboard(storyTitles[selectedOrder.id] || "")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition" title="Copy"><span className="material-symbols-outlined text-[16px]">content_copy</span>Copy</button>
                                <button onClick={() => {
                                  const stType = selectedOrder.line_items[0].properties.find((p) => p.name === "story-type");
                                  if (stType?.value === "mother") {
                                    const val = selectedOrder.line_items[0].properties.find((p) => p.name === "mom_name")?.value || "";
                                    setStoryTitles((prev) => ({ ...prev, [selectedOrder.id]: val }));
                                  } else {
                                    const val = selectedOrder.line_items[0].properties.find((p) => p.name === "title")?.value || "";
                                    setStoryTitles((prev) => ({ ...prev, [selectedOrder.id]: val }));
                                  }
                                }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white text-xs transition" title="Load from order"><span className="material-symbols-outlined text-[16px]">restore</span>Load</button>
                                <button onClick={() => handleSaveStoryTitle(selectedOrder.id, storyTitles[selectedOrder.id] || "")} disabled={isStoryTitleInSync(selectedOrder)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs transition disabled:opacity-40" title="Save"><span className="material-symbols-outlined text-[16px]">save</span>Save</button>
                              </div>
                        </div>

                        {/* Dedication Line */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Dedication Line</label>
                          <textarea
                                id="dedication-line"
                                value={dedicationLines[selectedOrder.id] || ""}
                                onChange={(e) => setDedicationLines((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-md border text-sm dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${isDedicationLineInSync(selectedOrder) ? "border-green-500" : "border-gray-500 dark:text-gray-100"}`}
                                placeholder="Enter dedication line"
                                rows={2}
                                style={{ resize: "vertical", minHeight: "56px" }}
                              />
                              <div className="flex gap-1.5 mt-1.5">
                                <button onClick={() => copyToClipboard(dedicationLines[selectedOrder.id] || "")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition" title="Copy"><span className="material-symbols-outlined text-[16px]">content_copy</span>Copy</button>
                                <button onClick={() => {
                                  const stType = selectedOrder.line_items[0].properties.find((p) => p.name === "story-type");
                                  if (stType?.value === "mother") {
                                    const kn = selectedOrder.line_items[0].properties.find((p) => p.name === "kids_name")?.value || "";
                                    setDedicationLines((prev) => ({ ...prev, [selectedOrder.id]: kn ? `By ${kn}` : "" }));
                                  } else {
                                    let val = selectedOrder.line_items[0].properties.find((p) => p.name === "dedication_line")?.value || "";
                                    if (!val) {
                                      const tn = selectedOrder.line_items[0].properties.find((p) => p.name === "their_name")?.value || "";
                                      const yn = selectedOrder.line_items[0].properties.find((p) => p.name === "your_name")?.value || "";
                                      if (tn && yn) val = `For ${tn}, By ${yn}`;
                                    }
                                    setDedicationLines((prev) => ({ ...prev, [selectedOrder.id]: val }));
                                  }
                                }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-600 hover:bg-gray-500 text-gray-300 hover:text-white text-xs transition" title="Load from order"><span className="material-symbols-outlined text-[16px]">restore</span>Load</button>
                                <button onClick={() => handleSaveDedicationLine(selectedOrder.id, dedicationLines[selectedOrder.id] || "")} disabled={isDedicationLineInSync(selectedOrder)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs transition disabled:opacity-40" title="Save"><span className="material-symbols-outlined text-[16px]">save</span>Save</button>
                              </div>
                        </div>

                        {/* Subdomain */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Subdomain</label>
                          <div className="flex gap-2 items-center">
                            <input type="text" value={subdomainValue(selectedOrder)} disabled className="flex-1 px-3 py-2 rounded-md border border-gray-600 text-sm dark:bg-gray-700 dark:text-gray-300 opacity-75" />
                            <button onClick={() => copyToClipboard(subdomainValue(selectedOrder) || "")} className="flex items-center gap-1 px-2.5 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition" title="Copy"><span className="material-symbols-outlined text-[16px]">content_copy</span></button>
                            <button onClick={() => handleGenerateQRCode(subdomainValue(selectedOrder))} disabled={!subdomainValue(selectedOrder)} className="flex items-center gap-1 px-2.5 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition disabled:opacity-40" title="Generate QR"><span className="material-symbols-outlined text-[16px]">qr_code</span></button>
                          </div>
                        </div>

                      </div>

                      {/* Right half: PDF Preview */}
                      <div className="w-full md:w-1/2 flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest border-b border-gray-700 pb-1">Card Preview</h3>
                        <TwoFramesPreview
                          ref={cardPreviewRef}
                          milestoneDate={milestoneDates[selectedOrder.id]}
                          title={storyTitles[selectedOrder.id]}
                          dedicationLine={dedicationLines[selectedOrder.id]}
                          qr={generatedQRCodes[selectedOrder.id]}
                          subdomain={subdomainValue(selectedOrder)}
                          onSendCardPreview={handleSendCardPreview}
                          onSendToPrinter={handleSendToPrinter}
                          orderName={selectedOrder.name}
                          cardQuantity={getCardQuantityFromVariant(selectedOrder.line_items[0]?.variant_title || '')}
                        />
                      </div>

                    </div>
                  </div>

                  {/* RIGHT PANEL: Customer, Actions, Properties */}
                  <div className="w-full md:w-1/3 md:overflow-y-auto p-4 md:p-5 flex flex-col gap-4 md:pb-6 pb-44">

                    {/* Customer Info + WhatsApp + Quick Links */}
                    <div className="flex flex-wrap items-center gap-3 text-gray-800 dark:text-gray-300">
                      <div className="flex flex-col">
                        <span className="font-bold text-base">{selectedOrder?.shipping_address?.first_name} {selectedOrder?.shipping_address?.last_name}</span>
                        {selectedOrder?.shipping_address?.city && <span className="text-xs text-gray-500">{selectedOrder.shipping_address.city}</span>}
                      </div>
                      <a href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)))} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline text-sm">{getPhoneNumber(selectedOrder) || "N/A"}</a>
                      <div className="flex gap-1.5 ml-auto">
                        <a href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)), `Hello ${selectedOrder?.shipping_address?.first_name}`)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Quick Hello"><span className="material-symbols-outlined text-[22px]">waving_hand</span></a>
                        <a href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)), `Hello ${selectedOrder?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Thank You"><span className="material-symbols-outlined text-[22px]">volunteer_activism</span></a>
                        {selectedOrder.metafields?.some((mf) => mf.namespace === "custom" && mf.key === "story-url") && (
                          <button onClick={(e) => { e.stopPropagation(); handleSendPreviewLink(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Send Preview Link"><span className="material-symbols-outlined text-[22px]">Draft</span></button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleOpenShopifyOrderPage(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded-md bg-purple-700 hover:bg-purple-600 text-white transition" title="View in Shopify"><span className="material-symbols-outlined text-[22px]">shoppingmode</span></button>
                      </div>
                    </div>

                    {/* Action Buttons - grouped logically */}
                    <div className="hidden md:flex flex-wrap gap-1.5">
                      {/* Story & Data */}
                      <button onClick={(e) => { e.stopPropagation(); handleCopyProperties(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Copy Properties"><span className="material-symbols-outlined text-[22px]">content_copy</span></button>
                      <button className={`flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 transition ${loadingOrders2[selectedOrder.id] ? "text-gray-500 cursor-not-allowed" : "text-blue-400 hover:text-blue-300"}`} onClick={(e) => { e.stopPropagation(); handleDownloadImagesAsZip(selectedOrder); }} disabled={loadingOrders2[selectedOrder.id]} title="Download ZIP">{loadingOrders2[selectedOrder.id] ? <span className="material-symbols-outlined text-[22px]">downloading</span> : <span className="material-symbols-outlined text-[22px]">download</span>}</button>
                      <button className={`flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 transition ${loadingOrders[selectedOrder.id] ? "text-gray-500 cursor-not-allowed" : "text-green-400 hover:text-green-300"}`} onClick={(e) => { e.stopPropagation(); handleProcessAndUploadImages(selectedOrder); }} disabled={loadingOrders[selectedOrder.id]} title="Upload Images">{loadingOrders[selectedOrder.id] ? <span className="material-symbols-outlined text-[22px] animate-spin">autorenew</span> : <span className="material-symbols-outlined text-[22px]">cloud_upload</span>}</button>
                      <button className={`flex items-center justify-center w-10 h-10 rounded transition ${selectedOrder.metafields?.some((mf) => mf.namespace === "custom" && mf.key === "story-photos") ? "bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white" : "bg-gray-700 text-gray-500 opacity-50"}`} onClick={(e) => { e.stopPropagation(); handleCopyStoryPhotosJSON(selectedOrder); }} disabled={!selectedOrder.metafields?.some((mf) => mf.namespace === "custom" && mf.key === "story-photos")} title="Copy Images JSON"><span className="material-symbols-outlined text-[22px]">photo_library</span></button>
                      <div className="w-px h-10 bg-gray-600 mx-0.5"></div>
                      {/* Links */}
                      <button onClick={(e) => { e.stopPropagation(); handleCopyPasswordAndOpenSubdomain(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Open Story"><span className="material-symbols-outlined text-[22px]">language</span></button>
                      <button onClick={(e) => { e.stopPropagation(); handleCopySubdomainAndOpenLocalhost(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Open Localhost"><span className="material-symbols-outlined text-[22px]">dns</span></button>
                      <div className="w-px h-10 bg-gray-600 mx-0.5"></div>
                      {/* Order Management */}
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicateDraftOrder(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Duplicate Draft"><span className="material-symbols-outlined text-[22px]">move_group</span></button>
                      <button onClick={(e) => { e.stopPropagation(); handleCreateDirectOrder(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition" title="Create Order"><span className="material-symbols-outlined text-[22px]">add_shopping_cart</span></button>
                      <button onClick={(e) => { e.stopPropagation(); handleAddCustomItem(selectedOrder); }} className="flex items-center justify-center w-10 h-10 rounded bg-green-700 hover:bg-green-600 text-white transition" title="Add Item"><span className="material-symbols-outlined text-[22px]">add</span></button>
                    </div>

                    {/* Progress indicators */}
                    {downloadProgress[selectedOrder.id] && <div className="text-xs text-gray-300">Downloading {downloadProgress[selectedOrder.id].current}/{downloadProgress[selectedOrder.id].total}</div>}

                    {/* Line Items */}
                    <div className="flex flex-col gap-1">
                      {selectedOrder.line_items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <button onClick={(e) => { e.stopPropagation(); handleRemoveCustomItem(selectedOrder, item.id); }} className="flex items-center justify-center w-6 h-6 rounded bg-red-700 hover:bg-red-600 text-white transition" title="Remove"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                          <span>{item.title} - ${item.price}</span>
                        </div>
                      ))}
                    </div>

                    {/* Original View Image */}
                    {selectedOrder.line_items[0].properties.filter((prop) => ["_original_view_2"].includes(prop.name)).map((prop, index) => !!prop.value ? (
                      <Image key={`original-view-${index}`} src={prop.value} alt={prop.value} width={200} height={200} className="rounded m-auto w-auto h-auto" />
                    ) : null)}

                    {/* Order Properties List */}
                    <div className="text-center font-bold bg-black text-white p-2 rounded text-sm">ORDER PROPERTIES</div>
                    {selectedOrder && selectedOrder.line_items[0].properties
                      .filter(
                        (prop) =>
                          ![
                            "_cl_options",
                            "_cl_options_id",
                            "_cl_options_price",
                            "_original_view_2"
                          ].includes(prop.name)
                      )
                      .map((prop) => {
                        // Regular expression to test for common image extensions
                        const imageRegex = /\.(jpeg|jpg|gif|png|bmp|svg)$/i;
                        const isImage = imageRegex.test(prop.value);
                        const isValidURL = /^https?:\/\/\S+$/.test(prop.value);

                        return (
                          <div key={prop.name} className="mb-4">
                            <b>{prop.name}:</b>
                            <br />
                            {isImage ? (
                              <Image
                                src={prop.value}
                                alt={prop.name}
                                width={150}
                                height={150}
                                className="rounded object-contain w-auto h-auto"
                              />
                            ) : isValidURL ? (
                              <a
                                href={prop.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 underline"
                              >
                                {prop.value}
                              </a>
                            ) : (
                              <span className="text-gray-400">{prop.value}</span>
                            )}
                            <hr className="mt-2 opacity-25" />
                          </div>
                        );
                      })}
                  </div>

                  {/* Mobile Fixed Footer - Subdomain + NFC */}
                  <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-700 p-3 border-t border-gray-400 shadow-lg">
                    <div className="flex flex-row gap-2">
                      <div className="flex-1">
                        <div className="p-2.5 rounded bg-gray-800 text-white text-sm font-medium truncate border border-gray-500">{subdomainValue(selectedOrder)}</div>
                      </div>
                      <button
                        className="p-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md flex items-center justify-center gap-1.5 flex-1 border-gray-500 border"
                        onClick={(e) => { e.stopPropagation(); setIsSubdomainCheckOpen(true); }}
                        title="Write URL to NFC Tag"
                      >
                        <span className="material-symbols-outlined text-[20px]">nfc</span>
                        <span className="font-medium text-sm">Prepare NFC</span>
                      </button>
                    </div>
                  </div>
                  <div className="md:hidden h-16 mb-2"></div>

                </div>
              </div>
              )}

              {/* TAB 2: Story */}
              {activeModalTab === "story" && (
              <div className="flex-1 overflow-hidden p-0 flex flex-col">
                <div className="flex flex-col md:flex-row gap-4 flex-1 p-4 md:p-6 overflow-hidden">
                  {/* Left side - Clipboard Content */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <h6 className="text-sm font-light mb-2 dark:text-white">Order Properties</h6>
                    <div className="relative flex-grow">
                      <div className="absolute top-0 right-0 bg-gray-200 dark:bg-gray-600 px-2 py-1 text-xs font-semibold rounded-bl z-10">markdown</div>
                      <textarea
                        className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded resize-none"
                        value={clipboardContent}
                        onChange={(e) => setClipboardContent(e.target.value)}
                        readOnly={false}
                        placeholder="# Order Properties&#10;&#10;Paste or edit order properties here..."
                      ></textarea>
                    </div>
                  </div>

                  {/* Right side - Generated Story */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <h6 className="text-sm font-light mb-2 dark:text-white">Generated Story</h6>
                    <div className="relative flex-grow">
                      <div className="absolute top-0 right-0 bg-gray-200 dark:bg-gray-600 px-2 py-1 text-xs font-semibold rounded-bl z-10">typescript</div>
                      {isGeneratingStory && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-30">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                            <span className="text-white">Generating story...</span>
                          </div>
                        </div>
                      )}
                      <textarea
                        className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded resize-none"
                        value={generatedStory}
                        onChange={(e) => setGeneratedStory(e.target.value)}
                        readOnly={false}
                        placeholder="// Generated TypeScript will appear here..."
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end px-4 md:px-6 pb-4 gap-2">
                  <button
                    onClick={() => {
                      setIsGeneratingStory(true);
                      fetch('/api/generate-story', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          assistantId: 'asst_ndvTXfavraW5WZsIsr7Sj7BB',
                          content: clipboardContent
                        }),
                      })
                        .then(response => response.json())
                        .then(data => {
                          setGeneratedStory(data.story || 'Failed to generate story');
                          setIsGeneratingStory(false);
                        })
                        .catch(error => {
                          console.error('Error generating story:', error);
                          setGeneratedStory('Error: ' + error.message);
                          setIsGeneratingStory(false);
                          toast.error('Failed to generate story');
                        });
                    }}
                    disabled={isGeneratingStory}
                    className={`px-4 py-2 rounded ${isGeneratingStory ? 'bg-gray-500' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                  >
                    {isGeneratingStory ? 'Generating...' : 'Generate Story'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedStory).then(
                        () => toast.success('Story copied to clipboard', { autoClose: 2000 }),
                        () => toast.error('Failed to copy story', { autoClose: 2000 })
                      );
                    }}
                    disabled={!generatedStory}
                    className={`px-4 py-2 rounded ${!generatedStory ? 'bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                  >
                    Copy Story
                  </button>
                </div>
              </div>
              )}

              {/* TAB 3: Images */}
              {activeModalTab === "images" && (
              <div className="flex-1 overflow-hidden p-0">
                <div className="h-full overflow-y-auto p-4 md:p-6">
                  {/* Process & Upload from Shopify */}
                  <div className="mb-4">
                    <button
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition ${loadingOrders[selectedOrder.id] ? "bg-gray-600 text-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 text-white"}`}
                      onClick={() => handleProcessAndUploadImages(selectedOrder)}
                      disabled={loadingOrders[selectedOrder.id]}
                    >
                      {loadingOrders[selectedOrder.id] ? (
                        <span className="material-symbols-outlined text-[20px] animate-spin">autorenew</span>
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                      )}
                      {loadingOrders[selectedOrder.id] ? "Uploading..." : "Process & Upload Story Images"}
                    </button>
                    {uploadProgress[selectedOrder.id] && (
                      <div className="text-xs text-gray-400 mt-1">Uploading {uploadProgress[selectedOrder.id].current}/{uploadProgress[selectedOrder.id].total}</div>
                    )}
                  </div>

                  {/* Existing Cloudinary Images */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Uploaded Images (story-photos)</h3>
                    {(() => {
                      const storyPhotosMetafield = selectedOrder.metafields?.find(
                        (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                      );
                      if (!storyPhotosMetafield) {
                        return <p className="text-gray-400 text-sm">No images uploaded yet. Use "Process & Upload" from the Details tab or upload below.</p>;
                      }
                      try {
                        const photoUrls = JSON.parse(storyPhotosMetafield.value);
                        if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
                          return <p className="text-gray-400 text-sm">No images found in story-photos.</p>;
                        }
                        return (
                          <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
                            {photoUrls.map((url, index) => (
                              <div
                                key={index}
                                className="relative group cursor-pointer rounded overflow-hidden border border-gray-600 hover:border-blue-500 transition-colors"
                                onClick={() => {
                                  navigator.clipboard.writeText(url).then(
                                    () => toast.success(`Image ${index + 1} URL copied!`, { autoClose: 1500 }),
                                    () => toast.error('Failed to copy URL')
                                  );
                                }}
                                title="Click to copy image URL"
                              >
                                <img
                                  src={url}
                                  alt={`Photo ${index + 1}`}
                                  className="w-full aspect-square object-cover"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center transition-all">
                                  <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    content_copy
                                  </span>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs text-center py-0.5">
                                  {index + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      } catch (e) {
                        return <p className="text-red-400 text-sm">Error parsing story-photos JSON.</p>;
                      }
                    })()}

                    {/* Copy All URLs button */}
                    {selectedOrder.metafields?.some(
                      (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                    ) && (
                      <button
                        onClick={() => handleCopyStoryPhotosJSON(selectedOrder)}
                        className="mt-3 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                        Copy All URLs as JSON
                      </button>
                    )}
                  </div>

                  <hr className="border-gray-600 mb-6" />

                  {/* Upload Additional Images */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Upload Additional Images</h3>
                    <ImageUploadModal
                      isOpen={true}
                      onClose={() => {}}
                      inline={true}
                      orderName={selectedOrder.name}
                      onUploadComplete={(newUrls) => {
                        // Merge new URLs with existing story-photos and save
                        const storyPhotosMetafield = selectedOrder.metafields?.find(
                          (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                        );
                        let existingUrls = [];
                        if (storyPhotosMetafield) {
                          try { existingUrls = JSON.parse(storyPhotosMetafield.value); } catch (e) {}
                        }
                        const mergedUrls = [...existingUrls, ...newUrls];
                        const mergedJson = JSON.stringify(mergedUrls);
                        // Update selectedOrder locally so thumbnails refresh immediately
                        const updatedMetafields = storyPhotosMetafield
                          ? selectedOrder.metafields.map((mf) =>
                              mf.namespace === "custom" && mf.key === "story-photos"
                                ? { ...mf, value: mergedJson }
                                : mf
                            )
                          : [...(selectedOrder.metafields || []), { namespace: "custom", key: "story-photos", value: mergedJson }];
                        setSelectedOrder({ ...selectedOrder, metafields: updatedMetafields });

                        saveMetafieldAPI(selectedOrder.id, "story-photos", "json_string", mergedJson)
                          .then(() => {
                            toast.success('Images added to story-photos!');
                            fetchOrders(limit);
                          })
                          .catch((err) => {
                            console.error('Error saving merged photos:', err);
                            toast.error('Failed to save images to metafield');
                          });
                      }}
                    />
                  </div>
                </div>
              </div>
              )}

            </div>
          </div>
        </div>
      )}

      {isCameraOpen && (
        // Backdrop for QR Scanner
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* QR Scanner Container */}
            <div className="relative bg-white dark:bg-gray-800 p-5 rounded-md shadow-xl border border-gray-300 dark:border-gray-600">
              <p className="mb-4 text-center text-gray-900 dark:text-white font-medium text-lg">Scan order label QR Code</p>

              {/* QR Scanner with better support for all QR code types */}
              <div className="relative border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden" style={{ width: '300px', height: '300px' }}>
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{ facingMode: 'environment' }}
                  scanDelay={300}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsCameraOpen(false)}
              className="w-full p-4 mt-3 bg-gray-900 text-white font-medium text-lg rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              title="Close Scanner"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Delivery Scan Modal */}
      {isDeliveryScanOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* QR Scanner Container */}
            <div className="relative bg-white dark:bg-gray-800 p-5 rounded-md shadow-xl border border-gray-300 dark:border-gray-600">
              <p className="mb-4 text-center text-gray-900 dark:text-white font-medium text-lg">
                {scanStatus === "ready" ? "Scan label to mark as Ready for Delivery" :
                  scanStatus === "loading" ? `Processing Order ${currentScanOrder?.name || ''}...` :
                    scanStatus === "success" ? `Order ${currentScanOrder?.name || ''} marked as Ready for Delivery` :
                      `Error: ${currentScanOrder?.error || 'Unknown error'}`}
              </p>

              {/* Status Indicator */}
              {scanStatus !== "ready" && (
                <div className={`mb-4 p-3 rounded-md text-center font-medium ${scanStatus === "loading" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                  scanStatus === "success" ? "bg-green-100 text-green-800 border border-green-200" :
                    "bg-red-100 text-red-800 border border-red-200"}`}>
                  {scanStatus === "loading" && "Updating order status..."}
                  {scanStatus === "success" && "Success! Ready for next scan..."}
                  {scanStatus === "error" && "Error! Try again..."}
                </div>
              )}

              {/* QR Scanner for delivery status */}
              <div className="relative border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden" style={{ width: '300px', height: '300px' }}>
                <Scanner
                  onScan={handleDeliveryScan}
                  onError={handleDeliveryError}
                  constraints={{ facingMode: 'environment' }}
                  scanDelay={300}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsDeliveryScanOpen(false)}
              className="w-full p-4 mt-3 bg-gray-900 text-white font-medium text-lg rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              title="Close Scanner"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Delivery Provider Selection Modal */}
      {showDeliveryProviderSelect && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">Select Delivery Provider</h3>
            <div className="flex flex-col gap-3">
              {['WAKILNI', 'UNIPARCEL', 'ROADRUNNER', 'OSSDRIVER'].map((provider) => (
                <button
                  key={provider}
                  onClick={() => {
                    setSelectedDeliveryProvider(provider);
                    setShowDeliveryProviderSelect(false);
                    setIsSentForDeliveryScanOpen(true);
                  }}
                  className="p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-md font-bold text-lg transition-colors"
                >
                  {provider}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDeliveryProviderSelect(false)}
              className="w-full mt-4 p-3 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-md font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sent for Delivery Scan Modal */}
      {isSentForDeliveryScanOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          <div className="flex flex-col items-center">
            {/* QR Scanner Container */}
            <div className="relative bg-white dark:bg-gray-800 p-5 rounded-md shadow-xl border border-gray-300 dark:border-gray-600">
              {/* Provider Badge */}
              {selectedDeliveryProvider && (
                <div className="mb-3 text-center">
                  <span className="inline-block px-4 py-1.5 bg-orange-600 text-white rounded-full font-bold text-sm">{selectedDeliveryProvider}</span>
                </div>
              )}

              <p className="mb-4 text-center text-gray-900 dark:text-white font-medium text-lg">
                {scanStatus === "ready" ? "Scan label to mark as Sent for Delivery" :
                  scanStatus === "loading" ? `Processing Order ${currentScanOrder?.name || ''}...` :
                    scanStatus === "success" ? `Order ${currentScanOrder?.name || ''} marked as Sent for Delivery` :
                      `Error: ${currentScanOrder?.error || 'Unknown error'}`}
              </p>

              {/* Status Indicator */}
              {scanStatus !== "ready" && (
                <div className={`mb-4 p-3 rounded-md text-center font-medium ${scanStatus === "loading" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                  scanStatus === "success" ? "bg-orange-100 text-orange-800 border border-orange-200" :
                    "bg-red-100 text-red-800 border border-red-200"}`}>
                  {scanStatus === "loading" && "Updating order status..."}
                  {scanStatus === "success" && "Success! Ready for next scan..."}
                  {scanStatus === "error" && "Error! Try again..."}
                </div>
              )}

              {/* QR Scanner */}
              <div className="relative border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden" style={{ width: '300px', height: '300px' }}>
                <Scanner
                  onScan={handleSentForDeliveryScan}
                  onError={handleSentForDeliveryError}
                  constraints={{ facingMode: 'environment' }}
                  scanDelay={300}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => { setIsSentForDeliveryScanOpen(false); setSelectedDeliveryProvider(null); }}
              className="w-full p-4 mt-3 bg-gray-900 text-white font-medium text-lg rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              title="Close Scanner"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Fulfill Order Confirmation Modal */}
      {showFulfillConfirmation && orderToFulfill && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Confirm Delivery</h3>

            <div className="mb-6 text-gray-700 dark:text-gray-300">
              <p className="mb-4">Are you sure you want to mark this order as <strong>delivered</strong>? This will fulfill the order, mark it as paid, and add a DELIVERED tag in Shopify.</p>

              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md mb-4">
                <p className="font-medium mb-2">Order Details:</p>
                <p><span className="font-medium">Order:</span> {orderToFulfill.name}</p>
                <p><span className="font-medium">Customer:</span> {orderToFulfill?.shipping_address?.first_name} {orderToFulfill?.shipping_address?.last_name}</p>
                <div className="mt-3 border-t border-gray-200 dark:border-gray-600 pt-3">
                  <p className="font-medium">Payment Breakdown:</p>
                  <p><span className="font-medium">Items:</span> {orderToFulfill.currencyCode} {orderToFulfill.subtotalPriceSet?.shopMoney?.amount || '0.00'}</p>
                  <p><span className="font-medium">Shipping:</span> {orderToFulfill.currencyCode} {orderToFulfill.shipping_lines?.[0]?.price || '0.00'}</p>
                </div>

                {/* Prominent Total Amount */}
                <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">TOTAL TO COLLECT</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-1">
                    {orderToFulfill.currencyCode} {orderToFulfill.totalPriceSet?.shopMoney?.amount || orderToFulfill.total_price}
                  </p>
                </div>
              </div>

              <p className="text-sm text-red-500">This action cannot be undone!</p>
            </div>

            <div className="flex w-full mt-6 gap-3">
              <button
                className="w-1/2 py-3 bg-gray-300 hover:bg-gray-400 text-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                onClick={() => setShowFulfillConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="w-1/2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors flex items-center justify-center gap-2 font-medium"
                onClick={confirmFulfillOrder}
                disabled={isFulfilling}
              >
                {isFulfilling ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">check_circle</span>
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


{isSubdomainCheckOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="relative bg-white dark:bg-gray-800 p-5 rounded-md shadow-xl border border-gray-300 dark:border-gray-600">
              <p className="mb-4 text-center text-gray-900 dark:text-white font-medium text-lg">Scan QR Code to Compare Subdomain</p>

              {/* QR Scanner with better support for all QR code types */}
              <div className="relative border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden" style={{ width: '300px', height: '300px' }}>
                {/* Only render the Scanner component when it's actively needed */}
                <Scanner
                  onScan={handleSubdomainScan}
                  onError={handleSubdomainError}
                  constraints={{ facingMode: 'environment' }}
                  scanDelay={300}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              </div>

              {/* Scan Again button - only shown when scanner is paused */}
              {isScannerPaused && (
                <button
                  onClick={() => setIsScannerPaused(false)}
                  className="w-full p-3 mt-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors border-gray-400 border"
                  title="Scan Again"
                >
                  SCAN AGAIN
                </button>
              )}
            </div>

            <div className="flex w-full gap-3 mt-3">
              {/* Skip Button */}
              <button
                onClick={() => {
                  setIsSubdomainCheckOpen(false);
                  setIsScannerPaused(false);
                  // Reset NFC state and open modal
                  nfcAbortRef.current?.abort();
                  nfcAbortRef.current = null;
                  const currentSubdomain = subdomainValue(selectedOrder);
                  const fullUrl = `https://${currentSubdomain}.ossotna.com`;
                  setNfcUrl(fullUrl);
                  setNfcStep("idle");
                  setNfcWriteAttempts(0);
                  setLastReadUrl("");
                  setNfcVerifyMatch(null);
                  setIsNfcWriteModalOpen(true);
                }}
                className="w-1/2 py-3 bg-blue-700 hover:bg-blue-800 text-white font-medium text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors border-gray-400 border"
                title="Skip to NFC"
              >
                SKIP TO NFC
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  setIsSubdomainCheckOpen(false);
                  setIsScannerPaused(false); // Reset for next time
                }}
                className="w-1/2 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors border-gray-400 border"
                title="Close Scanner"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NFC Writing Modal for Android */}
      {isNfcWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="flex flex-col items-center w-11/12 max-w-md">
            <div className="relative bg-white dark:bg-gray-800 p-6 rounded-md w-full border-gray-400 border">
              <h3 className="text-lg font-medium text-center mb-4 text-gray-900 dark:text-white">Write URL to NFC Tag</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL to write:</label>
                <input
                  type="text"
                  value={nfcUrl}
                  onChange={(e) => setNfcUrl(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={nfcStep !== "idle"}
                />
              </div>

              {/* NFC Status Icon */}
              <div className="flex flex-col items-center justify-center mb-4">
                <div className={`w-24 h-24 mb-4 flex items-center justify-center rounded-full transition-all duration-500 ${
                  nfcStep === "writing" ? 'bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse' :
                  nfcStep === "waitingVerify" ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' :
                  nfcStep === "verifying" ? 'bg-orange-500 shadow-lg shadow-orange-500/50 animate-pulse' :
                  nfcStep === "done" ? (nfcVerifyMatch ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50') :
                  'bg-blue-100 dark:bg-blue-900'
                }`}>
                  <span className={`material-symbols-outlined text-4xl transition-all duration-500 ${
                    nfcStep === "writing" || nfcStep === "verifying" ? 'text-white animate-bounce' :
                    nfcStep === "waitingVerify" ? 'text-white' :
                    nfcStep === "done" ? 'text-white' :
                    'text-blue-600 dark:text-blue-300'
                  }`}>{
                    nfcStep === "done" && nfcVerifyMatch ? 'check_circle' :
                    nfcStep === "done" && !nfcVerifyMatch ? 'error' :
                    nfcStep === "waitingVerify" ? 'contactless' :
                    'nfc'
                  }</span>
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {nfcStep === "idle" && nfcWriteAttempts === 0 && 'Tap the button below to start writing to the NFC tag.'}
                  {nfcStep === "idle" && nfcWriteAttempts > 0 && `Previous verification failed. Retry (Attempt ${nfcWriteAttempts + 1}/3)`}
                  {nfcStep === "writing" && 'Place your phone on the NFC tag to write...'}
                  {nfcStep === "waitingVerify" && 'URL written! Remove the tag, then tap "Verify" and place it back to confirm.'}
                  {nfcStep === "verifying" && 'Place the NFC tag on your phone again to verify...'}
                  {nfcStep === "done" && nfcVerifyMatch && 'Verification successful! The URL was written correctly.'}
                  {nfcStep === "done" && nfcVerifyMatch === false && 'Verification failed — the read URL does not match.'}
                  {nfcStep === "done" && nfcVerifyMatch === null && 'Verification timed out.'}
                </p>
              </div>

              {/* Display the last read URL after verification */}
              {lastReadUrl && (nfcStep === "done" || nfcStep === "waitingVerify") && (
                <div className={`mb-4 p-3 border rounded-md ${nfcVerifyMatch ? 'border-green-400 bg-green-50 dark:bg-green-900/30' : 'border-orange-400 bg-orange-50 dark:bg-orange-900/30'}`}>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Read from tag:</p>
                  <p className="text-sm font-mono break-all text-gray-900 dark:text-gray-100">{lastReadUrl}</p>
                  {nfcVerifyMatch === false && (
                    <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                      <span className="font-medium">Mismatch:</span> Expected {nfcUrl}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {/* Done button — shown after successful verification */}
                {nfcStep === "done" && nfcVerifyMatch && (
                  <button
                    onClick={() => {
                      if (selectedOrder?.id) {
                        saveMetafieldAPI(selectedOrder.id, "story-stage", "single_line_text_field", "Live")
                          .then(() => {
                            setStoryStages((prev) => ({ ...prev, [selectedOrder.id]: "Live" }));
                            console.log("Story stage set to Live after NFC write");
                          })
                          .catch((err) => console.error("Failed to update story stage:", err));
                      }
                      // Abort any lingering NFC operations
                      nfcAbortRef.current?.abort();
                      nfcAbortRef.current = null;
                      setNfcStep("idle");
                      setNfcWriteAttempts(0);
                      setLastReadUrl("");
                      setNfcVerifyMatch(null);
                      setIsNfcWriteModalOpen(false);
                      toast.success("NFC tag programmed successfully!");
                    }}
                    className="w-full p-3 text-white rounded-md font-medium bg-green-600 hover:bg-green-700"
                  >
                    Done
                  </button>
                )}

                {/* Write / Retry button */}
                {(nfcStep === "idle" || (nfcStep === "done" && !nfcVerifyMatch)) && (
                  <button
                    onClick={() => {
                      if (!('NDEFReader' in window)) {
                        toast.error("NFC is not supported on this device or browser.");
                        return;
                      }
                      try {
                        // Abort previous session
                        nfcAbortRef.current?.abort();
                        const ac = new AbortController();
                        nfcAbortRef.current = ac;

                        setNfcStep("writing");
                        setLastReadUrl("");
                        setNfcVerifyMatch(null);

                        const ndef = new (window as any).NDEFReader();
                        let urlToWrite = nfcUrlRef.current;
                        if (!urlToWrite.startsWith('https://') && !urlToWrite.startsWith('http://')) {
                          urlToWrite = 'https://' + urlToWrite;
                        }
                        console.log("NFC write: starting scan for tag, URL:", urlToWrite);

                        ndef.scan({ signal: ac.signal }).then(() => {
                          ndef.addEventListener('reading', () => {
                            console.log("NFC write: tag detected, writing...");
                            ndef.write({ records: [{ recordType: "url", data: urlToWrite }] })
                              .then(() => {
                                console.log("NFC write: success");
                                // Abort the write scan session so it doesn't interfere with verification
                                ac.abort();
                                toast.success("URL written to tag! Remove the tag.");
                                setNfcStep("waitingVerify");
                              })
                              .catch((err) => {
                                console.error("NFC write failed:", err);
                                toast.error("Failed to write to NFC tag.");
                                setNfcWriteAttempts((a) => a + 1);
                                setNfcStep("idle");
                              });
                          }, { once: true, signal: ac.signal });

                          // Timeout: 30s
                          setTimeout(() => {
                            if (nfcAbortRef.current === ac && !ac.signal.aborted) {
                              ac.abort();
                              setNfcStep((prev) => prev === "writing" ? "idle" : prev);
                              toast.error("NFC timed out. Try again.");
                            }
                          }, 30000);
                        }).catch((err) => {
                          console.error("NFC scan error:", err);
                          if (!ac.signal.aborted) {
                            toast.error("NFC error: " + (err?.message || "Unknown"));
                            setNfcStep("idle");
                          }
                        });
                      } catch (err: any) {
                        console.error("NFC error:", err);
                        toast.error("NFC error: " + err.message);
                        setNfcStep("idle");
                      }
                    }}
                    className={`border-gray-400 border w-full p-3 text-white rounded-md font-medium transition-all duration-300 ${nfcWriteAttempts > 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {nfcWriteAttempts > 0 ? `Retry Writing (Attempt ${nfcWriteAttempts + 1})` : 'Start NFC Writing'}
                  </button>
                )}

                {/* Verify button — shown after write success, user must re-tap */}
                {nfcStep === "waitingVerify" && (
                  <button
                    onClick={() => {
                      if (!('NDEFReader' in window)) {
                        toast.error("NFC is not supported.");
                        return;
                      }
                      try {
                        nfcAbortRef.current?.abort();
                        const ac = new AbortController();
                        nfcAbortRef.current = ac;

                        setNfcStep("verifying");
                        const ndef = new (window as any).NDEFReader();
                        console.log("NFC verify: starting scan to read back...");

                        ndef.scan({ signal: ac.signal }).then(() => {
                          ndef.addEventListener('reading', ({ message }) => {
                            let readUrl = "";
                            for (const record of message.records) {
                              if (record.recordType === "url") {
                                readUrl = new TextDecoder().decode(record.data);
                                break;
                              }
                              if (record.recordType === "text") {
                                readUrl = new TextDecoder().decode(record.data);
                                break;
                              }
                            }
                            console.log("NFC verify: read URL:", readUrl);
                            setLastReadUrl(readUrl);

                            const expected = nfcUrlRef.current;
                            const match = readUrl.replace(/\/$/, '').toLowerCase() === expected.replace(/\/$/, '').toLowerCase();
                            setNfcVerifyMatch(match);
                            setNfcStep("done");
                            if (match) {
                              toast.success("Verification passed!");
                            } else {
                              toast.error("URL mismatch! Check the tag.");
                              setNfcWriteAttempts((a) => a + 1);
                            }
                            ac.abort();
                          }, { once: true, signal: ac.signal });

                          // Timeout: 30s
                          setTimeout(() => {
                            if (nfcAbortRef.current === ac && !ac.signal.aborted) {
                              ac.abort();
                              setNfcVerifyMatch(null);
                              setNfcStep("done");
                              toast.error("Verification timed out. You can retry or close.");
                            }
                          }, 30000);
                        }).catch((err) => {
                          console.error("NFC verify scan error:", err);
                          if (!ac.signal.aborted) {
                            toast.error("NFC error: " + (err?.message || "Unknown"));
                            setNfcStep("waitingVerify");
                          }
                        });
                      } catch (err: any) {
                        console.error("NFC verify error:", err);
                        toast.error("NFC error: " + err.message);
                        setNfcStep("waitingVerify");
                      }
                    }}
                    className="border-gray-400 border w-full p-3 text-white rounded-md font-medium bg-yellow-600 hover:bg-yellow-700"
                  >
                    Verify — Place Tag on Phone
                  </button>
                )}

                {/* Busy indicator for writing/verifying */}
                {(nfcStep === "writing" || nfcStep === "verifying") && (
                  <div className="w-full p-3 text-center text-gray-400 rounded-md font-medium bg-gray-600 cursor-not-allowed">
                    {nfcStep === "writing" ? 'Writing to NFC Tag...' : 'Reading NFC Tag...'}
                  </div>
                )}

                {/* Cancel button */}
                <button
                  onClick={() => {
                    nfcAbortRef.current?.abort();
                    nfcAbortRef.current = null;
                    setNfcStep("idle");
                    setNfcWriteAttempts(0);
                    setLastReadUrl("");
                    setNfcVerifyMatch(null);
                    setIsNfcWriteModalOpen(false);
                  }}
                  disabled={nfcStep === "writing" || nfcStep === "verifying"}
                  className={`border-gray-400 border w-full p-3 rounded-md font-medium transition-all duration-300 ${
                    nfcStep === "writing" || nfcStep === "verifying"
                      ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const isMobile = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

/**
 * Utility function to check if the device is desktop.
 */
const isDesktop = () => {
  if (typeof window !== 'undefined') {
    return window.innerWidth >= 768;
  }
  return false;
};

export default OrdersPage;