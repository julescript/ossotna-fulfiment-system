import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Custom hook for fetching orders:
import { useOrders } from "../hooks/useOrders";

// Utility functions:
import { getDefaultSubdomain, getOrderURL } from "../utils/orderUtils";

// Service functions:
import {
  saveSubdomainAPI,
  generateQRCodeAPI,
  processAndUploadImagesAPI,
  downloadImagesAsZipAPI,
  saveMetafieldAPI,
} from "../services/orderService";
import TwoFramesPreview from "@/components/CardsPreview";

const OrdersPage = () => {
  // 1) State + custom hook usage
  const { orders, limit, setLimit, isLoading, fetchOrders } = useOrders();

  // For subdomain inputs
  const [subdomains, setSubdomains] = useState({});

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
    const initial = {};
    orders.forEach((order) => {
      initial[order.id] = getDefaultSubdomain(order);
    });
    setSubdomains(initial);
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
      const svgData = await generateQRCodeAPI(subdomain);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Force download in browser
      const link = document.createElement("a");
      link.href = svgUrl;
      link.download = `${subdomain}.svg`;
      link.click();
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
                  <div className="col-span-6 p-4">Product Properties</div>
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
                        {/* Column 1: Order Info */}
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

                        {/* Column 3: Product Properties (expandable) */}
                        <div className="col-span-6 p-4 text-gray-800 dark:text-gray-300">
                          <b>
                            {getOrderURL(order)
                              ? `${getOrderURL(order)}.ossotna.com`
                              : "Auto Generated"}
                          </b>
                          <br />
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
                          <button
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
                          </button>

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
            {/* Close Button (positioned absolute at top-right) */}
            <button
              onClick={handleCloseModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 z-10"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* We'll use a flex layout so the header is pinned at the top, and the rest can scroll */}
            <div className="flex flex-col h-full">
              {/* HEADER (fixed within the modal: use "sticky" or "shrink-0") */}
              <div className="sticky top-0 p-6 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 z-10">
                <h2 className="text-xl font-bold mb-2">{selectedOrder.name}</h2>
                {/* Add more to the header here if desired */}
                {getOrderURL(selectedOrder)
                  ? `${getOrderURL(selectedOrder)}.ossotna.com`
                  : "No URL"}
              </div>

              {/* MAIN CONTENT: 2-column split */}
              <div className="flex-1 overflow-hidden">
                <div className="flex h-full">

                  {/* RIGHT HALF: Show _original_view_2 (if it exists) */}
                  <div className="w-1/2 p-6 flex items-start justify-start overflow-y-auto flex-col gap-6">

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
                    {/* Column 2: Subdomain Input & Actions */}
                    <div className="col-span-2 text-gray-800 dark:text-gray-300">
                      <label
                        htmlFor={`subdomain-${selectedOrder.id}`}
                        className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                      >
                        Subdomain URL
                      </label>
                      <input
                        type="text"
                        id={`subdomain-${selectedOrder.id}`}
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${subdomainValue(selectedOrder) === getDefaultSubdomain(selectedOrder)
                          ? "border-green-500 text-green-500"
                          : "border-gray-300"
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
                          className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomainValue(selectedOrder) === getDefaultSubdomain(selectedOrder)
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

                    <TwoFramesPreview
                      milestoneDate={selectedOrder.line_items[0].properties.find(p => p.name === "milestone_date")?.value}
                      title={selectedOrder.line_items[0].properties.find(p => p.name === "title")?.value}
                      dedicationLine={selectedOrder.line_items[0].properties.find(p => p.name === "dedication_line")?.value}
                      qrCodeSvg={"qrCodeSVGFromYourAPI"}
                      subdomain={`${subdomainValue(selectedOrder)}.ossotna.com`}
                    />

                  </div>

                  {/* LEFT HALF: Scrollable list of filtered properties */}
                  <div className="w-1/2 overflow-y-auto p-6">
                    {/** 1) Filter out unwanted properties **/}
                    {selectedOrder.line_items[0].properties
                      .filter(
                        (prop) =>
                          ![
                            "_cl_options",
                            "_cl_options_id",
                            "_cl_options_price",
                          ].includes(prop.name)
                      )
                      .map((prop) => (
                        <div key={prop.name} className="mb-4">
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
                          <hr className="mt-2 opacity-25" />
                        </div>
                      ))}
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