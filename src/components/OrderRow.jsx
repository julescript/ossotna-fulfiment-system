import React, { useState } from "react";
import { toast } from "react-toastify";
import { getDefaultSubdomain, getOrderURL } from "../utils/orderUtils";
import QRCode from "qrcode.react";

const OrderRow = ({
  order,
  subdomain,
  onSubdomainChange,
  onSaveSubdomain,
  onGenerateQRCode,
  onProcessAndUploadImages,
  onDownloadImagesAsZip,
  onCopyProperties,
  onCopyPasswordAndOpenSubdomain,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDownloadAsSVG = () => {
    const svgContent = document.getElementById(`svg-cards-${order.id}`);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgContent);

    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${order.name}_cards.svg`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
      {/* Main Row Content */}
      <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
        <b>{order.name}</b>
        <br />
        {order?.shipping_address?.first_name} {order?.shipping_address?.last_name}
      </div>

      <div className="col-span-2 p-4 text-gray-800 dark:text-gray-300">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Subdomain URL
        </label>
        <input
          type="text"
          className="w-full p-2 border rounded text-gray-800 dark:text-gray-100 dark:bg-gray-700"
          value={subdomain || ""}
          onChange={(e) => onSubdomainChange(e.target.value)}
        />
      </div>

      <div className="col-span-6 p-4 text-gray-800 dark:text-gray-300">
        <b>{getOrderURL(order) || "Auto Generated"}</b>
      </div>

      <div className="col-span-2 p-4 text-center">
        <button
          className="p-2 bg-gray-700 text-white rounded hover:bg-gray-900"
          onClick={() => setIsModalOpen(true)}
        >
          Expand
        </button>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-3/4 max-w-4xl">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </button>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Order Details</h2>
              <button
                onClick={handleDownloadAsSVG}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Download as SVG
              </button>
            </div>

            {/* Cards */}
            <div id={`svg-cards-${order.id}`} className="flex gap-6">
              {/* Card 1 */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="256.69"
                height="161.58"
                viewBox="0 0 256.69 161.58"
                className="bg-black text-white rounded-lg p-4 w-[8.56cm] h-[5.398cm]"
              >
                <rect width="100%" height="100%" fill="black" />
                <text
                  x="50%"
                  y="30%"
                  fill="white"
                  fontSize="14"
                  textAnchor="middle"
                >
                  {order.line_items[0].properties.find(
                    (p) => p.name === "milestone date"
                  )?.value || "Milestone Date"}
                </text>
                <text
                  x="50%"
                  y="50%"
                  fill="white"
                  fontSize="18"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {order.line_items[0].properties.find(
                    (p) => p.name === "title"
                  )?.value || "Story Title"}
                </text>
                <text
                  x="50%"
                  y="70%"
                  fill="white"
                  fontSize="14"
                  textAnchor="middle"
                >
                  {order.line_items[0].properties.find(
                    (p) => p.name === "dedication_line"
                  )?.value || "Dedication Line"}
                </text>
              </svg>

              {/* Card 2 */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="256.69"
                height="161.58"
                viewBox="0 0 256.69 161.58"
                className="bg-black text-white rounded-lg p-4 w-[8.56cm] h-[5.398cm]"
              >
                <rect width="100%" height="100%" fill="black" />
                <text
                  x="50%"
                  y="20%"
                  fill="white"
                  fontSize="14"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  Ossotna
                </text>
                <foreignObject
                  x="30%"
                  y="30%"
                  width="40%"
                  height="40%"
                  className="flex justify-center items-center"
                >
                  <QRCode
                    value={`https://${getOrderURL(order)}.ossotna.com`}
                    size={50}
                    fgColor="white"
                    bgColor="black"
                  />
                </foreignObject>
                <text
                  x="50%"
                  y="85%"
                  fill="white"
                  fontSize="12"
                  textAnchor="middle"
                >
                  {`https://${getOrderURL(order)}.ossotna.com`}
                </text>
              </svg>
            </div>

            {/* Action Buttons */}
            <div className="mt-6">
              {/* Add any additional buttons here */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderRow;