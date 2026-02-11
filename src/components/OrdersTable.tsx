import React from "react";
import { getDefaultSubdomain, getOrderURL } from "../utils/orderUtils";
import { formatPhoneForWhatsApp, getWhatsAppUrl } from "../utils/whatsapp";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OrdersTableProps {
  orders: any[];
  isLoading: boolean;

  // Per-order state maps
  subdomains: Record<string, string>;
  toggledRows: Record<string, boolean>;
  loadingOrders: Record<string, boolean>;
  storyStages: Record<string, string>;
  printablesStatuses: Record<string, string>;
  fulfillmentStatuses: Record<string, string>;
  uploadProgress: Record<string, { current: number; total: number }>;
  downloadProgress: Record<string, { current: number; total: number }>;

  // Status options
  storyStageOptions: string[];
  printablesStatusOptions: string[];
  fulfillmentStatusOptions: string[];

  // Setters
  setSubdomains: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // Handlers
  handleOpenModal: (order: any) => void;
  handleCopyProperties: (order: any) => void;
  handleProcessAndUploadImages: (order: any) => void;
  handleCopyStoryPhotosJSON: (order: any) => void;
  handleCopyPasswordAndOpenSubdomain: (order: any) => void;
  handleCopySubdomainAndOpenLocalhost: (order: any) => void;
  handleOpenShopifyOrderPage: (order: any) => void;
  handleOpenShopifyPrintPage: (order: any) => void;
  handleSendPreviewLink: (order: any) => void;
  handleSaveSubdomain: (orderId: string, subdomain: string) => void;
  handleGenerateQRCode: (subdomain: string) => void;
  handleStoryStageChange: (orderId: string, newStatus: string) => void;
  handlePrintablesStatusChange: (orderId: string, newStatus: string) => void;
  handleFulfillmentStatusChange: (orderId: string, newStatus: string) => void;

  // For opening story tab directly from table
  setSelectedOrder: (order: any) => void;
  setActiveModalTab: (tab: string) => void;
  setIsModalOpen: (open: boolean) => void;
}

// ── Helper functions ───────────────────────────────────────────────────────────

const getPhoneNumber = (order: any): string => {
  if (!order) return "";
  if (order.phone) return order.phone;
  if (order.shipping_address?.phone) return order.shipping_address.phone;
  return "";
};

const getStatusSelectClassName = (value: string): string => {
  const v = (value || "").toString().toLowerCase();
  if (v.includes("draft") || v.includes("review")) {
    return "border-yellow-500 text-yellow-200 dark:bg-yellow-900";
  }
  if (v.includes("ready") || v.includes("live")) {
    return "border-green-500 text-green-200 dark:bg-green-900";
  }
  return "border-gray-500 text-gray-200 dark:bg-gray-700";
};

const getPrintablesStatusSelectClassName = (value: string): string => {
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

const getRowBackgroundClass = (
  order: any,
  storyStages: Record<string, string>,
  printablesStatuses: Record<string, string>,
  fulfillmentStatuses: Record<string, string>
): string => {
  const story = storyStages[order.id] || "Pending";
  const printables = printablesStatuses[order.id] || "Pending";
  const fulfillment = fulfillmentStatuses[order.id] || "New Order";

  if (story === "Waiting") return "bg-red-900";
  if (fulfillment === "Ready For Delivery") return "bg-green-900";
  if (fulfillment === "Sent For Delivery") return "bg-sky-200 dark:bg-sky-900";
  if (fulfillment === "Delivered") return "bg-purple-900";
  if (story === "Pending" && printables === "Pending" && fulfillment === "New Order")
    return "bg-gray-100 dark:bg-gray-700";
  return "";
};

// ── Component ──────────────────────────────────────────────────────────────────

const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  isLoading,
  subdomains,
  toggledRows,
  loadingOrders,
  storyStages,
  printablesStatuses,
  fulfillmentStatuses,
  uploadProgress,
  downloadProgress,
  storyStageOptions,
  printablesStatusOptions,
  fulfillmentStatusOptions,
  setSubdomains,
  handleOpenModal,
  handleCopyProperties,
  handleProcessAndUploadImages,
  handleCopyStoryPhotosJSON,
  handleCopyPasswordAndOpenSubdomain,
  handleCopySubdomainAndOpenLocalhost,
  handleOpenShopifyOrderPage,
  handleOpenShopifyPrintPage,
  handleSendPreviewLink,
  handleSaveSubdomain,
  handleGenerateQRCode,
  handleStoryStageChange,
  handlePrintablesStatusChange,
  handleFulfillmentStatusChange,
  setSelectedOrder,
  setActiveModalTab,
  setIsModalOpen,
}) => {
  const GRID_COLS = "grid-cols-[1fr] md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto_auto]";

  return (
    <div className={`h-full w-full md:pb-0 pb-44 ${isLoading ? "pointer-events-none opacity-50" : ""}`}>
      <div className="h-full w-full bg-gray-900 flex items-center justify-center">
        <div className="w-full h-full">
          <div className="h-full w-full bg-gray-800 shadow-md rounded-md overflow-hidden border border-gray-600 table-fixed">
            {/* Table Header */}
            <div className={`grid ${GRID_COLS} bg-gray-600 text-white font-bold border-b border-gray-500 text-sm`}>
              <div className="px-3 py-2 md:block">Order</div>
              <div className="px-3 py-2 hidden md:block">Properties</div>
              <div className="px-3 py-2 hidden md:block">Subdomain</div>
              <div className="px-3 py-2 hidden md:block">Story</div>
              <div className="px-3 py-2 hidden md:block">Printables</div>
              <div className="px-3 py-2 hidden md:block">Fulfillment</div>
              <div className="px-3 py-2 hidden md:block pl-5">Actions</div>
              <div className="px-3 py-2 hidden md:block text-center"></div>
            </div>

            {/* Table Body */}
            <div className="overflow-y-auto h-[calc(100%-3rem)]">
              {orders.map((order) => {
                const subdomainValue = subdomains[order.id] || "";
                const storyType = order.line_items[0].properties.find(
                  (prop: any) => prop.name === "story"
                );

                return (
                  <React.Fragment key={order.id}>
                  {/* ── Mobile Card ── */}
                  <div
                    className={`md:hidden flex gap-3 p-3 border-b border-gray-700 cursor-pointer active:brightness-125 ${getRowBackgroundClass(order, storyStages, printablesStatuses, fulfillmentStatuses)}`}
                    onClick={() => handleOpenModal(order)}
                  >
                    {/* Thumbnail (85.6×54 vertical card ratio) */}
                    <div className="rounded-lg overflow-hidden bg-gray-700 flex-shrink-0" style={{ height: '134px', aspectRatio: '54/85.6' }}>
                      {(() => {
                        const imgProp = order.line_items[0]?.properties?.find((p: any) => p.name === "_original_view_2" && p.value);
                        return <img src={imgProp ? imgProp.value : "/card-default.jpg"} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/card-default.jpg'; }} />;
                      })()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white font-mono">{order.name}</span>
                        {(() => {
                          const st = order.line_items[0].properties.find((p: any) => p.name === "story-type")?.value || "Standard";
                          const lang = order.line_items[0].properties.find((p: any) => p.name === "story-language")?.value || "";
                          let bgColor = "bg-gray-600";
                          if (st.toLowerCase() === "mother") bgColor = "bg-purple-600";
                          else if (st.toLowerCase() === "love") bgColor = "bg-red-600";
                          else if (st.toLowerCase() === "friendship") bgColor = "bg-blue-500";
                          let langColor = "bg-gray-600";
                          if (lang.toLowerCase() === "ar") langColor = "bg-amber-800";
                          else if (lang.toLowerCase() === "en") langColor = "bg-green-800";
                          else if (lang.toLowerCase() === "fr") langColor = "bg-blue-900";
                          return <>
                            <span className={`px-1.5 py-0.5 ${bgColor} rounded text-white text-[10px] font-bold`}>{st.toUpperCase()}</span>
                            {lang && <span className={`px-1.5 py-0.5 ${langColor} rounded text-white text-[10px] font-bold`}>{lang.toUpperCase()}</span>}
                          </>;
                        })()}
                      </div>
                      <div className="text-sm text-gray-300 truncate">{order?.shipping_address?.first_name} {order?.shipping_address?.last_name}{order?.shipping_address?.city ? ` • ${order.shipping_address.city}` : ''}</div>
                      <div className="text-[10px] text-gray-400 italic truncate">{order.line_items[0].variant_title}</div>
                      {/* Read-only statuses */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStatusSelectClassName(storyStages[order.id] || "Pending")}`}>
                          {storyStages[order.id] || "Pending"}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPrintablesStatusSelectClassName(printablesStatuses[order.id] || "Pending")}`}>
                          {printablesStatuses[order.id] || "Pending"}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStatusSelectClassName(fulfillmentStatuses[order.id] || "New Order")}`}>
                          {fulfillmentStatuses[order.id] || "New Order"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Desktop Row ── */}
                  <div
                    className={`hidden md:grid ${GRID_COLS} border-b border-gray-200 dark:border-gray-700 hover:brightness-110 ${getRowBackgroundClass(order, storyStages, printablesStatuses, fulfillmentStatuses)} min-w-0 cursor-default p-2`}
                  >
                    {/* Column 0: Thumbnail + Order Number + Customer + Print/Shopify (desktop) */}
                    <div className="px-3 py-2 flex gap-3 items-start">
                      {/* Desktop Thumbnail (85.6×54 vertical card ratio) */}
                      <div className="rounded-lg overflow-hidden bg-gray-700 flex-shrink-0" style={{ height: '134px', aspectRatio: '54/85.6' }}>
                        {(() => {
                          const imgProp = order.line_items[0]?.properties?.find((p: any) => p.name === "_original_view_2" && p.value);
                          return <img src={imgProp ? imgProp.value : "/card-default.jpg"} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/card-default.jpg'; }} />;
                        })()}
                      </div>
                      <div className="flex flex-col items-start">
                      <span className="text-2xl font-bold text-white font-mono">{order.name}</span>
                      {/* Desktop: customer info below order number */}
                      <div className="flex flex-col gap-0.5 mt-1 text-sm text-gray-300">
                        <span className="font-medium">{order?.shipping_address?.first_name} {order?.shipping_address?.last_name}</span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          {order?.shipping_address?.city && <span>{order.shipping_address.city}</span>}
                          {order?.shipping_address?.city && getPhoneNumber(order) && <span>•</span>}
                          {getPhoneNumber(order) && (
                            <a
                              href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {getPhoneNumber(order)}
                            </a>
                          )}
                        </div>
                        {/* WhatsApp Quick Actions */}
                        <div className="flex gap-1 mt-1">
                          <a
                            href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)), `Hello ${order?.shipping_address?.first_name}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                            title="Quick Hello"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-[18px]">waving_hand</span>
                          </a>
                          <a
                            href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)), `Hello ${order?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                            title="Thank You Message"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                          </a>
                          {order.metafields?.some((mf: any) => mf.namespace === "custom" && mf.key === "story-url") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSendPreviewLink(order); }}
                              className="flex items-center justify-center w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                              title="Send Preview Link"
                            >
                              <span className="material-symbols-outlined text-[18px]">Draft</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        <button
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition text-xs font-medium"
                          onClick={(e) => { e.stopPropagation(); handleOpenShopifyOrderPage(order); }}
                          title="Open Shopify Order Page"
                        >
                          <span className="material-symbols-outlined text-[18px]">shoppingmode</span>
                          Shopify
                        </button>
                        <button
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition text-xs font-medium"
                          onClick={(e) => { e.stopPropagation(); handleOpenShopifyPrintPage(order); }}
                          title="Print Shopify Order"
                        >
                          <span className="material-symbols-outlined text-[18px]">print</span>
                          Print
                        </button>
                      </div>
                      </div>
                    </div>

                    {/* Column 2: Product Properties */}
                    <div className="px-3 py-2 text-gray-800 dark:text-gray-300">
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        {(() => {
                          const st = order.line_items[0].properties.find((p: any) => p.name === "story-type")?.value || "Standard";
                          const lang = order.line_items[0].properties.find((p: any) => p.name === "story-language")?.value || "";
                          let bgColor = "bg-gray-600";
                          if (st.toLowerCase() === "mother") bgColor = "bg-purple-600";
                          else if (st.toLowerCase() === "love") bgColor = "bg-red-600";
                          else if (st.toLowerCase() === "friendship") bgColor = "bg-blue-500";
                          let langColor = "bg-gray-600";
                          if (lang.toLowerCase() === "ar") langColor = "bg-amber-800";
                          else if (lang.toLowerCase() === "en") langColor = "bg-green-800";
                          else if (lang.toLowerCase() === "fr") langColor = "bg-blue-900";
                          return (
                            <>
                              <span className={`inline-block px-2 py-0.5 ${bgColor} rounded text-white text-xs font-bold`}>
                                {st.toUpperCase()}
                              </span>
                              {lang && (
                                <span className={`inline-block px-2 py-0.5 ${langColor} rounded text-white text-xs font-bold`}>
                                  {lang.toUpperCase()}
                                </span>
                              )}
                            </>
                          );
                        })()}
                        {storyType?.value && (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${storyType.value.toLowerCase() === "self" ? "bg-green-600 text-white" : storyType.value.toLowerCase() === "help" ? "bg-yellow-500 text-white" : "bg-gray-500 text-white"}`}>
                            {storyType.value}
                          </span>
                        )}
                      </div>
                      <div className="text-sm"><i>{order.line_items[0].variant_title}</i></div>
                      {toggledRows[order.id] ? (
                        order.line_items[0].properties.map((prop: any) => (
                          <div key={prop.name} className="text-xs mt-1">
                            <b>{prop.name}:</b>{" "}
                            {/^https?:\/\/\S+/.test(prop.value) ? (
                              <a href={prop.value} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline break-all">{prop.value}</a>
                            ) : (
                              <span className="text-gray-400">{prop.value}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <>
                          {order.line_items[0].properties
                            .filter((p: any) => ["title", "dedication_line"].includes(p.name))
                            .map((prop: any) => (
                              <div key={prop.name} className="text-xs text-gray-400 mt-0.5">
                                {prop.value}
                              </div>
                            ))}
                        </>
                      )}
                      <div className="text-xs font-semibold mt-1">
                        {getOrderURL(order) ? `${getOrderURL(order)}.ossotna.com` : "Auto Generated"}
                      </div>
                    </div>

                    {/* Column 3: Subdomain Input & Actions */}
                    <div className="px-3 py-2 text-gray-800 dark:text-gray-300">
                      <label
                        htmlFor={`subdomain-${order.id}`}
                        className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                      >
                        Subdomain URL
                      </label>
                      <input
                        type="text"
                        id={`subdomain-${order.id}`}
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${
                          subdomainValue === getDefaultSubdomain(order)
                            ? "border-gray-500"
                            : "border-blue-500"
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
                      <div className="flex items-start justify-start gap-1 mt-1">
                        <button
                          className={`flex items-center justify-center w-9 h-9 rounded transition ${subdomainValue === getDefaultSubdomain(order) ? "bg-gray-600 text-gray-500 cursor-not-allowed opacity-50" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
                          onClick={() => handleSaveSubdomain(order.id, subdomainValue)}
                          disabled={subdomainValue === getDefaultSubdomain(order)}
                          title="Save Subdomain"
                        >
                          <span className="material-symbols-outlined text-[20px]">save</span>
                        </button>
                        <button
                          className="flex items-center justify-center w-9 h-9 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                          onClick={() => {
                            const customURL = getOrderURL(order);
                            const randomDigits = Math.floor(10000 + Math.random() * 90000);
                            const st = order.line_items[0].properties.find((p: any) => p.name === "story-type")?.value || "";
                            const prefix = st.toLowerCase() === "mother" ? "mom-" : "book-";
                            const fallback = `${prefix}${randomDigits}`;
                            setSubdomains((prev) => ({ ...prev, [order.id]: customURL || fallback }));
                          }}
                          title="Auto-Fill Subdomain"
                        >
                          <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                        </button>
                        <button
                          className={`flex items-center justify-center w-9 h-9 rounded transition ${subdomainValue ? "bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white" : "bg-gray-600 text-gray-500 cursor-not-allowed opacity-50"}`}
                          onClick={() => handleGenerateQRCode(subdomainValue)}
                          disabled={!subdomainValue}
                          title="Generate QR Code"
                        >
                          <span className="material-symbols-outlined text-[20px]">qr_code</span>
                        </button>
                      </div>
                    </div>

                    {/* Column 4: Story */}
                    <div className="px-3 py-2 text-gray-800 dark:text-gray-300">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Story</label>
                      <select
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 ${getStatusSelectClassName(storyStages[order.id] || "Pending")}`}
                        value={storyStages[order.id] || "Pending"}
                        onChange={(e) => handleStoryStageChange(order.id, e.target.value)}
                      >
                        {storyStageOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Column 5: Printables */}
                    <div className="px-3 py-2 text-gray-800 dark:text-gray-300">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Printables</label>
                      <select
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 ${getPrintablesStatusSelectClassName(printablesStatuses[order.id] || "Pending")}`}
                        value={printablesStatuses[order.id] || "Pending"}
                        onChange={(e) => handlePrintablesStatusChange(order.id, e.target.value)}
                      >
                        {printablesStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Column 6: Fulfillment */}
                    <div className="px-3 py-2 text-gray-800 dark:text-gray-300">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fulfillment</label>
                      <select
                        className={`w-full p-2 border rounded text-gray-800 dark:text-gray-100 ${getStatusSelectClassName(fulfillmentStatuses[order.id] || "New Order")}`}
                        value={fulfillmentStatuses[order.id] || "New Order"}
                        onChange={(e) => handleFulfillmentStatusChange(order.id, e.target.value)}
                      >
                        {fulfillmentStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {order.tags && order.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {order.tags.map((tag: string) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Column 7: Action Buttons */}
                    <div className="flex flex-col gap-1 pl-5 pr-2 py-2 justify-center">
                      {/* Row 1: Upload + Copy Images */}
                      <div className="flex gap-1">
                        <button
                          className={`flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 transition ${loadingOrders[order.id] ? "text-gray-500 cursor-not-allowed" : "text-green-400 hover:text-green-300"}`}
                          onClick={(e) => { e.stopPropagation(); handleProcessAndUploadImages(order); }}
                          disabled={loadingOrders[order.id]}
                          title="Process & Upload Images"
                        >
                          <span className={`material-symbols-outlined text-[22px] ${loadingOrders[order.id] ? "animate-spin" : ""}`}>{loadingOrders[order.id] ? "autorenew" : "cloud_upload"}</span>
                        </button>
                        <button
                          className={`flex items-center justify-center w-10 h-10 rounded transition ${order.metafields?.some((mf: any) => mf.namespace === "custom" && mf.key === "story-photos") ? "bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white" : "bg-gray-700 text-gray-500 opacity-50"}`}
                          onClick={(e) => { e.stopPropagation(); handleCopyStoryPhotosJSON(order); }}
                          disabled={!order.metafields?.some((mf: any) => mf.namespace === "custom" && mf.key === "story-photos")}
                          title="Copy Images JSON"
                        >
                          <span className="material-symbols-outlined text-[22px]">photo_library</span>
                        </button>
                      </div>
                      {/* Row 2: Story + Copy Props */}
                      <div className="flex gap-1">
                        <button
                          className="flex items-center justify-center w-10 h-10 rounded bg-purple-700 hover:bg-purple-600 text-white transition"
                          onClick={(e) => { e.stopPropagation(); handleCopyProperties(order); setSelectedOrder(order); setActiveModalTab("story"); setIsModalOpen(true); }}
                          title="Generate Story"
                        >
                          <span className="material-symbols-outlined text-[22px]">auto_stories</span>
                        </button>
                        <button
                          className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                          onClick={(e) => { e.stopPropagation(); handleCopyProperties(order); }}
                          title="Copy Properties"
                        >
                          <span className="material-symbols-outlined text-[22px]">content_copy</span>
                        </button>
                      </div>
                      {/* Row 3: Open Story + Open Localhost */}
                      <div className="flex gap-1">
                        <button
                          className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                          onClick={(e) => { e.stopPropagation(); handleCopyPasswordAndOpenSubdomain(order); }}
                          title="Open Story"
                        >
                          <span className="material-symbols-outlined text-[22px]">language</span>
                        </button>
                        <button
                          className="flex items-center justify-center w-10 h-10 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                          onClick={(e) => { e.stopPropagation(); handleCopySubdomainAndOpenLocalhost(order); }}
                          title="Open Story Localhost"
                        >
                          <span className="material-symbols-outlined text-[22px]">dns</span>
                        </button>
                      </div>
                      {/* Progress Indicators */}
                      {downloadProgress[order.id] && (
                        <div className="text-xs text-gray-300">
                          DL {downloadProgress[order.id].current}/{downloadProgress[order.id].total}
                        </div>
                      )}
                      {uploadProgress[order.id] && (
                        <div className="text-xs text-gray-300">
                          UL {uploadProgress[order.id].current}/{uploadProgress[order.id].total}
                        </div>
                      )}
                    </div>

                    {/* Column 8: Order Detail Button (desktop only) */}
                    <div className="px-1 py-1 flex items-stretch justify-center">
                      <button
                        className="flex items-center justify-center w-12 h-full rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(order); }}
                        title="Open Order Details"
                      >
                        <span className="material-symbols-outlined text-[28px]">aspect_ratio</span>
                      </button>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersTable;
