import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from 'next/dynamic'; // Import dynamic from Next.js

// Dynamically import QrScanner to disable SSR
const QrReader = dynamic(() => import('react-qr-scanner'), { ssr: false });
// Custom hook for fetching orders:
import { useOrders } from "../hooks/useOrders";

// Utility functions:
import { getDefaultSubdomain, getOrderURL, processQrCodeSvg } from "../utils/orderUtils";

// Service functions:
import {
  saveSubdomainAPI,
  generateQRCodeAPI,
  processAndUploadImagesAPI,
  downloadImagesAsZipAPI,
  saveMetafieldAPI,
  saveStatusAPI,
} from "../services/orderService";
import TwoFramesPreview from "@/components/CardsPreview";
import Image from "next/image";

const OrdersPage = () => {
  // 1) State + custom hook usage
  const { orders, limit, setLimit, isLoading, fetchOrders } = useOrders();
  // Add this alongside your existing useState declarations
  const [isSubdomainCheckOpen, setIsSubdomainCheckOpen] = useState(false);

  // For subdomain inputs
  const [subdomains, setSubdomains] = useState({});
  // Add these state variables alongside your existing states
  const [dedicationLines, setDedicationLines] = useState({});
  const [storyTitles, setStoryTitles] = useState({});
  const [milestoneDates, setMilestoneDates] = useState({});
  const [generatedQRCodes, setGeneratedQRCodes] = useState({});

  const [isCameraOpen, setIsCameraOpen] = useState(false);

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

  // 1) Add storyStatuses state & statusOptions array
  const [storyStatuses, setStoryStatuses] = useState({});
  const statusOptions = [
    "New Order",
    "Waiting Story",
    "Story Draft",
    "Story Live",
    "Story Approved",
    "Sent for Printing",
    "Packaging",
    "QA Review",
    "Ready for Delivery",
  ];


  const subdomainValue = (order) => {
    return subdomains[order.id] || "";
  }

  const handleOpenModal = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setIsModalOpen(false);
  };

  // 2) Populate initial subdomains each time orders change
  useEffect(() => {
    const statuses = {};
    const subs = {};
    const dedications = {};
    const titles = {};
    const milestones = {};

    orders.forEach((order) => {
      // Existing story status
      const storyStatusMetafield = order.metafields?.find(
        (mf) => mf.namespace === "custom" && mf.key === "story-status"
      );
      statuses[order.id] = storyStatusMetafield?.value || "New Order";

      // Existing subdomain
      subs[order.id] = getDefaultSubdomain(order);

      // New Dedication Line
      const dedicationMetafield = order.metafields?.find(
        (mf) => mf.namespace === "custom" && mf.key === "story-dedication"
      );
      dedications[order.id] = dedicationMetafield?.value || "";

      // New Story Title
      const titleMetafield = order.metafields?.find(
        (mf) => mf.namespace === "custom" && mf.key === "story-title"
      );
      titles[order.id] = titleMetafield?.value || "";

      // New Milestone Date
      const milestoneMetafield = order.metafields?.find(
        (mf) => mf.namespace === "custom" && mf.key === "story-date"
      );
      milestones[order.id] = milestoneMetafield?.value || "";
    });

    setStoryStatuses(statuses);
    setSubdomains(subs);
    setDedicationLines(dedications);
    setStoryTitles(titles);
    setMilestoneDates(milestones);
  }, [orders]);

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

  const handleScan = (data) => {
    if (data) {
      console.log(data.text)
      // Assuming the QR code contains a Shopify order URL like https://yourstore.com/orders/{orderId}
      const url = new URL(data.text);
      const pathSegments = url.pathname.split('/');
      console.log(pathSegments)
      const orderId = pathSegments[pathSegments.length - 1]; // Extract the last segment as orderId
      console.log(orderId)
      // Find the order with the extracted orderId
      const order = orders.find(o => o.id === Number(orderId) || o.name === orderId); // Adjust based on how orderId is stored
      console.log(orders)
      if (order) {
        handleOpenModal(order);
        setIsCameraOpen(false); // Close the camera after successful scan
      } else {
        toast.error("Order not found", { autoClose: 2000 });
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
      await saveMetafieldAPI(order.id, "story-photos", "json", JSON.stringify(photoUrls));

      toast.success(`Images processed and uploaded for ${folderName}!`, { autoClose: 2000 });
      // Optionally refetch orders to get the new metafields
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
    const storyId = subdomains[order.id] || "No story-id available";

    // Filter out certain properties
    const filteredProperties = order.line_items[0].properties.filter(
      (prop) =>
        !["_cl_options", "_cl_options_id", "_cl_options_price", "_original_view_2"].includes(
          prop.name
        )
    );

    // Replace with story photos from metafield if needed
    const storyPhotosMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-photos"
    );
    if (storyPhotosMetafield) {
      const storyPhotoUrls = JSON.parse(storyPhotosMetafield.value);
      // Example logic: If property name indicates an image slot, swap with the processed link
      filteredProperties.forEach((prop) => {
        // e.g., "photos_1", "photos_2", or "chapter_3_photo"
        const match = prop.name.match(/(?:photos|chapter_(\d+)_photo)/);
        if (match) {
          // If "chapter_3_photo", match[1] => "3"; if "photos_1", no capturing group => might adapt the code
          const index = match[1]
            ? parseInt(match[1], 10) - 1
            : parseInt(prop.name.split("_")[1], 10) - 1;
          if (storyPhotoUrls[index]) {
            prop.value = storyPhotoUrls[index];
          }
        }
      });
    }

    // Build a final text string
    const textToCopy =
      `Order ID: ${order.name}\n` +
      `Story ID: ${storyId}\n` +
      filteredProperties.map((prop) => `${prop.name}: ${prop.value}`).join("\n");

    navigator.clipboard.writeText(textToCopy).then(
      () => toast.success(`${order.name} properties copied`, { autoClose: 2000 }),
      (err) => {
        toast.error("Failed to copy properties!", { autoClose: 2000 });
        console.error("Failed to copy text:", err);
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

  // Copy password and open the subdomain in a new tab
  const handleCopySubdomainOpenNFC = (order) => {
    // 2) Open the subdomain
    const storyUrlMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-url"
    );
    if (storyUrlMetafield?.value) {
      const url = `${storyUrlMetafield.value}.ossotna.com`;
      navigator.clipboard.writeText(url).then(
        () => toast.success("domain copied to clipboard!", { autoClose: 2000 }),
        (err) => toast.error("domain to copy password!", { autoClose: 2000 })
      );
    } else {
      toast.warn("No story URL available to open.", { autoClose: 2000 });
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
        customItemPrice = parseFloat(customItemPrice) || 0;
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
      if (customItemName && customItemPrice > 0) {
        draftLineItems.push({
          title: customItemName,
          price: customItemPrice.toString(), // must be a string
          quantity: 1,
          taxable: false, // Usually non-physical items aren't taxable
          requires_shipping: false, // Non-physical => no shipping
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
      if (customItemName && customItemPrice) {
        customItemPrice = parseFloat(customItemPrice);
        if (!isNaN(customItemPrice) && customItemPrice > 0) {
          customItems.push({
            title: customItemName,
            price: customItemPrice.toFixed(2), // Ensure two decimal places as string
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
      const newLineItems = line_items.map((item) => ({
        variant_id: item.variant_id, // Include if it's a physical product variant
        title: item.title,
        quantity: item.quantity,
        price: item.price, // Price as string
        properties: item.properties?.map(({ name, value }) => ({ name, value })),
      }));

      // 3) If user entered a custom item, push it to newLineItems
      if (customItems.length > 0) {
        newLineItems.push(...customItems);
      }

      // 4) Clone shipping_lines from the original order
      const newShippingLines = shipping_lines.map((shippingLine) => ({
        title: shippingLine.title,
        price: shippingLine.price, // Price as string
        code: shippingLine.code || "", // Shipping rate code
        source: shippingLine.source || "custom", // Shipping rate source
        // If there are carrier identifiers or other fields, include them here
      }));

      // 5) Clone transactions from the original order
      // Note: Directly duplicating transactions may not be feasible due to security and data integrity.
      // Instead, you can set up new transactions based on your payment workflow.
      // Here, we'll assume you want to record a payment for the new order.
      // You'll need to integrate with your payment gateway accordingly.

      // Example: Creating a new transaction based on the original
      // WARNING: Be cautious with handling sensitive payment information.
      const newTransactions = transactions.map((transaction) => ({
        kind: transaction.kind, // e.g., 'authorization', 'capture'
        status: transaction.status, // e.g., 'success'
        amount: transaction.amount, // Amount as string
        gateway: transaction.gateway, // Payment gateway name
        // Do not include sensitive fields like credit card information
      }));

      // 6) Create the new order payload
      const orderPayload = {
        order: {
          line_items: newLineItems,
          customer: customer ? { id: customer.id } : null, // Link to existing customer
          email: email || (customer ? customer.email : undefined), // Ensure email is set
          shipping_address: shipping_address || null,
          billing_address: billing_address || null,
          financial_status: financial_status || "pending", // Set based on your workflow
          fulfillment_status: fulfillment_status || "unfulfilled", // Set based on your workflow
          shipping_lines: newShippingLines,
          // transactions: newTransactions, // Typically handled separately
          // To create a payment, you might need to handle it via the Payment API or Checkout
          // For simplicity, we'll omit transactions here
          // Include other necessary fields like tags, note, etc., if needed
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
    const newLimit = parseInt(e.target.value, 25);
    setLimit(newLimit > 250 ? 250 : newLimit); // Shopify max limit is 250
  };

  // 3) Handler to update the "story-status" metafield
  const handleStoryStatusChange = async (orderId, newStatus) => {
    // Update local state so the dropdown value changes immediately
    setStoryStatuses((prev) => ({ ...prev, [orderId]: newStatus }));
    try {
      // Save to Shopify Metafield
      await saveStatusAPI(orderId, newStatus)
      toast.success("Story status updated successfully!", { autoClose: 2000 });
    } catch (error) {
      console.error("Error updating story status:", error);
      toast.error("Failed to update story status!", { autoClose: 2000 });
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

      customItemPrice = parseFloat(customItemPrice);
      if (isNaN(customItemPrice) || customItemPrice <= 0) {
        toast.error("Invalid price entered.", { autoClose: 2000 });
        return;
      }

      // Call the API to add the custom item
      const response = await fetch("/api/shopify/addCustomItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          customItem: {
            title: customItemName,
            price: customItemPrice.toFixed(2), // Ensure two decimal places
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Custom item added successfully!", { autoClose: 2000 });
        // Optionally, refresh order data here
        fetchOrders(limit);
      } else {
        throw new Error(data.error || "Unknown error");
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
      await saveMetafieldAPI(orderId, key, "string", value); // Assuming 'string' type
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
  const handleSaveDedicationLine = (orderId, dedicationLine) => {
    console.log("handleSaveMetafield", orderId, dedicationLine)
    handleSaveMetafield(orderId, "story-dedication", dedicationLine);
  };

  const handleSaveStoryTitle = (orderId, storyTitle) => {
    console.log("handleSaveMetafield", orderId, storyTitle)
    handleSaveMetafield(orderId, "story-title", storyTitle);
  };

  const handleSaveMilestoneDate = (orderId, milestoneDate) => {
    console.log("handleSaveMetafield", orderId, milestoneDate)
    handleSaveMetafield(orderId, "story-date", milestoneDate);
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
    const property = order.line_items[0].properties.find(
      (prop) => prop.name === "milestone_date" // Fixed typo here
    );
    if (!metafield?.value) return false; // Metafield is empty or doesn't exist
    return milestoneDates[order.id] === metafield.value;
  };

  // Add these handler functions inside your OrdersPage component

  /**
   * Handler for scanning the QR code and comparing subdomains.
   * @param {Object} data - The data returned from the QR scanner.
   */
  const handleSubdomainScan = (data) => {
    if (data) {
      try {
        const scannedText = data.text.trim();

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
          toast.success("Subdomain matches!", { autoClose: 2000 });
        } else {
          toast.error("Subdomain does not match.", { autoClose: 2000 });
        }

        // Close the scanner modal after processing
        setIsSubdomainCheckOpen(false);
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
    setIsSubdomainCheckOpen(false);
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

  const formatLebanesePhoneNumber = (phone) => {
    if (!phone) return '';
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Check if the phone number starts with '0' and remove it
    const formattedNumber = digits.startsWith('0') ? `+961${digits.slice(1)}` : digits;
    // Prepend the country code '961'
    return `${formattedNumber}`;
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
      <div className="p-4 bg-gray-900 min-h-screen relative">
        <h1 className="text-2xl font-bold mb-2 text-white">Ossotna Shopify Orders</h1>

        {/* Limit Selector */}
        <div className="mb-6 flex items-center gap-4">
          <label htmlFor="limit" className="text-white">
            # ORDERS TO FETCH
          </label>
          <select
            id="limit"
            value={limit}
            onChange={handleLimitChange}
            className="p-2 bg-gray-800 text-white rounded"
          >
            {/* <option value="10">10</option> */}
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
          </select>

          {/* QR Code Camera Button (Visible only on Mobile) */}
          <div className="fixed top-6 right-6">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="p-4 pr-5 pl-5 pt-5 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600 focus:outline-none"
              title="Scan Order QR Code"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>

        </div>

        {/* Main Table Container */}
        <div className={`h-full w-full ${isLoading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="h-full w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
            <div className="w-full h-full">
              <div className="h-full w-full bg-white dark:bg-gray-800 shadow-md rounded-md overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border-b border-gray-300 dark:border-gray-600">
                  <div className="col-span-9 md:col-span-2 p-4">Order</div>

                  {/* Hide on Mobile */}
                  <div className="col-span-0 md:col-span-2 p-4 hidden md:block">Subdomain</div>
                  <div className="col-span-0 md:col-span-2 p-4 hidden md:block">Story Status</div>
                  <div className="col-span-0 md:col-span-4 p-4 hidden md:block">Product Properties</div>

                  <div className="col-span-3 md:col-span-2 p-4 text-center">Actions</div>
                </div>

                {/* Table Body */}
                <div className="overflow-y-auto h-[calc(100%-3rem)]">
                  {orders.map((order) => {
                    const subdomainValue = subdomains[order.id] || "";
                    const storyType = order.line_items[0].properties.find(
                      (prop) => prop.name === "story"
                    );

                    return (
                      <div
                        key={order.id}
                        className={`grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${storyStatuses[order.id] === "Ready for Delivery" ? "bg-green-900 dark:hover:bg-green-800" : (storyStatuses[order.id] === "New Order" ? "dark:bg-gray-600" : (storyStatuses[order.id] === "Waiting Story" ? "dark:bg-[rgba(255,20,0,0.2)]" : ""))}`}
                      >
                        {/* Column 1: Order Info (with WhatsApp Quick-Action Buttons) */}
                        <div className="col-span-9 md:col-span-2 p-4 text-gray-800 dark:text-gray-300">
                          <b>{order.name}</b> <span className={
                            storyType?.value === "later"
                              ? "text-red-500"
                              : storyType?.value === "help"
                                ? "text-yellow-500"
                                : "text-yellow-500"
                          }><span className="uppercase">{storyType?.value ? storyType.value : null}</span></span>
                          <br />
                          {order?.shipping_address?.first_name} {order?.shipping_address?.last_name}
                          <br />
                          {/* Show phone or "N/A" */}
                          <a
                            href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(order?.shipping_address?.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-blue-500 underline"
                          >
                            {order?.shipping_address?.phone || "N/A"}
                          </a>
                          <a
                            href={`https://wa.me/${order?.shipping_address?.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="md:hidden text-blue-500 underline"
                          >
                            {order?.shipping_address?.phone || "N/A"}
                          </a>
                          <br />

                          {/* 1) Quick Hello Button */}
                          <a
                            href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(order?.shipping_address?.phone)}&text=${encodeURIComponent(
                              `Hello ${order?.shipping_address?.first_name}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                          >
                            <span className="material-symbols-outlined">waving_hand</span>
                          </a>

                          {/* 2) Thank You / Intro Message Button */}
                          <a
                            href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(order?.shipping_address?.phone)}&text=${encodeURIComponent(
                              `Hello ${order?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                          >
                            <span className="material-symbols-outlined">volunteer_activism</span>
                          </a>

                          {/* 3) Draft Link Button (only if "story-url" metafield exists) */}
                          {order.metafields?.some(
                            (mf) => mf.namespace === "custom" && mf.key === "story-url"
                          ) && (
                              <a
                                href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(order?.shipping_address?.phone)}&text=${encodeURIComponent(
                                  `Hello ${order?.shipping_address?.first_name}, Please find below the first draft of your story. Feel free to point out any edits you'd like us to make.\n\nhttps://${order.metafields.find(
                                    (mf) => mf.namespace === "custom" && mf.key === "story-url"
                                  ).value
                                  }.ossotna.com/\n${order.line_items[0].properties.find((prop) => prop.name === "password")
                                    ? `password: ${order.line_items[0].properties.find((prop) => prop.name === "password").value
                                    }`
                                    : ""
                                  }\n\nHope you like it as much as we do!`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block"
                              >
                                <span className="material-symbols-outlined">Draft</span>
                              </a>
                            )}

                          <div className={`md:hidden w-full p-1 pl-2 rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${storyStatuses[order.id] === "Ready for Delivery"
                            ? "border-green-500 text-green-500 dark:bg-green-900"
                            : "border-gray-300"
                            }`}><i>{storyStatuses[order.id] || "New Order"}</i></div>
                        </div>

                        {/* Column 2: Subdomain Input & Actions */}
                        <div className="col-span-0 md:col-span-2 p-4 text-gray-800 dark:text-gray-300 hidden md:block">
                          <label
                            htmlFor={`subdomain-${order.id}`}
                            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                          >
                            Subdomain URL
                          </label>
                          <input
                            type="text"
                            id={`subdomain-${order.id}`}
                            className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${subdomainValue === getDefaultSubdomain(order)
                              ? "border-green-500 text-green-500"
                              : "border-gray-300"
                              }`}
                            value={subdomainValue}
                            onChange={(e) =>
                              setSubdomains((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                          />

                          {/* Subdomain Buttons - Hidden on mobile */}
                          <div className="flex items-start justify-start gap-2 mt-2">
                            {/* Save Subdomain */}
                            <button
                              className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomainValue === getDefaultSubdomain(order)
                                ? "bg-gray-500 cursor-not-allowed opacity-50"
                                : "bg-blue-500 hover:bg-blue-600"
                                }`}
                              onClick={() =>
                                handleSaveSubdomain(order.id, subdomainValue)
                              }
                              disabled={subdomainValue === getDefaultSubdomain(order)}
                            >
                              <span className="material-symbols-outlined">save</span>
                            </button>

                            {/* Auto-Fill Subdomain */}
                            <button
                              className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900"
                              onClick={() => {
                                const customURL = getOrderURL(order);
                                const randomDigits = Math.floor(10000 + Math.random() * 90000);
                                const fallback = `book-${randomDigits}`;
                                setSubdomains((prev) => ({
                                  ...prev,
                                  [order.id]: customURL || fallback,
                                }));
                              }}
                            >
                              <span className="material-symbols-outlined">
                                auto_fix_high
                              </span>
                            </button>

                            {/* Generate QR Code */}
                            <button
                              className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomainValue
                                ? "bg-gray-700 hover:bg-gray-900"
                                : "bg-gray-500 cursor-not-allowed opacity-50"
                                }`}
                              onClick={() => handleGenerateQRCode(subdomainValue)}
                              disabled={!subdomainValue}
                            >
                              <span className="material-symbols-outlined">
                                qr_code
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Column 3: Story Status - Hidden on mobile */}
                        <div className="col-span-0 md:col-span-2 p-4 text-gray-800 dark:text-gray-300 hidden md:block">
                          <label
                            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                          >
                            Story Status
                          </label>
                          <select
                            className={`w-full p-2 border rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${storyStatuses[order.id] === "Ready for Delivery"
                              ? "border-green-500 text-green-500 dark:bg-green-900"
                              : "border-gray-300"
                              }`}
                            value={storyStatuses[order.id] || "New Order"}
                            onChange={(e) => handleStoryStatusChange(order.id, e.target.value)}
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Column 4: Product Properties - Hidden on mobile */}
                        <div className="col-span-0 md:col-span-4 p-4 text-gray-800 dark:text-gray-300 hidden md:block">
                          <i>{order.line_items[0].variant_title}</i>
                          <br /> <br />
                          {toggledRows[order.id] ? (
                            order.line_items[0].properties.map((prop) => (
                              <div key={prop.name}>
                                <b>{prop.name}:</b>
                                <br />
                                {/^https?:\/\/\S+/.test(prop.value) ? (
                                  <a
                                    href={prop.value}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 underline"
                                  >
                                    {prop.value}
                                  </a>
                                ) : (
                                  prop.value
                                )}
                                <hr className="mt-4 mb-4 opacity-25" />
                              </div>
                            ))
                          ) : (
                            order.line_items[0].properties
                              .filter((p) => ["title", "dedication_line"].includes(p.name))
                              .map((prop) => (
                                <div key={prop.name}>
                                  {/^https?:\/\/\S+/.test(prop.value) ? (
                                    <a
                                      href={prop.value}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-500 underline"
                                    >
                                      {prop.value}
                                    </a>
                                  ) : (
                                    prop.value
                                  )}
                                </div>
                              ))
                          )}
                          <b>
                            {getOrderURL(order)
                              ? `${getOrderURL(order)}.ossotna.com`
                              : "Auto Generated"}
                          </b>
                        </div>

                        {/* Column 5: Action Buttons */}
                        <div className="col-span-3 md:col-span-2 p-4 text-center flex flex-col items-end justify-start gap-2">
                          {/* Actions Container */}
                          <div className="flex flex-wrap justify-center gap-2 md:flex-nowrap">
                            {/* Copy Properties */}
                            <button
                              className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 hidden md:block"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyProperties(order);
                              }}
                              title="Copy Properties"
                              aria-label="Copy Properties"
                            >
                              <span className="material-symbols-outlined">content_copy</span>
                            </button>

                            {/* Process & Upload images */}
                            <button
                              className={`relative p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 hidden md:block ${loadingOrders[order.id]
                                ? "text-gray-500 cursor-not-allowed"
                                : "text-green-500 hover:text-green-600"
                                } transition`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProcessAndUploadImages(order);
                              }}
                              disabled={loadingOrders[order.id]}
                              title="Process & Upload Images"
                              aria-label="Process & Upload Images"
                            >
                              {loadingOrders[order.id] ? (
                                <span className="material-symbols-outlined">
                                  arrow_upload_progress
                                </span>
                              ) : (
                                <span className="material-symbols-outlined">cloud_upload</span>
                              )}
                            </button>

                            {/* Copy Images JSON Button */}
                            <button
                              className={`p-1 pt-2 pr-2 pl-2 hidden md:block ${order.metafields?.some(
                                (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                              )
                                ? "bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600"
                                : "bg-gray-700 text-gray-500 opacity-50"
                                } transition`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyStoryPhotosJSON(order);
                              }}
                              disabled={
                                !order.metafields?.some(
                                  (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                                )
                              }
                              title="Copy Images JSON"
                              aria-label="Copy Images JSON"
                            >
                              <span className="material-symbols-outlined">photo_library</span>
                            </button>

                            {/* Expand row */}
                            <button
                              className="p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(order);
                              }}
                              title="Open Order Details"
                              aria-label="Open Order Details"
                            >
                              <span className="material-symbols-outlined">aspect_ratio</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap justify-center gap-2 md:flex-nowrap">

                            {/* Open Shopify Order Page */}
                            <button
                              className="hidden md:block p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenShopifyOrderPage(order);
                              }}
                              title="Open Shopify Order Page"
                              aria-label="Open Shopify Order Page"
                            >
                              <span className="material-symbols-outlined">shoppingmode</span>
                            </button>

                            {/* Open Shopify Order Page */}
                            <button
                              className="hidden md:block p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenShopifyPrintPage(order);
                              }}
                              title="Open Shopify Order Page"
                              aria-label="Open Shopify Order Page"
                            >
                              <span className="material-symbols-outlined">print</span>
                            </button>

                            {/* Copy Password & Open Subdomain */}
                            <button
                              className="hidden md:block p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPasswordAndOpenSubdomain(order);
                              }}
                              title="Copy Password & Open Subdomain"
                              aria-label="Copy Password & Open Subdomain"
                            >
                              <span className="material-symbols-outlined">language</span>
                            </button>

                            {/* Open Subdomain in Localhost */}
                            <button
                              className="hidden md:block p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySubdomainAndOpenLocalhost(order);
                              }}
                              title="Open Subdomain in Localhost"
                              aria-label="Open Subdomain in Localhost"
                            >
                              <span className="material-symbols-outlined">dns</span>
                            </button>
                          </div>

                          {/* Progress Indicators (Optional) */}
                          {downloadProgress[order.id] && (
                            <div className="mt-1 text-xs text-white">
                              Downloading {downloadProgress[order.id].current} / {downloadProgress[order.id].total}
                            </div>
                          )}
                          {uploadProgress[order.id] && (
                            <div className="mt-1 text-xs text-white">
                              Uploading {uploadProgress[order.id].current} / {uploadProgress[order.id].total}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <ToastContainer />
      </div>
      {isModalOpen && selectedOrder && (
        // Backdrop
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center"
          onClick={handleCloseModal}
        >
          {/* Outer container (stopPropagation so clicks inside don't close) */}
          <div
            className={`relative bg-white dark:bg-gray-800 rounded shadow-lg ${
              /* Make full screen without padding on mobile, retain original size on desktop */
              "w-full h-full md:w-[90dvw] md:h-[90dvh] " +
              (isMobile() ? "p-0" : "p-0")
              }`}
            onClick={(e) => e.stopPropagation()}
          >

            {/* Flex layout for header and content */}
            <div className="flex flex-col h-full">

              {/* HEADER (fixed within the modal: use "sticky" or "shrink-0") */}
              <div className="block md:sticky top-0 p-4 md:p-6 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 z-10 flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col flex-1">
                  <h2 className="text-xl font-bold mb-2">{selectedOrder.name}</h2>
                  {/* Add more to the header here if desired */}
                  {selectedOrder.line_items[0].variant_title}
                </div>

                {/* Story Status - Move below on mobile */}
                <div className={`col-span-3 text-gray-800 dark:text-gray-300 mt-2 md:mt-0 ${isMobile() ? "w-full" : "w-auto"}`}>
                  <label
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Story Status
                  </label>
                  <select
                    className={`w-full p-2 border rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${storyStatuses[selectedOrder.id] === "Ready for Delivery"
                      ? "border-green-500 text-green-500 dark:bg-green-900"
                      : "border-gray-300"
                      }`}
                    value={storyStatuses[selectedOrder.id] || "New Order"}
                    onChange={(e) => handleStoryStatusChange(selectedOrder.id, e.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 z-10 md:ml-4 absolute top-0 right-0 p-6"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* MAIN CONTENT: Adjusted for Responsiveness */}
              <div className="flex-1 overflow-hidden p-0">
                <div className={`flex flex-col md:flex-row h-full overflow-y-auto ${isMobile() ? "space-y-4" : "space-x-4"}`}>

                  {/* RIGHT HALF: Preview Cards */}
                  <div className={`w-full md:w-1/2 p-0 md:p-6 flex items-start justify-start flex-col gap-0 md:gap-6 md:overflow-y-auto`}>
                    <TwoFramesPreview
                      milestoneDate={milestoneDates[selectedOrder.id]}
                      title={storyTitles[selectedOrder.id]}
                      dedicationLine={dedicationLines[selectedOrder.id]}
                      qr={generatedQRCodes[selectedOrder.id]}
                      subdomain={subdomainValue(selectedOrder)}
                    />

                    <div className="p-4 pt-0 w-full md:hidden">
                      <label htmlFor="story-title" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Milestone Date
                      </label>
                      <div className={`w-full p-1 pl-2 rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700`}>{milestoneDates[selectedOrder.id] || ""}</div>
                    </div>

                    <div className="p-4 pt-0 w-full md:hidden">
                      <label htmlFor="story-title" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Story Title
                      </label>
                      <div className={`w-full p-1 pl-2 rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700`}>{storyTitles[selectedOrder.id] || ""}</div>
                    </div>

                    <div className="p-4 pt-0 w-full md:hidden">
                      <label htmlFor="story-title" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Dedication Line
                      </label>
                      <div className={`w-full p-1 pl-2 rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700`}>{dedicationLines[selectedOrder.id] || ""}</div>
                    </div>

                    <div className="p-4 pt-0 w-full md:hidden">
                      <label htmlFor="story-title" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        URL
                      </label>
                      <div className="flex flex-row items-center gap-2">
                        <div className={`w-full p-1 pl-2 rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700`}>{subdomainValue(selectedOrder)}</div>

                        {/* Copy Password & Open Subdomain MOBILE */}
                        <button
                          className="md:hidden p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySubdomainOpenNFC(selectedOrder);
                          }}
                          title="Copy Password & Open Subdomain"
                          aria-label="Copy Password & Open Subdomain"
                        >
                          <span className="material-symbols-outlined">link</span>
                        </button>

                        {/* Compare Subdomain via QR Code */}
                        <button
                          className="md:hidden p-1 pt-2 pr-2 pl-2 bg-blue-700 hover:bg-blue-900 text-white-500 hover:text-white-600 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSubdomainCheckOpen(true);
                          }}
                          title="Compare Subdomain via QR Code"
                          aria-label="Compare Subdomain via QR Code"
                        >
                          <span className="material-symbols-outlined">compare_arrows</span>
                        </button>

                      </div>
                    </div>

                    {/* Column 2: Subdomain Input & Actions */}
                    <div className="col-span-2 text-gray-800 dark:text-gray-300 p-4 md:p-0 hidden md:block">
                      {/* Existing Components and Actions */}

                      {/* New Input Fields */}
                      <div className="w-full">

                        {/* Milestone Date */}
                        <div className="mb-4">
                          <label htmlFor="milestone-date" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Milestone Date
                          </label>
                          <div className="mt-1 flex">
                            <input
                              type="text"
                              id="milestone-date"
                              value={milestoneDates[selectedOrder.id] || ""}
                              onChange={(e) => setMilestoneDates((prev) => ({
                                ...prev,
                                [selectedOrder.id]: e.target.value,
                              }))}
                              className={`p-2 flex-1 block w-full rounded-md dark:bg-gray-700 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isMilestoneDateInSync(selectedOrder)
                                ? "border-green-500 "
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Enter milestone date"
                              readOnly={isMobile()} /* Make read-only on mobile */
                            />
                            <button
                              onClick={() => copyToClipboard(milestoneDates[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 dark:bg-gray-700 hover:bg-blue-600 text-white rounded-md "
                              title="Save Story Title"
                            >
                              <span className="material-symbols-outlined">content_copy</span>
                            </button>
                            {/* Load Milestone Date */}
                            <button
                              onClick={() => {
                                const property = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "milestone date"
                                );
                                const value = property?.value || "";
                                setMilestoneDates((prev) => ({
                                  ...prev,
                                  [selectedOrder.id]: value,
                                }));
                              }}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                              title="Load Milestone Date"
                              disabled={isMobile()} /* Disable on mobile */
                            >
                              <span className="material-symbols-outlined">restore</span>
                            </button>
                            {/* Save Milestone Date */}
                            <button
                              onClick={() => handleSaveMilestoneDate(selectedOrder.id, milestoneDates[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                              disabled={isMilestoneDateInSync(selectedOrder) || isMobile()} /* Disable on mobile */
                              title="Save Milestone Date"
                            >
                              <span className="material-symbols-outlined">save</span>
                            </button>
                          </div>
                        </div>

                        {/* Story Title */}
                        <div className="mb-4">
                          <label htmlFor="story-title" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Story Title
                          </label>
                          <div className="mt-1 flex">
                            <input
                              type="text"
                              id="story-title"
                              value={storyTitles[selectedOrder.id] || ""}
                              onChange={(e) => setStoryTitles((prev) => ({
                                ...prev,
                                [selectedOrder.id]: e.target.value,
                              }))}
                              className={`p-2 flex-1 block w-full rounded-md dark:bg-gray-700 border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isStoryTitleInSync(selectedOrder)
                                ? "border-green-500 "
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Enter story title"
                              readOnly={isMobile()} /* Make read-only on mobile */
                            />
                            <button
                              onClick={() => copyToClipboard(storyTitles[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 dark:bg-gray-700 hover:bg-blue-600 text-white rounded-md "
                              title="Save Story Title"
                            >
                              <span className="material-symbols-outlined">content_copy</span>
                            </button>
                            {/* Load Story Title */}
                            <button
                              onClick={() => {
                                const property = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "title"
                                );
                                const value = property?.value || "";
                                setStoryTitles((prev) => ({
                                  ...prev,
                                  [selectedOrder.id]: value,
                                }));
                              }}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                              title="Load Story Title"
                              disabled={isMobile()} /* Disable on mobile */
                            >
                              <span className="material-symbols-outlined">restore</span>
                            </button>
                            {/* Save Story Title */}
                            <button
                              onClick={() => handleSaveStoryTitle(selectedOrder.id, storyTitles[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                              disabled={isStoryTitleInSync(selectedOrder) || isMobile()} /* Disable on mobile */
                              title="Save Story Title"
                            >
                              <span className="material-symbols-outlined">save</span>
                            </button>
                          </div>
                        </div>

                        {/* Dedication Line */}
                        <div className="mb-4">
                          <label htmlFor="dedication-line" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Dedication Line
                          </label>
                          <div className="mt-1 flex">
                            <input
                              type="text"
                              id="dedication-line"
                              value={dedicationLines[selectedOrder.id] || ""}
                              onChange={(e) => setDedicationLines((prev) => ({
                                ...prev,
                                [selectedOrder.id]: e.target.value,
                              }))}
                              className={`p-2 flex-1 block w-full rounded-md border dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isDedicationLineInSync(selectedOrder)
                                ? "border-green-500 "
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Enter dedication line"
                              readOnly={isMobile()} /* Make read-only on mobile */
                            />
                            <button
                              onClick={() => copyToClipboard(dedicationLines[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 dark:bg-gray-700 hover:bg-blue-600 text-white rounded-md "
                              title="Save Story Title"
                            >
                              <span className="material-symbols-outlined">content_copy</span>
                            </button>
                            {/* Load Dedication Line */}
                            <button
                              onClick={() => {
                                const property = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "dedication_line"
                                );
                                let value = property?.value || "";

                                if (!value) {
                                  // Get their_name and your_name from order properties
                                  const theirNameProperty = selectedOrder.line_items[0].properties.find(
                                    (prop) => prop.name === "their_name"
                                  );
                                  const yourNameProperty = selectedOrder.line_items[0].properties.find(
                                    (prop) => prop.name === "your_name"
                                  );

                                  const theirName = theirNameProperty?.value || "";
                                  const yourName = yourNameProperty?.value || "";

                                  // Concatenate if both names exist
                                  if (theirName && yourName) {
                                    value = `For ${theirName}, By ${yourName}`;
                                  }
                                }

                                setDedicationLines((prev) => ({
                                  ...prev,
                                  [selectedOrder.id]: value,
                                }));
                              }}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                              title="Load Dedication Line"
                              disabled={isMobile()} /* Disable on mobile */
                            >
                              <span className="material-symbols-outlined">restore</span>
                            </button>
                            {/* Save Dedication Line */}
                            <button
                              onClick={() => handleSaveDedicationLine(selectedOrder.id, dedicationLines[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                              disabled={isDedicationLineInSync(selectedOrder) || isMobile()} /* Disable on mobile */
                              title="Save Dedication Line"
                            >
                              <span className="material-symbols-outlined">save</span>
                            </button>
                          </div>
                        </div>

                        {/* Subdomain Input & Actions */}
                        <div className="mb-4">
                          <label htmlFor="dedication-line" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Subdomain
                          </label>
                          <div className="mt-1 flex">
                            <input
                              type="text"
                              id="dedication-line"
                              value={subdomainValue(selectedOrder)}
                              onChange={(e) =>
                                setSubdomains((prev) => ({
                                  ...prev,
                                  [selectedOrder.id]: e.target.value,
                                }))
                              }
                              className={`p-2 flex-1 block w-full rounded-md border dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isDedicationLineInSync(selectedOrder)
                                ? "border-green-500 "
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Subdomain"
                              disabled
                            />
                            <button
                              onClick={() => copyToClipboard(subdomainValue(selectedOrder) || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 dark:bg-gray-700 hover:bg-blue-600 text-white rounded-md "
                              title="Save Story Title"
                            >
                              <span className="material-symbols-outlined">content_copy</span>
                            </button>
                            <button
                              onClick={() => handleGenerateQRCode(subdomainValue(selectedOrder))}
                              disabled={!subdomainValue(selectedOrder)}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 dark:bg-gray-700 hover:bg-blue-600 text-white rounded-md "
                            >
                              <span className="material-symbols-outlined">qr_code</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* LEFT HALF: Scrollable list of filtered properties */}
                  <div className="w-full md:w-1/2 md:overflow-y-auto p-6 flex flex-col align-center justify-start relative">
                    <div className="text-center font-bold bg-black p-4 md:block hidden">ORDER PROPERTIES</div>

                    {/* Column 1: Order Info (with WhatsApp Quick-Action Buttons) */}
                    <div className="col-span-9 md:col-span-2 text-gray-800 dark:text-gray-300">
                      <b>{selectedOrder.name}</b>
                      <br />
                      {selectedOrder?.shipping_address?.first_name} {selectedOrder?.shipping_address?.last_name}
                      <br />
                      {/* Show phone or "N/A" */}
                      <a
                        href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(selectedOrder?.shipping_address?.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-block text-blue-500 underline"
                      >
                        {selectedOrder?.shipping_address?.phone || "N/A"}
                      </a>
                      <a
                        href={`https://wa.me/${formatLebanesePhoneNumber(selectedOrder?.shipping_address?.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="md:hidden text-blue-500 underline"
                      >
                        {selectedOrder?.shipping_address?.phone || "N/A"}
                      </a>
                      <br />

                      {/* 1) Quick Hello Button */}
                      <a
                        href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(selectedOrder?.shipping_address?.phone)}&text=${encodeURIComponent(
                          `Hello ${selectedOrder?.shipping_address?.first_name}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                      >
                        <span className="material-symbols-outlined">waving_hand</span>
                      </a>

                      {/* 2) Thank You / Intro Message Button */}
                      <a
                        href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(selectedOrder?.shipping_address?.phone)}&text=${encodeURIComponent(
                          `Hello ${selectedOrder?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                      >
                        <span className="material-symbols-outlined">volunteer_activism</span>
                      </a>

                      {/* 3) Draft Link Button (only if "story-url" metafield exists) */}
                      {selectedOrder.metafields?.some(
                        (mf) => mf.namespace === "custom" && mf.key === "story-url"
                      ) && (
                          <a
                            href={`https://web.whatsapp.com/send?phone=${formatLebanesePhoneNumber(selectedOrder?.shipping_address?.phone)}&text=${encodeURIComponent(
                              `Hello ${selectedOrder?.shipping_address?.first_name}, Please find below the first draft of your story. Feel free to point out any edits you'd like us to make.\n\nhttps://${selectedOrder.metafields.find(
                                (mf) => mf.namespace === "custom" && mf.key === "story-url"
                              ).value
                              }.ossotna.com/\n${selectedOrder.line_items[0].properties.find((prop) => prop.name === "password")
                                ? `password: ${selectedOrder.line_items[0].properties.find((prop) => prop.name === "password").value
                                }`
                                : ""
                              }\n\nHope you like it as much as we do!`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block"
                          >
                            <span className="material-symbols-outlined">Draft</span>
                          </a>
                        )}
                    </div>

                    {selectedOrder && selectedOrder.line_items[0].properties.filter(
                      (prop) =>
                        ["_original_view_2",].includes(prop.name)
                    ).map((prop) => !!prop.value ? (
                      <Image
                        src={prop.value}
                        alt={prop.value}
                        width={200}
                        height={200}
                        className="rounded m-auto mb-6 mt-6 w-auto h-auto"
                      />
                    ) : null)
                    }

                    <div className="flex flex-col items-start justify-start gap-4 mb-8 hidden md:flex">

                      <div className="col-span-2 text-center flex items-start justify-end gap-2 w-full">
                        {/* Copy Properties */}
                        <button
                          className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyProperties(selectedOrder);
                          }}
                        >
                          <span className="material-symbols-outlined">
                            content_copy
                          </span>
                        </button>

                        {/* Download images as ZIP */}
                        <button
                          className={`p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 ${loadingOrders2[selectedOrder.id]
                            ? "text-gray-500 cursor-not-allowed"
                            : "text-blue-500 hover:text-blue-600"
                            } transition`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadImagesAsZip(selectedOrder);
                          }}
                          disabled={loadingOrders2[selectedOrder.id]}
                        >
                          {loadingOrders2[selectedOrder.id] ? (
                            <span className="material-symbols-outlined">downloading</span>
                          ) : (
                            <span className="material-symbols-outlined">download</span>
                          )}
                        </button>

                        {/* Mini download progress text */}
                        {downloadProgress[selectedOrder.id] && (
                          <div className="mt-1 text-xs text-white">
                            Downloading {downloadProgress[selectedOrder.id].current} / {downloadProgress[selectedOrder.id].total}
                          </div>
                        )}

                        {/* Process & Upload images */}
                        <button
                          className={`relative p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 ${loadingOrders[selectedOrder.id]
                            ? "text-gray-500 cursor-not-allowed"
                            : "text-green-500 hover:text-green-600"
                            } transition`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProcessAndUploadImages(selectedOrder);
                          }}
                          disabled={loadingOrders[selectedOrder.id]}
                        >
                          {loadingOrders[selectedOrder.id] ? (
                            <span className="material-symbols-outlined">
                              arrow_upload_progress
                            </span>
                          ) : (
                            <span className="material-symbols-outlined">cloud_upload</span>
                          )}
                        </button>

                        {/* Mini upload progress text */}
                        {uploadProgress[selectedOrder.id] && (
                          <div className="mt-1 text-xs text-white">
                            Uploading {uploadProgress[selectedOrder.id].current} / {uploadProgress[selectedOrder.id].total}
                          </div>
                        )}

                        {/* Copy Images JSON Button */}
                        <button
                          className={`p-1 pt-2 pr-2 pl-2 ${selectedOrder.metafields?.some(
                            (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                          )
                            ? "bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600"
                            : "bg-gray-700 text-gray-500 opacity-50"
                            } transition`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyStoryPhotosJSON(selectedOrder);
                          }}
                          disabled={
                            !selectedOrder.metafields?.some(
                              (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                            )
                          }
                        >
                          <span className="material-symbols-outlined">photo_library</span>
                        </button>

                        {/* Copy Password & Open Subdomain */}
                        <button
                          className="p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPasswordAndOpenSubdomain(selectedOrder);
                          }}
                        >
                          <span className="material-symbols-outlined">link</span>
                        </button>

                        <button
                              className="hidden md:block p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySubdomainAndOpenLocalhost(selectedOrder);
                              }}
                              title="Open Subdomain in Localhost"
                              aria-label="Open Subdomain in Localhost"
                            >
                              <span className="material-symbols-outlined">dns</span>
                            </button>

                        <div className="w-full"></div>

                        {/* Duplicate Draft Order */}
                        <button
                          className="p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateDraftOrder(selectedOrder);
                          }}
                        >
                          <span className="material-symbols-outlined">move_group</span>
                        </button>

                        {/* Create Direct Order Button */}
                        <button
                          className="p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateDirectOrder(selectedOrder);
                          }}
                        >
                          <span className="material-symbols-outlined">add_shopping_cart</span>
                        </button>

                        {/* Add Custom Item */}
                        <button
                          className="p-1 pt-2 pr-2 pl-2 bg-green-700 hover:bg-green-900 text-white-500 hover:text-white-600 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddCustomItem(selectedOrder);
                          }}
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>

                      </div>

                      <div className="flex flex-col items-start justify-start gap-2">
                        {/* Example: Displaying Custom Items */}
                        {selectedOrder.line_items
                          .map(item => (
                            <div key={item.id} className="flex items-center justify-start gap-2">
                              <button
                                className="p-1 pt-2 pr-2 pl-2 bg-red-700 hover:bg-red-900 text-white-500 hover:text-white-600 transition"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCustomItem(selectedOrder, item.id);
                                }}
                                title="Remove Custom Item"
                                aria-label="Remove Custom Item"
                              >
                                <span className="material-symbols-outlined">remove</span>
                              </button>
                              <span>{item.title} - ${item.price}</span>
                            </div>
                          ))}
                      </div>

                    </div>

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
                </div>
              </div>
            </div>      </div>      </div>
      )}

      {isCameraOpen && (
        // Backdrop for QR Scanner
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
          {/* QR Scanner Container */}
          <div className="relative bg-white dark:bg-gray-800 p-4 rounded-md">
            <p className="mb-4 text-center text-gray-700 dark:text-gray-300">Scan order label QR Code</p>
            {/* QR Reader */}
            <QrReader
              delay={300}
              onError={handleError}
              onScan={handleScan}
              style={{ width: '300px' }}
              constraints={{
                video: {
                  facingMode: 'environment', // Correct
                },
              }}
            />
            {/* Close Button */}
            <button
              onClick={() => setIsCameraOpen(false)}
              className="w-full p-4 mt-2 bg-gray-900 text-white-500 hover:text-white-700"
              title="Close Scanner"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {isSubdomainCheckOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="relative bg-white dark:bg-gray-800 p-4 rounded-md">
            <p className="mb-4 text-center text-gray-700 dark:text-gray-300">Scan QR Code to Compare Subdomain</p>

            {/* QR Reader */}
            <QrReader
              delay={300}
              onError={handleSubdomainError}
              onScan={handleSubdomainScan}
              style={{ width: '300px', filter: 'invert(1)' }}
              constraints={{
                video: {
                  facingMode: 'environment',
                },
              }}
            />

            {/* Close Button */}
            <button
              onClick={() => setIsSubdomainCheckOpen(false)}
              className="w-full p-4 mt-2 bg-gray-900 text-white-500 hover:text-white-700"
              title="Close Scanner"
            >
              CLOSE
            </button>
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