// pages/orders?.js
import React, { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Utility functions
const getDefaultSubdomain = (order) => {
  const storyUrlMetafield = order.metafields?.find(
    (mf) => mf.namespace === "custom" && mf.key === "story-url"
  );
  return storyUrlMetafield ? storyUrlMetafield.value : "";
};

const getOrderURL = (order) => {
  const properties = order.line_items[0].properties;
  const customURL = properties.find((p) => p.name === "custom URL");
  if (customURL) return customURL.value;

  const milestoneDate = properties.find((p) => p.name === "milestone date");
  if (milestoneDate) return milestoneDate.value.replace(/\//g, "");

  return "";
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [limit, setLimit] = useState(10); // Default limit to 10
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(false); // Global loading state

  const [loadingOrders, setLoadingOrders] = useState({}); // Track loading state for each order
  const [loadingOrders2, setLoadingOrders2] = useState({}); // Track loading state for each order
  const [toggledRows, setToggledRows] = useState({});
  const [subdomains, setSubdomains] = useState({}); // Track subdomains input for each order
  const [saving, setSaving] = useState({}); // Track save button loading state

  const saveSubdomain = async (orderId, subdomain) => {
    setLoading(true); // Start loading
    setSaving((prev) => ({ ...prev, [orderId]: true }));

    try {
      const response = await fetch("/api/save-metafield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          metafield: {
            namespace: "custom",
            key: "story-url",
            type: "single_line_text_field",
            value: subdomain,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save subdomain");
      }

      setSubdomains((prev) => ({
        ...prev,
        [orderId]: subdomain,
      }));

      toast.success("Subdomain saved successfully!", {
        position: "top-right",
        autoClose: 2000,
      });

      // Refresh the orders after saving
      fetchOrders(limit);
    } catch (error) {
      console.error("Error saving subdomain:", error.message);
      toast.error("Failed to save subdomain!", {
        position: "top-right",
        autoClose: 2000,
      });
    } finally {
      setSaving((prev) => ({ ...prev, [orderId]: false }));
      setLoading(false); // Stop loading
    }
  };

  useEffect(() => {
    const initialSubdomains = {};
    orders?.forEach((order) => {
      initialSubdomains[order.id] = getDefaultSubdomain(order);
    });
    setSubdomains(initialSubdomains);
  }, [orders]);

  // Toggle the view for a specific row
  const handleRowClick = (orderId) => {
    setToggledRows((prev) => ({
      ...prev,
      [orderId]: !prev[orderId], // Toggle the state
    }));
  };

  const generateQRCode = async (subdomain) => {
    try {
      const response = await fetch("/api/generate-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subdomain }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate QR code");
      }

      const svgData = await response.text();

      // Example: Display the SVG in the browser
      const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const link = document.createElement("a");
      link.href = svgUrl;
      link.download = `${subdomain}.svg`;
      link.click();
    } catch (error) {
      console.error("Error generating QR code:", error.message);
    }
  };

  const handleCopyPasswordAndOpenSubdomain = (order) => {
    // Fetch the password from product properties
    const passwordProperty = order.line_items[0].properties.find(
      (prop) => prop.name.toLowerCase() === "password"
    );

    // Fetch the subdomain from the metafield
    const storyUrlMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-url"
    );

    // Copy password if available
    if (passwordProperty?.value) {
      navigator.clipboard.writeText(passwordProperty.value).then(
        () => {
          toast.success("Password copied to clipboard!", {
            position: "top-right",
            autoClose: 2000,
          });
        },
        (err) => {
          toast.error("Failed to copy password!", {
            position: "top-right",
            autoClose: 2000,
          });
          console.error("Failed to copy text:", err);
        }
      );
    } else {
      toast.warn("No password available to copy.", {
        position: "top-right",
        autoClose: 2000,
      });
    }

    // Open story subdomain in a new tab if available
    if (storyUrlMetafield?.value) {
      const url = `https://${storyUrlMetafield.value}.ossotna.com`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.warn("No story URL available to open.", {
        position: "top-right",
        autoClose: 2000,
      });
    }
  };

  const handleProcessAndUploadImages = async (order) => {
    setLoading(true); // Start loading
    setLoadingOrders((prev) => ({ ...prev, [order.id]: true })); // Set loading for this order

    const folderName = order.name;
    const imageUrls = order.line_items[0].properties
      .filter(
        (prop) =>
          prop.value.startsWith("https://") && prop.name !== "_original_view_2"
      )
      .map((prop) => prop.value);

    if (imageUrls.length === 0) {
      toast.warn("No images found in the properties.", {
        position: "top-right",
        autoClose: 2000,
      });
      setLoadingOrders((prev) => ({ ...prev, [order.id]: false })); // Reset loading state
      return;
    }

    try {
      const processedImages = [];

      // Send the images to the /api/process-images endpoint for processing
      const processResponse = await fetch("/api/process-images-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName, imageUrls }),
      });

      if (!processResponse.ok) {
        throw new Error("Failed to process images.");
      }

      const { resizedImages } = await processResponse.json();

      // Upload the processed images to Cloudinary
      for (const { filename, resizedBuffer } of resizedImages) {
        const blob = new Blob(
          [Uint8Array.from(atob(resizedBuffer), (c) => c.charCodeAt(0))],
          { type: "image/jpeg" }
        );

        const signatureResponse = await fetch("/api/cloudinary-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: folderName }),
        });

        if (!signatureResponse.ok) {
          throw new Error("Failed to get Cloudinary signature.");
        }

        const { timestamp, signature, api_key } = await signatureResponse.json();

        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("timestamp", timestamp);
        formData.append("signature", signature);
        formData.append("api_key", api_key);
        formData.append("folder", folderName);

        const uploadResponse = await fetch(
          "https://api.cloudinary.com/v1_1/ossotna/upload",
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image to Cloudinary.");
        }

        const uploadData = await uploadResponse.json();
        processedImages.push({
          name: filename,
          url: uploadData.secure_url,
        });
      }

      const photoUrls = processedImages.map((image) => image.url);
      const saveResponse = await fetch("/api/save-metafield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          metafield: {
            namespace: "custom",
            key: "story-photos",
            type: "json",
            value: JSON.stringify(photoUrls),
          },
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("Failed to save image URLs to metafield.");
      }

      console.log("Uploaded Processed Images:", processedImages);

      toast.success(`Images processed and uploaded successfully for ${folderName}!`, {
        position: "top-right",
        autoClose: 2000,
      });

      // Refresh the orders after updating metafields
      fetchOrders(limit);
    } catch (error) {
      console.error("Error uploading images:", error.message);
      toast.error("Failed to process and upload images!", {
        position: "top-right",
        autoClose: 2000,
      });
    } finally {
      setLoadingOrders((prev) => ({ ...prev, [order.id]: false }));
      setLoading(false); // Stop loading
    }
  };

  // Handle download action for all images in a zip file
  const handleDownloadImagesAsZip = async (order) => {
    setLoadingOrders2((prev) => ({ ...prev, [order.id]: true })); // Set loading for this order
    const folderName = order.name;
    const imageUrls = order.line_items[0].properties
      .filter((prop) => prop.value.startsWith("https://") && prop.name !== "_original_view_2") // Exclude _original_view_2
      .map((prop) => prop.value);

    if (imageUrls.length === 0) {
      toast.warn("No valid images found in the properties.", {
        position: "top-right",
        autoClose: 2000,
      });
      setLoadingOrders2((prev) => ({ ...prev, [order.id]: false })); // Reset loading state
      return;
    }

    try {
      const response = await fetch("/api/process-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderName: folderName, imageUrls }),
      });

      if (!response.ok) {
        throw new Error("Failed to process images.");
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`All images processed and downloaded as ${folderName}.zip`, {
        position: "top-right",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Error processing images:", error.message);
      toast.error("Failed to process images!", {
        position: "top-right",
        autoClose: 2000,
      });
    } finally {
      setLoadingOrders2((prev) => ({ ...prev, [order.id]: false })); // Reset loading state
    }
  };
  const handleCopyProperties = (order, properties) => {
    const storyId = subdomains[order.id] || "No story-id available";

    // Filter out unwanted properties
    const filteredProperties = properties.filter(
      (prop) =>
        !["_cl_options", "_cl_options_id", "_cl_options_price", "_original_view_2"].includes(prop.name)
    );

    // Replace photo URLs with metafield URLs if available
    const storyPhotosMetafield = order.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "story-photos"
    );

    if (storyPhotosMetafield) {
      const storyPhotoUrls = JSON.parse(storyPhotosMetafield.value); // Parse the JSON metafield value

      filteredProperties.forEach((prop) => {
        // Match `photos_<number>` or `chapter_<number>_photo` and extract the number
        const match = prop.name.match(/(?:photos|chapter_(\d+)_photo)/);
        if (match) {
          const index = match[1] ? parseInt(match[1], 10) - 1 : parseInt(match[0].split('_')[1], 10) - 1;
          if (storyPhotoUrls[index]) {
            prop.value = storyPhotoUrls[index];
          }
        }
      });
    }

    // Construct text to copy
    const textToCopy =
      `Order ID: ${order.name}\n` + // Add the order name
      `Story ID: ${storyId}\n` +
      filteredProperties
        .map((prop) => `${prop.name}: ${prop.value}`)
        .join("\n");

    // Copy text to clipboard
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        toast.success(`${order.name} properties copied`, {
          position: "top-right",
          autoClose: 2000,
        });
      },
      (err) => {
        toast.error("Failed to copy properties!", {
          position: "top-right",
          autoClose: 2000,
        });
        console.error("Failed to copy text:", err);
      }
    );
  };

  const fetchOrders = (limitValue) => {
    setIsLoading(true);
    fetch(`api/shopify/orders?limit=${limitValue}`)
      .then((res) => res.json())
      .then((res) => {
        setOrders(res);
      })
      .catch((err) => console.error("Error fetching orders:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchOrders(limit); // Fetch orders on initial load
  }, [limit]);

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value, 10);
    setLimit(newLimit > 250 ? 250 : newLimit); // Shopify max limit is 250
  };

  return (
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
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="250">250</option>
        </select>
      </div>

      <div
        className={`h-full w-full ${isLoading ? "pointer-events-none opacity-50" : ""
          }`}
      >
        <div className="h-full w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <div className="w-full h-full">
            <div className="h-full w-full bg-white dark:bg-gray-800 shadow-md rounded-md overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold border-b border-gray-300 dark:border-gray-600">
                {/* <div className="col-span-1 p-4">Order</div> */}
                <div className="col-span-2 p-4">Order</div>
                <div className="col-span-2 p-4">Subdomain</div>
                <div className="col-span-6 p-4">Product Properties</div>
                <div className="col-span-2 p-4 text-center">Actions</div>
              </div>

              {/* Table Body */}
              <div className="overflow-y-auto h-[calc(100%-3rem)]">
                {orders ? orders.map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  // onClick={() => handleRowClick(order.id)} // Handle row click
                  >
                    {/* <div className="col-span-1 p-4 text-gray-800 dark:text-gray-300 font-bold">
                        {order.name}
                      </div> */}
                    {/* <div className="col-span-1 p-4 text-gray-800 dark:text-gray-300">
                        {order?.shipping_address?.phone || "N/A"}
                      </div> */}
                    <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
                      <b>{order.name}</b>
                      <br />
                      {order?.shipping_address?.first_name}{" "}
                      {order?.shipping_address?.last_name}
                      <br />
                      <a
                        href={`https://web.whatsapp.com/send?phone=${order?.shipping_address?.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                      >
                        {order?.shipping_address?.phone || "N/A"}
                      </a>
                      <br />
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
                      {/* Story Draft Link */}
                      {order.metafields?.some((mf) => mf.namespace === "custom" && mf.key === "story-url") && (
                        <a
                          href={`https://web.whatsapp.com/send?phone=${order?.shipping_address?.phone}&text=${encodeURIComponent(
                            `Hello ${order?.shipping_address?.first_name}, Please find below the first draft of your story. Feel free to point out any edits you'd like us to make.\n\nhttps://${order.metafields.find(
                              (mf) => mf.namespace === "custom" && mf.key === "story-url"
                            ).value}.ossotna.com/\n${order.line_items[0].properties.find((prop) => prop.name === "password")
                              ? `password: ${order.line_items[0].properties.find((prop) => prop.name === "password").value}`
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

                    {/* Subdomain Column */}
                    <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
                      <label
                        htmlFor={`subdomain-${order.id}`}
                        className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                      >
                        Subdomain URL
                      </label>
                      <input
                        type="text"
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${subdomains[order.id] &&
                          subdomains[order.id] === getDefaultSubdomain(order)
                          ? "border-green-500 text-green-500"
                          : "border-gray-300"
                          }`}
                        value={subdomains[order.id] ? subdomains[order.id] : ""}
                        onChange={(e) =>
                          setSubdomains((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                      />

                      {/* Subdomain Actions */}
                      <div className="flex items-start justify-start gap-2 mt-2">
                        {/* Save Button */}
                        <button
                          className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomains[order.id] &&
                            subdomains[order.id] === getDefaultSubdomain(order)
                            ? "bg-gray-500 cursor-not-allowed opacity-50"
                            : "bg-blue-500 hover:bg-blue-600"
                            }`}
                          onClick={() =>
                            saveSubdomain(order.id, subdomains[order.id] || getDefaultSubdomain(order))
                          }
                          disabled={
                            subdomains[order.id] &&
                            subdomains[order.id] === getDefaultSubdomain(order)
                          }
                        >
                          <span className="material-symbols-outlined">
                            save
                          </span>
                        </button>

                        {/* Fill Button */}
                        <button
                          className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900"
                          onClick={() => {
                            const orderURL = getOrderURL(order);
                            const randomDigits = Math.floor(10000 + Math.random() * 90000); // Generate 5 random digits
                            
                            // Check if story type is mother
                            const storyType = order.line_items[0].properties.find(p => p.name === "story-type")?.value || "";
                            let prefix = "book-";
                            
                            if (storyType.toLowerCase() === "mother") {
                              prefix = "mom-";
                            }
                            
                            const subdomain = orderURL === "" ? `${prefix}${randomDigits}` : orderURL;

                            setSubdomains((prev) => ({
                              ...prev,
                              [order.id]: subdomain,
                            }));
                          }}
                        >
                          <span className="material-symbols-outlined">
                            auto_fix_high
                          </span>
                        </button>

                        {/* QR Button */}
                        <button
                          className={`text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 ${subdomains[order.id]
                            ? "bg-gray-700 hover:bg-gray-900"
                            : "bg-gray-500 cursor-not-allowed opacity-50"
                            }`}
                          onClick={() => {
                            generateQRCode(subdomains[order.id]);
                          }}
                          disabled={!subdomains[order.id]}
                        >
                          <span className="material-symbols-outlined">
                            qr_code
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="col-span-6 p-4 text-gray-800 dark:text-gray-300">
                      <b>{getOrderURL(order) ? `${getOrderURL(order)}.ossotna.com` : "Auto Generated"}</b>
                      <br />
                      {toggledRows[order.id] ? ( // Check toggled state
                        order.line_items[0].properties.map((prop) => (
                          <div key={prop.name}>
                            <b>{prop.name}:</b>
                            <br />
                            {/^https?:\/\/\S+/.test(prop.value) ? ( // Check if value is a URL
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
                          .filter(
                            (p) =>
                              p.name === "title" ||
                              p.name === "dedication_line" ||
                              p.name === "dedication_line"
                          )
                          .map((prop) => (
                            <div key={prop.name}>
                              {/^https?:\/\/\S+/.test(prop.value) ? ( // Check if value is a URL
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
                    <div className="col-span-2 p-4 text-center flex items-start justify-end gap-2">
                      {/* Copy Properties Button */}
                      <button
                        className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyProperties(order, order.line_items[0].properties);
                        }}
                        disabled={!order.metafields?.some(
                          (mf) => mf.namespace === "custom" && mf.key === "story-url"
                        )}
                      >
                        <span className="material-symbols-outlined">content_copy</span>
                      </button>

                      {/* Download Images Button */}
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
                        {loadingOrders2[order.id] ?
                          <span className="material-symbols-outlined">downloading</span>
                          :
                          <span className="material-symbols-outlined">download</span>
                        }
                      </button>

                      {/* Upload Images Button */}
                      <button
                        className={`relative p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 ${loadingOrders[order.id] ? "text-gray-500 cursor-not-allowed" : "text-green-500 hover:text-green-600"
                          } transition`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessAndUploadImages(order);
                        }}
                        disabled={loadingOrders[order.id]}
                      >
                        {loadingOrders[order.id] ? (
                          <span className="material-symbols-outlined">arrow_upload_progress</span>
                        ) : (
                          <span className="material-symbols-outlined">cloud_upload</span>
                        )}

                        {/* Progress Bar */}
                        <span
                          className="absolute bottom-0 left-0 h-1 bg-green-500"
                          style={{
                            width: `${loadingOrders[`progress_${order.id}`] || 0}%`,
                          }}
                        />
                      </button>

                      {/* copy Images Button */}
                      <button
                        className={`p-1 pt-2 pr-2 pl-2 ${order.metafields?.some(
                          (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                        )
                          ? "bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600"
                          : "bg-gray-700 text-gray-500 opacity-50"
                          } transition`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const storyPhotosMetafield = order.metafields?.find(
                            (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                          );
                          if (storyPhotosMetafield) {
                            const formattedJSON = JSON.stringify(
                              JSON.parse(storyPhotosMetafield.value),
                              null,
                              2
                            ); // Format JSON with 2 spaces indentation

                            navigator.clipboard.writeText(formattedJSON).then(
                              () => {
                                toast.success("Copied story-photos JSON to clipboard!", {
                                  position: "top-right",
                                  autoClose: 2000,
                                });
                              },
                              (err) => {
                                toast.error("Failed to copy JSON!", {
                                  position: "top-right",
                                  autoClose: 2000,
                                });
                                console.error("Failed to copy JSON:", err);
                              }
                            );
                          }
                        }}
                        disabled={!order.metafields?.some(
                          (mf) => mf.namespace === "custom" && mf.key === "story-photos"
                        )}
                      >
                        <span className="material-symbols-outlined">photo_library</span>
                      </button>

                      {/* Copy Password & Open Subdomain Button */}
                      <button
                        className={`p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPasswordAndOpenSubdomain(order);
                        }}
                        disabled={!order.metafields?.some(
                          (mf) => mf.namespace === "custom" && mf.key === "story-url"
                        )}
                      >
                        <span className="material-symbols-outlined">link</span>
                      </button>

                      {/* expand Button */}
                      <button
                        className={`p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 text-white-500 hover:text-white-600 transition`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(order.id)
                        }}
                      >
                        {toggledRows[order.id] ?
                          <span className="material-symbols-outlined">arrow_upward</span>
                          :
                          <span className="material-symbols-outlined">arrow_downward</span>
                        }
                      </button>

                    </div>
                  </div>
                )) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default Orders;