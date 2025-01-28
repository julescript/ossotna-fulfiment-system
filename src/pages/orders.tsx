import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

  // For subdomain inputs
  const [subdomains, setSubdomains] = useState({});
  // Add these state variables alongside your existing states
  const [dedicationLines, setDedicationLines] = useState({});
  const [storyTitles, setStoryTitles] = useState({});
  const [milestoneDates, setMilestoneDates] = useState({});

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
    "Story Draft",
    "Story Live",
    "Sent for Printing",
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
        .filter((prop) => prop.value.startsWith("https://") && prop.name !== "_original_view_2")
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

  // 4) Render
  return (
    <>
      <div className="p-8 bg-gray-900 min-h-screen relative">
        <h1 className="text-2xl font-bold mb-8 text-white">Ossotna Shopify Orders</h1>

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
        </div>

        {/* Main table container */}
        <div className={`h-full w-full ${isLoading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="h-full w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
            <div className="w-full h-full">
              <div className="h-full w-full bg-white dark:bg-gray-800 shadow-md rounded-md overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border-b border-gray-300 dark:border-gray-600">
                  <div className="col-span-2 p-4">Order</div>
                  <div className="col-span-2 p-4">Subdomain</div>
                  <div className="col-span-2 p-4">Story Status</div>
                  <div className="col-span-4 p-4">Product Properties</div>
                  <div className="col-span-2 p-4 text-center">Actions</div>
                </div>

                {/* Table Body */}
                <div className="overflow-y-auto h-[calc(100%-3rem)]">
                  {orders.map((order) => {
                    const subdomainValue = subdomains[order.id] || "";

                    return (
                      <div
                        key={order.id}
                        className="grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {/* Column 1: Order Info (with WhatsApp Quick-Action Buttons) */}
                        <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
                          <b>{order.name}</b>
                          <br />
                          {order?.shipping_address?.first_name} {order?.shipping_address?.last_name}
                          <br />
                          {/* Show phone or "N/A" */}
                          <a
                            href={`https://web.whatsapp.com/send?phone=${order?.shipping_address?.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 underline"
                          >
                            {order?.shipping_address?.phone || "N/A"}
                          </a>
                          <br />

                          {/* 1) Quick Hello Button */}
                          <a
                            href={`https://web.whatsapp.com/send?phone=${order?.shipping_address?.phone}&text=${encodeURIComponent(
                              `Hello ${order?.shipping_address?.first_name}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                          >
                            <span className="material-symbols-outlined">waving_hand</span>
                          </a>

                          {/* 2) Thank You / Intro Message Button */}
                          <a
                            href={`https://web.whatsapp.com/send?phone=${order?.shipping_address?.phone}&text=${encodeURIComponent(
                              `Hello ${order?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                          >
                            <span className="material-symbols-outlined">volunteer_activism</span>
                          </a>

                          {/* 3) Draft Link Button (only if "story-url" metafield exists) */}
                          {order.metafields?.some(
                            (mf) => mf.namespace === "custom" && mf.key === "story-url"
                          ) && (
                              <a
                                href={`https://web.whatsapp.com/send?phone=${order?.shipping_address?.phone}&text=${encodeURIComponent(
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
                                className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block"
                              >
                                <span className="material-symbols-outlined">Draft</span>
                              </a>
                            )}
                        </div>

                        {/* Column 2: Subdomain Input & Actions */}
                        <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
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

                          {/* Subdomain Buttons */}
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

                        {/* Column 3: Story Status (col-span-2) */}
                        <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
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


                        {/* Column 3: Product Properties (expandable) */}
                        <div className="col-span-4 p-4 text-gray-800 dark:text-gray-300">
                          <i>{order.line_items[0].variant_title}</i>
                          <br />         <br />
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

                        {/* Column 4: Action buttons */}
                        <div className="col-span-2 p-4 text-center flex items-start justify-end gap-2">
                          {/* Copy Properties */}
                          <button
                            className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyProperties(order);
                            }}
                          >
                            <span className="material-symbols-outlined">
                              content_copy
                            </span>
                          </button>

                          {/* Download images as ZIP */}
                          {/* <button
                            className={`p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 ${loadingOrders2[order.id]
                              ? "text-gray-500 cursor-not-allowed"
                              : "text-blue-500 hover:text-blue-600"
                              } transition`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImagesAsZip(order);
                            }}
                            disabled={loadingOrders2[order.id]}
                          >
                            {loadingOrders2[order.id] ? (
                              <span className="material-symbols-outlined">downloading</span>
                            ) : (
                              <span className="material-symbols-outlined">download</span>
                            )}
                          </button> */}

                          {/* Mini download progress text */}
                          {downloadProgress[order.id] && (
                            <div className="mt-1 text-xs text-white">
                              Downloading {downloadProgress[order.id].current} / {downloadProgress[order.id].total}
                            </div>
                          )}

                          {/* Process & Upload images */}
                          <button
                            className={`relative p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 ${loadingOrders[order.id]
                              ? "text-gray-500 cursor-not-allowed"
                              : "text-green-500 hover:text-green-600"
                              } transition`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessAndUploadImages(order);
                            }}
                            disabled={loadingOrders[order.id]}
                          >
                            {loadingOrders[order.id] ? (
                              <span className="material-symbols-outlined">
                                arrow_upload_progress
                              </span>
                            ) : (
                              <span className="material-symbols-outlined">cloud_upload</span>
                            )}
                          </button>

                          {/* Mini upload progress text */}
                          {uploadProgress[order.id] && (
                            <div className="mt-1 text-xs text-white">
                              Uploading {uploadProgress[order.id].current} / {uploadProgress[order.id].total}
                            </div>
                          )}

                          {/* Copy Images JSON Button */}
                          <button
                            className={`p-1 pt-2 pr-2 pl-2 ${order.metafields?.some(
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
                          >
                            <span className="material-symbols-outlined">photo_library</span>
                          </button>

                          {/* Copy Password & Open Subdomain */}
                          <button
                            className="p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPasswordAndOpenSubdomain(order);
                            }}
                          >
                            <span className="material-symbols-outlined">link</span>
                          </button>

                          {/* Expand row */}
                          <button
                            className="p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(order);
                            }}
                          >
                            <span className="material-symbols-outlined">open_in_new</span>
                          </button>
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
            className="relative bg-white dark:bg-gray-800 w-[80dvw] h-[80dvh] rounded shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >

            {/* We'll use a flex layout so the header is pinned at the top, and the rest can scroll */}
            <div className="flex flex-col h-full">
              {/* HEADER (fixed within the modal: use "sticky" or "shrink-0") */}
              <div className="sticky top-0 p-6 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 z-10 flex flex-row">
                <div className="flex flex-col flex-1">
                  <h2 className="text-xl font-bold mb-2">{selectedOrder.name}</h2>
                  {/* Add more to the header here if desired */}
                  {selectedOrder.line_items[0].variant_title}
                </div>

                <div className="col-span-3 text-gray-800 dark:text-gray-300">
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
                  className="text-gray-500 hover:text-gray-700 z-10 ml-4"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* MAIN CONTENT: 2-column split */}
              <div className="flex-1 overflow-hidden">
                <div className="flex h-full">

                  {/* RIGHT HALF: Show _original_view_2 (if it exists) */}
                  <div className="w-1/2 p-6 flex items-start justify-start overflow-y-auto flex-col gap-6">

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
                            >
                              <span className="material-symbols-outlined">remove</span>
                            </button>
                            <span>{item.title} - ${item.price}</span>
                          </div>
                        ))}
                    </div>

                    <TwoFramesPreview
                      milestoneDate={milestoneDates[selectedOrder.id]}
                      title={storyTitles[selectedOrder.id]}
                      dedicationLine={dedicationLines[selectedOrder.id]}
                      subdomain={subdomainValue(selectedOrder)}
                    />

                    <div className="col-span-2 text-center flex items-start justify-end gap-2">
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

                    </div>
                    <div className="col-span-2 text-center flex items-start justify-end gap-2">


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

                    {/* Column 2: Subdomain Input & Actions */}
                    <div className="col-span-2 text-gray-800 dark:text-gray-300">
                      {/* Existing Components and Actions */}

                      {/* New Input Fields */}
                      <div className="w-full">
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
                              className={`p-2 flex-1 block w-full rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isDedicationLineInSync(selectedOrder)
                                ? "border-green-500 text-green-500 dark:bg-green-900"
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Enter dedication line"
                            />
                            {/* Load Dedication Line */}
                            <button
                              onClick={() => {
                                const property = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "dedication_line"
                                );
                                const value = property?.value || "";
                                setDedicationLines((prev) => ({
                                  ...prev,
                                  [selectedOrder.id]: value,
                                }));
                              }}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
                              title="Load Dedication Line"
                            >
                              <span className="material-symbols-outlined">restore</span>
                            </button>
                            {/* Save Dedication Line */}
                            <button
                              onClick={() => handleSaveDedicationLine(selectedOrder.id, dedicationLines[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                              disabled={isDedicationLineInSync(selectedOrder)}
                              title="Save Dedication Line"
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
                              className={`p-2 flex-1 block w-full rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isStoryTitleInSync(selectedOrder)
                                ? "border-green-500 text-green-500 dark:bg-green-900"
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Enter story title"
                            />
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
                            >
                              <span className="material-symbols-outlined">restore</span>
                            </button>
                            {/* Save Story Title */}
                            <button
                              onClick={() => handleSaveStoryTitle(selectedOrder.id, storyTitles[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                              disabled={isStoryTitleInSync(selectedOrder)}
                              title="Save Story Title"
                            >
                              <span className="material-symbols-outlined">save</span>
                            </button>
                          </div>
                        </div>

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
                              className={`p-2 flex-1 block w-full rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${isMilestoneDateInSync(selectedOrder)
                                ? "border-green-500 text-green-500 dark:bg-green-900"
                                : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                                }`}
                              placeholder="Enter milestone date"
                            />
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
                            >
                              <span className="material-symbols-outlined">restore</span>
                            </button>
                            {/* Save Milestone Date */}
                            <button
                              onClick={() => handleSaveMilestoneDate(selectedOrder.id, milestoneDates[selectedOrder.id] || "")}
                              className="ml-2 p-1 pt-2 pr-2 pl-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                              disabled={isMilestoneDateInSync(selectedOrder)}
                              title="Save Milestone Date"
                            >
                              <span className="material-symbols-outlined">save</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <label
                        htmlFor={`subdomain-${selectedOrder.id}`}
                        className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                      >
                        Subdomain URL
                      </label>
                      <input
                        type="text"
                        id={`subdomain-${selectedOrder.id}`}
                        className={`p-2 flex-1 block w-full rounded-md border shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${subdomainValue(selectedOrder) === getDefaultSubdomain(selectedOrder)
                          ? "border-green-500 text-green-500 dark:bg-green-900"
                          : "border-gray-300 dark:bg-gray-700 dark:text-gray-100"
                          }`}
                        value={subdomainValue(selectedOrder)}
                        onChange={(e) =>
                          setSubdomains((prev) => ({
                            ...prev,
                            [selectedOrder.id]: e.target.value,
                          }))
                        }
                      />

                      {/* Subdomain Buttons */}
                      <div className="flex items-start justify-start gap-2 mt-2">
                        {/* Save Subdomain */}
                        <button
                          className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomainValue === getDefaultSubdomain(selectedOrder)
                            ? "bg-gray-500 cursor-not-allowed opacity-50"
                            : "bg-blue-500 hover:bg-blue-600"
                            }`}
                          onClick={() =>
                            handleSaveSubdomain(selectedOrder.id, subdomainValue)
                          }
                          disabled={subdomainValue === getDefaultSubdomain(selectedOrder)}
                        >
                          <span className="material-symbols-outlined">save</span>
                        </button>

                        {/* Auto-Fill Subdomain */}
                        <button
                          className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900"
                          onClick={() => {
                            const customURL = getOrderURL(selectedOrder);
                            const randomDigits = Math.floor(10000 + Math.random() * 90000);
                            const fallback = `book-${randomDigits}`;
                            setSubdomains((prev) => ({
                              ...prev,
                              [selectedOrder.id]: customURL || fallback,
                            }));
                          }}
                        >
                          <span className="material-symbols-outlined">
                            auto_fix_high
                          </span>
                        </button>

                        {/* Generate QR Code */}
                        <button
                          className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomainValue(selectedOrder)
                            ? "bg-gray-700 hover:bg-gray-900"
                            : "bg-gray-500 cursor-not-allowed opacity-50"
                            }`}
                          onClick={() => handleGenerateQRCode(subdomainValue(selectedOrder))}
                          disabled={!subdomainValue(selectedOrder)}
                        >
                          <span className="material-symbols-outlined">
                            qr_code
                          </span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* LEFT HALF: Scrollable list of filtered properties */}
                  <div className="w-1/2 overflow-y-auto p-6 flex flex-col align-center justify-start relative">
                    <div className="text-center font-bold bg-black p-4">ORDER PROPERTIES</div>
                    {selectedOrder && selectedOrder.line_items[0].properties.filter(
                      (prop) =>
                        ["_original_view_2",].includes(prop.name)
                    ).map((prop) => (
                      <Image
                        src={prop.value}
                        alt={"preview"}
                        width={320}
                        height={320}
                        className="rounded m-auto mb-6 mt-6"
                      />
                    ))
                    }
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
                                width={200}
                                height={200}
                                className="rounded object-contain w-200 h-auto"
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
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrdersPage;