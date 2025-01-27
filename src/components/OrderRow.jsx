import React, { useState } from "react";
import QRCode from "qrcode.react";
import { toast } from "react-toastify";

const OrderRow = ({
  order,
  subdomain,
  onSubdomainChange,
  onSaveSubdomain,
  onGenerateQRCode,
  onProcessAndUploadImages,
  onDownloadImagesAsZip,
  onSaveMetafield,
  onFetchOrders,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveSubdomain = async () => {
    try {
      await onSaveSubdomain(order.id, subdomain);
      toast.success("Subdomain saved successfully!", { autoClose: 2000 });
      onFetchOrders();
    } catch (error) {
      console.error("Error saving subdomain:", error);
      toast.error("Failed to save subdomain!", { autoClose: 2000 });
    }
  };

  const handleGenerateQRCode = async () => {
    try {
      const svgData = await onGenerateQRCode(subdomain);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const link = document.createElement("a");
      link.href = svgUrl;
      link.download = `${subdomain}.svg`;
      link.click();
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code!", { autoClose: 2000 });
    }
  };

  const handleProcessAndUploadImages = async () => {
    setIsLoading(true);
    try {
      const imageUrls = order.line_items[0].properties
        .filter((prop) => prop.value.startsWith("https://"))
        .map((prop) => prop.value);

      if (imageUrls.length === 0) {
        toast.warn("No images found.", { autoClose: 2000 });
        return;
      }

      const processedImages = await onProcessAndUploadImages({
        orderId: order.id,
        folderName: order.name,
        imageUrls,
      });

      const photoUrls = processedImages.map((img) => img.url);
      await onSaveMetafield(order.id, "story-photos", "json", JSON.stringify(photoUrls));
      toast.success("Images uploaded successfully!", { autoClose: 2000 });
      onFetchOrders();
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to upload images!", { autoClose: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
      <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
        <b>{order.name}</b>
        <br />
        {order?.shipping_address?.first_name} {order?.shipping_address?.last_name}
      </div>

      <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
        <input
          type="text"
          value={subdomain}
          onChange={(e) => onSubdomainChange(e.target.value)}
          className="w-full p-2 border rounded text-gray-800 dark:text-gray-100 dark:bg-gray-700"
        />
        <button onClick={handleSaveSubdomain} className="bg-blue-500 text-white p-2 rounded mt-2">
          Save
        </button>
        <button
          onClick={handleGenerateQRCode}
          className="bg-gray-500 text-white p-2 rounded mt-2"
        >
          Generate QR
        </button>
      </div>

      <div className="col-span-6 p-4 text-gray-800 dark:text-gray-300">
        <b>{subdomain || "Auto Generated Subdomain"}</b>
      </div>

      <div className="col-span-2 p-4 text-center">
        <button onClick={handleProcessAndUploadImages} className="bg-green-500 text-white p-2 rounded">
          Upload
        </button>
        <button onClick={() => setIsExpanded(!isExpanded)} className="bg-gray-500 text-white p-2 rounded">
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {isExpanded && (
        <div className="col-span-12 bg-gray-100 dark:bg-gray-800 p-4">
          {order.line_items[0].properties.map((prop) => (
            <div key={prop.name}>
              <b>{prop.name}:</b> {prop.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderRow;