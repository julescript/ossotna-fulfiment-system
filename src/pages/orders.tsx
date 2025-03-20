import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import dynamic from 'next/dynamic'; // Import dynamic from Next.js
import ImageUploadModal from '../components/ImageUploadModal';
import LogoutButton from '../components/LogoutButton';

// Dynamically import QR Scanner components
const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), { ssr: false });
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
  markOrderReadyForDeliveryAPI,
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
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [clipboardContent, setClipboardContent] = useState("");
  const [generatedStory, setGeneratedStory] = useState("");
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isNfcWriteModalOpen, setIsNfcWriteModalOpen] = useState(false);
  const [nfcUrl, setNfcUrl] = useState("");
  const [isNfcWriting, setIsNfcWriting] = useState(false);
  const [isNfcVerifying, setIsNfcVerifying] = useState(false);
  const [nfcWriteAttempts, setNfcWriteAttempts] = useState(0);
  const [showFulfillConfirmation, setShowFulfillConfirmation] = useState(false);
  const [orderToFulfill, setOrderToFulfill] = useState(null);
  const [lastReadUrl, setLastReadUrl] = useState("");
  const [showDoneButton, setShowDoneButton] = useState(false);
  const [verificationCompleted, setVerificationCompleted] = useState(false);
  const [isDeliveryScanOpen, setIsDeliveryScanOpen] = useState(false);
  const [currentScanOrder, setCurrentScanOrder] = useState(null);
  const [scanStatus, setScanStatus] = useState("ready"); // ready, loading, success, error
  const [isFulfilling, setIsFulfilling] = useState(false);

  // 1) Add storyStatuses state & statusOptions array
  const [storyStatuses, setStoryStatuses] = useState({});
  const statusOptions = [
    "New Order",
    "Waiting Story",
    "Story Draft",
    "Story Live",
    "Story Approved",
    "Printables Ready",
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
      toast.error(`Error: ${error.message || 'Unknown error sending preview link'}`);
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
      
      // Create delivery message text
      const messageText = `📦 Hello, we're delivering your Ossotna order ${order.name || ''}. Please share your location pin and have the exact amount prepared as we cannot guarantee change. Thank you!`
      
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
  
  // Show confirmation before fulfilling order
  const handleFulfillOrder = (order) => {
    if (!order) return;
    setOrderToFulfill(order);
    setShowFulfillConfirmation(true);
  };
  
  // Actually fulfill the order after confirmation
  const confirmFulfillOrder = async () => {
    if (!orderToFulfill) return;
    
    try {
      setIsFulfilling(true);
      setShowFulfillConfirmation(false);
      
      const response = await fetch('/api/shopify/fulfillment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderToFulfill.id
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.warning) {
          // Order was fulfilled but not marked as paid
          console.warn('Warning from API:', data.warning, data.details);
          
          // Check if it's the common "already paid" error
          const alreadyPaidMessage = data.details?.some(error => 
            error.message && error.message.toLowerCase().includes('already paid'));
            
          if (alreadyPaidMessage) {
            toast.success('Order marked as fulfilled (was already paid)');
          } else {
            toast.warning(`Order marked as fulfilled but not paid: ${data.details?.[0]?.message || data.warning}`);
          }
        } else if (data.message && data.message.includes('already fulfilled and paid')) {
          toast.info('Order was already fulfilled and paid');
        } else {
          toast.success('Order marked as fulfilled and paid');
        }
        // Refresh orders after fulfillment
        fetchOrders(limit);
      } else {
        toast.error(`Failed to fulfill order: ${data.error || 'Unknown error'}`);
        console.error('Fulfillment error details:', data.details || 'No details provided');
      }
    } catch (error) {
      console.error('Error fulfilling order:', error);
      toast.error('Error fulfilling order');
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
    // Update story statuses if the value has changed for an order.
    setStoryStatuses(prev => {
      let updated = false;
      const newStatuses = { ...prev };
      orders.forEach(order => {
        // Only update if metafields exist for this order.
        if (order.metafields && order.metafields.length > 0) {
          const storyStatusMetafield = order.metafields.find(
            mf => mf.namespace === "custom" && mf.key === "story-status"
          );
          const newStatus = storyStatusMetafield?.value || "New Order";
          if (newStatuses[order.id] !== newStatus) {
            newStatuses[order.id] = newStatus;
            updated = true;
          }
        }
      });
      return updated ? newStatuses : prev;
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
      await saveMetafieldAPI(order.id, "story-photos", "json_string", JSON.stringify(photoUrls));

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
                  name: `chapter_${i+1}_photo`,
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
        setNfcWriteAttempts(0); // Reset attempt counter when opening modal
        setIsNfcVerifying(false); // Reset verification state
        setVerificationCompleted(false); // Reset verification completed flag
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
    const newLimit = parseInt(e.target.value, 10);
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
            price: parsedPrice.toFixed(2), // Ensure two decimal places
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
  const handleSaveDedicationLine = (orderId, dedicationLine) => {
    console.log("handleSaveMetafield", orderId, dedicationLine)
    handleSaveMetafield(orderId, "story-dedication", dedicationLine);
  };

  const handleSaveStoryTitle = (orderId, storyTitle) => {
    console.log("handleSaveMetafield", orderId, storyTitle)
    handleSaveMetafield(orderId, "story-title", storyTitle);
  };

  const handleSaveMilestoneDate = (orderId, milestoneDate) => {
    console.log("handleSaveMilestoneDate", orderId, milestoneDate);
    // Save to the metafield
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
    // We don't need to check the property here, just if the state matches the metafield
    if (!metafield?.value) return false; // Metafield is empty or doesn't exist
    return milestoneDates[order.id] === metafield.value;
  };

  // Add these handler functions inside your OrdersPage component

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
          toast.success("Subdomain matches!", { autoClose: 2000 });
          // Close the scanner modal and open NFC modal
          setIsSubdomainCheckOpen(false);
          setIsScannerPaused(false); // Reset for next time
          // Open NFC modal with the current subdomain
          const fullUrl = `https://${currentSubdomain}.ossotna.com`;
          setNfcUrl(fullUrl);
          console.log("Setting NFC URL to:", fullUrl);
          setNfcWriteAttempts(0); // Reset attempt counter when opening from QR scan
          setIsNfcVerifying(false); // Reset verification state
          setVerificationCompleted(false); // Reset verification completed flag
          setIsNfcWriteModalOpen(true);
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
          
          // Only update the metafield status without creating a fulfillment
          saveStatusAPI(order.id, "Ready for Delivery")
            .then(() => {
              // Update local state
              setStoryStatuses(prev => ({
                ...prev,
                [order.id]: "Ready for Delivery"
              }));
              
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
    
    // Format with Lebanese country code
    if (digits.startsWith('0')) {
      // If it starts with 0, replace with Lebanese country code
      return `+961${digits.slice(1)}`;
    } else if (!digits.startsWith('961')) {
      // If it doesn't already have the country code, add it
      return `+961${digits}`;
    } else {
      // If it already has the country code but no +, add it
      return `+${digits}`;
    }
  };
  
  // Format phone number for WhatsApp (wa.me format requires no + sign)
  const formatPhoneForWhatsApp = (phone) => {
    const formattedPhone = formatLebanesePhoneNumber(phone);
    return formattedPhone.replace(/\+/g, '');
  };
  
  // Determine if we should use web.whatsapp.com or wa.me based on device
  const getWhatsAppUrl = (phoneNumber, message = '') => {
    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // For mobile, use wa.me which will open the app
    if (isMobile) {
      return `https://wa.me/${phoneNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    }
    
    // For desktop, use web.whatsapp.com which will open in browser
    return `https://web.whatsapp.com/send?phone=${phoneNumber}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
  };

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
      <div className="p-4 md:p-6 bg-gray-900 min-h-screen relative">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center justify-start mb-4">
          <img src="/ossotna-FC-logo.svg" alt="Ossotna Logo" className="h-10 mr-2" />
          <LogoutButton />
        </div>
        
        {/* Mobile Navigation - Fixed at top */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-800 p-2 pt-4 flex justify-between items-center border-b border-gray-500 px-4">
          {/* <div className="flex-1"></div> */}
          <img src="/ossotna-FC-logo.svg" alt="Ossotna Logo" className="h-10 mb-2" />
          <div className="flex-1 flex justify-end">
            <LogoutButton />
          </div>
        </div>
        
        {/* Mobile Footer Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-700 p-4 flex flex-col gap-3 border-t border-gray-400 shadow-lg">
          <button
            onClick={() => setIsCameraOpen(true)}
            className="p-4 bg-blue-600 text-white rounded-md shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full flex items-center justify-center gap-2 transition-colors border-gray-400 border"
            title="Scan Order QR Code"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            <span className="font-medium text-lg">Scan Order Label</span>
          </button>
          
          <button
            onClick={() => setIsDeliveryScanOpen(true)}
            className="p-4 bg-green-600 text-white rounded-md shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 w-full flex items-center justify-center gap-2 transition-colors border-gray-400 border"
            title="Mark as Ready for Delivery"
          >
            <span className="material-symbols-outlined">local_shipping</span>
            <span className="font-medium text-lg">Mark Ready for Delivery</span>
          </button>
        </div>
        
        {/* Spacer for fixed mobile navigation */}
        {/* <div className="md:hidden h-16"></div> */}
        
        {/* Spacer for fixed mobile footer */}
        <div className="md:hidden h-14 mb-4"></div>

        {/* Limit Selector */}
        <div className="mb-4 flex items-center gap-4">
          <label htmlFor="limit" className="text-white">
            Orders Fetched
          </label>
          <select
            id="limit"
            value={limit}
            onChange={handleLimitChange}
            className="p-2 bg-gray-600 text-white rounded border border-gray-500"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
          </select>

          {/* Top Right Buttons */}
          <div className="fixed top-6 right-6 md:flex hidden space-x-4">
            {/* QR Code Camera Button - Desktop only */}
            <button
              onClick={() => setIsCameraOpen(true)}
              className="p-4 pr-5 pl-5 pt-5 bg-blue-500 text-white rounded shadow-lg hover:bg-blue-600 focus:outline-none"
              title="Scan Order QR Code"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
            
            {/* Image Upload Button - Desktop only */}
            <button
              onClick={() => setIsImageUploadModalOpen(true)}
              className="p-4 pr-5 pl-5 pt-5 bg-green-600 text-white rounded shadow-lg hover:bg-green-700 focus:outline-none"
              title="Upload Custom Images"
            >
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>
          </div>

        </div>

        {/* Order Count Display */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-white text-lg font-medium">Orders</h2>
          <span className="text-gray-300 bg-gray-700 px-3 py-1 rounded-full text-sm">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} showing
          </span>
        </div>

        {/* Main Table Container */}
        <div className={`h-full w-full md:pb-0 pb-44 ${isLoading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="h-full w-full bg-gray-900 flex items-center justify-center">
            <div className="w-full h-full">
              <div className="h-full w-full bg-gray-800 shadow-md rounded-md overflow-hidden border border-gray-600 table-fixed">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-gray-600 text-white font-bold border-b border-gray-500">
                  <div className="col-span-9 md:col-span-2 p-4 md:p-4 p-2 truncate min-w-0">Order</div>

                  {/* Hide on Mobile */}
                  <div className="col-span-0 md:col-span-2 p-4 md:p-4 p-2 hidden md:block truncate min-w-0">Subdomain</div>
                  <div className="col-span-0 md:col-span-2 p-4 md:p-4 p-2 hidden md:block truncate min-w-0">Story Status</div>
                  <div className="col-span-0 md:col-span-4 p-4 md:p-4 p-2 hidden md:block truncate min-w-0">Product Properties</div>

                  <div className="col-span-3 md:col-span-2 p-4 md:p-4 p-2 text-center truncate min-w-0">Actions</div>
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
                        className={`grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${storyStatuses[order.id] === "Ready for Delivery" ? "bg-green-900 dark:hover:bg-green-800" : (storyStatuses[order.id] === "New Order" ? "dark:bg-gray-600" : (storyStatuses[order.id] === "Waiting Story" ? "dark:bg-[rgba(255,20,0,0.2)]" : ""))} min-w-0`}
                      >
                        {/* Column 1: Order Info (with WhatsApp Quick-Action Buttons) */}
                        <div className="col-span-9 md:col-span-2 p-4 md:p-4 p-2 text-gray-800 dark:text-gray-300 overflow-hidden">
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
                          {order?.shipping_address?.city && (
                            <>
                              {order.shipping_address.city}
                              <br />
                            </>
                          )}
                          {/* Show phone or "N/A" */}
                          <a
                            href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-blue-500 underline"
                          >
                            {getPhoneNumber(order) || "N/A"}
                          </a>
                          <a
                            href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="md:hidden text-blue-500 underline"
                          >
                            {getPhoneNumber(order) || "N/A"}
                          </a>
                          <br />

                          {/* 1) Quick Hello Button */}
                          <a
                            href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)), 
                              `Hello ${order?.shipping_address?.first_name}`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                          >
                            <span className="material-symbols-outlined">waving_hand</span>
                          </a>

                          {/* 2) Thank You / Intro Message Button */}
                          <a
                            href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(order)), 
                              `Hello ${order?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`
                            )}
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendPreviewLink(order);
                                }}
                                className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block"
                              >
                                <span className="material-symbols-outlined">Draft</span>
                              </button>
                            )}

                          <div className={`md:hidden w-full p-1 pl-2 rounded border-gray-300 text-gray-800 dark:text-gray-100 dark:bg-gray-700 ${storyStatuses[order.id] === "Ready for Delivery"
                            ? "border-green-500 text-green-500 dark:bg-green-900"
                            : "border-gray-300"
                            }`}><i>{storyStatuses[order.id] || "New Order"}</i></div>
                        </div>

                        {/* Column 2: Subdomain Input & Actions */}
                        <div className="col-span-0 md:col-span-2 p-4 md:p-4 p-2 text-gray-800 dark:text-gray-300 hidden md:block">
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
                                
                                // Check if story type is mother
                                const storyType = order.line_items[0].properties.find(p => p.name === "story-type")?.value || "";
                                let prefix = "book-";
                                
                                if (storyType.toLowerCase() === "mother") {
                                  prefix = "mom-";
                                }
                                
                                const fallback = `${prefix}${randomDigits}`;
                                
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
                        <div className="col-span-0 md:col-span-2 p-4 md:p-4 p-2 text-gray-800 dark:text-gray-300 hidden md:block">
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
                        <div className="col-span-0 md:col-span-4 p-4 md:p-4 p-2 text-gray-800 dark:text-gray-300 hidden md:block">
                          {/* Display story-type label first */}
                          {(() => {
                            const storyType = order.line_items[0].properties.find(p => p.name === "story-type")?.value || "Standard";
                            let bgColor = "bg-gray-600";
                            
                            if (storyType.toLowerCase() === "mother") {
                              bgColor = "bg-purple-600";
                            } else if (storyType.toLowerCase() === "love") {
                              bgColor = "bg-red-600";
                            } else if (storyType.toLowerCase() === "friendship") {
                              bgColor = "bg-blue-800";
                            }
                            
                            return (
                              <div className={`mt-2 mb-2 p-2 ${bgColor} rounded text-white font-bold`}>
                                {storyType.toUpperCase()}
                              </div>
                            );
                          })()}
                          <i>{order.line_items[0].variant_title}</i>
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
                            <>
                              {order.line_items[0].properties
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
                              ))}
                            </>
                          )}
                          <b>
                            {getOrderURL(order)
                              ? `${getOrderURL(order)}.ossotna.com`
                              : "Auto Generated"}
                          </b>
                        </div>

                        {/* Column 5: Action Buttons */}
                        <div className="col-span-3 md:col-span-2 p-4 md:p-4 p-2 text-center flex flex-col items-end justify-start gap-2">
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
                            
                            {/* Generate Story */}
                            <button
                              className="text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-purple-700 hover:bg-purple-900 hidden md:block"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyProperties(order);
                                setIsStoryModalOpen(true);
                              }}
                              title="Generate Story"
                              aria-label="Generate Story"
                            >
                              <span className="material-symbols-outlined">auto_stories</span>
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

        {/* Image Upload Modal */}
        <ImageUploadModal 
          isOpen={isImageUploadModalOpen} 
          onClose={() => setIsImageUploadModalOpen(false)} 
        />
        
        {/* Story Generation Modal */}
        {isStoryModalOpen && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 w-11/12 max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold dark:text-white">{selectedOrder.name} | Generate Story</h2>
                  <button
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                    onClick={() => {
                      setIsModalOpen(true);
                    }}
                  >
                    View Order Details
                  </button>
                </div>
                <button
                  onClick={() => {
                    setIsStoryModalOpen(false);
                    setGeneratedStory("");
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 flex-grow overflow-hidden">
                {/* Left side - Clipboard Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <h6 className="text-sm font-light mb-2 dark:text-white">Order Properties</h6>
                  <div className="relative flex-grow">
                    <div className="absolute top-0 right-0 bg-gray-200 dark:bg-gray-600 px-2 py-1 text-xs font-semibold rounded-bl z-10">markdown</div>
                    <textarea
                      className="w-full h-[600px] p-4 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded resize-none"
                      value={clipboardContent}
                      onChange={(e) => setClipboardContent(e.target.value)}
                      readOnly={false}
                      placeholder="# Order Properties\n\nPaste or edit order properties here..."
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
                      className="w-full h-[600px] p-4 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded resize-none"
                      value={generatedStory}
                      onChange={(e) => setGeneratedStory(e.target.value)}
                      readOnly={false}
                      placeholder="// Generated TypeScript will appear here..."
                    ></textarea>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-4 gap-2">
                <button
                  onClick={() => {
                    setIsGeneratingStory(true);
                    // Call the OpenAI assistant API
                    fetch('/api/generate-story', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
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
          </div>
        )}
        
        <ToastContainer />
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
                  <h2 className="text-xl font-bold mb-2">{selectedOrder.name}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 bg-purple-500 text-white rounded-md text-sm hover:bg-purple-600 transition-colors"
                      onClick={() => {
                        setIsStoryModalOpen(true);
                      }}
                    >
                      Generate Story
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{selectedOrder.line_items[0].variant_title}</span>
                  </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 z-10 absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center h-8 w-8"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* MAIN CONTENT: Adjusted for Responsiveness */}
              <div className="flex-1 overflow-hidden p-0">
                <div className={`flex flex-col md:flex-row h-full overflow-hidden overflow-y-auto ${isMobile() ? "space-y-4" : "space-x-4"}`}>

                  {/* RIGHT HALF: Preview Cards */}
                  <div className={`w-full md:w-1/2 p-0 md:p-6 flex items-start justify-start flex-col gap-0 md:gap-6 md:overflow-y-auto`}>
                    <TwoFramesPreview
                      milestoneDate={milestoneDates[selectedOrder.id]}
                      title={storyTitles[selectedOrder.id]}
                      dedicationLine={dedicationLines[selectedOrder.id]}
                      qr={generatedQRCodes[selectedOrder.id]}
                      subdomain={subdomainValue(selectedOrder)}
                    />
                    
                    {/* Story Type Display and Shopify Button - Both Mobile and Desktop */}
                    <div className="w-full px-4 py-2 flex justify-center items-center gap-3 mb-4">
                      {(() => {
                        const storyType = selectedOrder.line_items[0].properties.find(
                          (prop) => prop.name === "story-type"
                        )?.value || "Standard";
                        
                        // Define color based on story type
                        let bgColor = "bg-gray-500";
                        let textColor = "text-white";
                        
                        if (storyType === "mother") {
                          bgColor = "bg-pink-500";
                        } else if (storyType === "love") {
                          bgColor = "bg-red-500";
                        } else if (storyType === "friendship") {
                          bgColor = "bg-blue-500";
                        }
                        
                        return (
                          <div className={`${bgColor} ${textColor} px-4 py-2 rounded-full font-medium text-sm inline-flex items-center`}>
                            <span className="material-symbols-outlined mr-1">auto_stories</span>
                            {storyType.charAt(0).toUpperCase() + storyType.slice(1)} Story
                          </div>
                        );
                      })()}
                      
                      {/* Shopify Order Button */}
                      <button
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-sm flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenShopifyOrderPage(selectedOrder);
                        }}
                        title="Open Shopify Order Page"
                        aria-label="Open Shopify Order Page"
                      >
                        <span className="material-symbols-outlined mr-1">shopping_cart</span>
                        View in Shopify
                      </button>
                    </div>

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

                    {/* Mobile subdomain section removed from here, moved to fixed footer */}

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
                                console.log("Load Milestone Date button clicked");
                                console.log("Selected Order:", selectedOrder);
                                console.log("Order Properties:", selectedOrder.line_items[0].properties);
                                
                                // Check if story type is mother
                                const storyType = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "story-type"
                                );
                                console.log("Story Type:", storyType);
                                
                                // Check all property names to help debug
                                const propertyNames = selectedOrder.line_items[0].properties.map(p => p.name);
                                console.log("All property names:", propertyNames);
                                
                                if (storyType?.value === "mother") {
                                  console.log("This is a mother story type");
                                  // Get story-language property or default to 'en'
                                  const languageProp = selectedOrder.line_items[0].properties.find(
                                    (prop) => prop.name === "story-language"
                                  );
                                  const language = languageProp?.value || "en";
                                  
                                  let milestoneValue = "A Mother's Story";
                                  
                                  // Translate based on language
                                  if (language === "ar") {
                                    milestoneValue = "قصّة أمّ";
                                  } else if (language === "fr") {
                                    milestoneValue = "L'histoire d'une mère";
                                  }
                                  
                                  // Force update the DOM by using a timeout
                                  setTimeout(() => {
                                    setMilestoneDates((prev) => ({
                                      ...prev,
                                      [selectedOrder.id]: milestoneValue,
                                    }));
                                  }, 0);
                                  
                                  // Also update the input field directly for immediate feedback
                                  const inputField = document.getElementById("milestone-date") as HTMLInputElement;
                                  if (inputField) {
                                    inputField.value = milestoneValue;
                                  }
                                } else {
                                  // Default behavior for non-mother story types
                                  // Try all possible property name variations
                                  const possibleNames = ["milestone_date", "milestone date", "milestone-date"];
                                  let value = "";
                                  
                                  for (const name of possibleNames) {
                                    const property = selectedOrder.line_items[0].properties.find(
                                      (prop) => prop.name === name
                                    );
                                    if (property?.value) {
                                      value = property.value;
                                      break;
                                    }
                                  }
                                  
                                  // Force update the DOM by using a timeout
                                  setTimeout(() => {
                                    setMilestoneDates((prev) => ({
                                      ...prev,
                                      [selectedOrder.id]: value,
                                    }));
                                  }, 0);
                                  
                                  // Also update the input field directly for immediate feedback
                                  const inputField = document.getElementById("milestone-date") as HTMLInputElement;
                                  if (inputField) {
                                    inputField.value = value;
                                  }
                                }
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
                                console.log("Load Story Title button clicked");
                                console.log("Selected Order:", selectedOrder);
                                console.log("Order Properties:", selectedOrder.line_items[0].properties);
                                
                                // Check if story type is mother
                                const storyType = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "story-type"
                                );
                                console.log("Story Type:", storyType);
                                
                                // Check all property names to help debug
                                const propertyNames = selectedOrder.line_items[0].properties.map(p => p.name);
                                console.log("All property names:", propertyNames);
                                
                                if (storyType?.value === "mother") {
                                  console.log("This is a mother story type");
                                  // For mother story, use mom_name from product properties
                                  const momNameProp = selectedOrder.line_items[0].properties.find(
                                    (prop) => prop.name === "mom_name"
                                  );
                                  console.log("Mom Name Property:", momNameProp);
                                  const momName = momNameProp?.value || "";
                                  
                                  // Force update the DOM by using a timeout
                                  setTimeout(() => {
                                    setStoryTitles((prev) => ({
                                      ...prev,
                                      [selectedOrder.id]: momName,
                                    }));
                                  }, 0);
                                  
                                  // Also update the input field directly for immediate feedback
                                  const inputField = document.getElementById("story-title") as HTMLInputElement;
                                  if (inputField) {
                                    inputField.value = momName;
                                  }
                                } else {
                                  // Default behavior for non-mother story types
                                  const property = selectedOrder.line_items[0].properties.find(
                                    (prop) => prop.name === "title"
                                  );
                                  const value = property?.value || "";
                                  
                                  // Force update the DOM by using a timeout
                                  setTimeout(() => {
                                    setStoryTitles((prev) => ({
                                      ...prev,
                                      [selectedOrder.id]: value,
                                    }));
                                  }, 0);
                                  
                                  // Also update the input field directly for immediate feedback
                                  const inputField = document.getElementById("story-title") as HTMLInputElement;
                                  if (inputField) {
                                    inputField.value = value;
                                  }
                                }
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
                                console.log("Load Dedication Line button clicked");
                                console.log("Selected Order:", selectedOrder);
                                console.log("Order Properties:", selectedOrder.line_items[0].properties);
                                
                                // Check if story type is mother
                                const storyType = selectedOrder.line_items[0].properties.find(
                                  (prop) => prop.name === "story-type"
                                );
                                console.log("Story Type:", storyType);
                                
                                // Check all property names to help debug
                                const propertyNames = selectedOrder.line_items[0].properties.map(p => p.name);
                                console.log("All property names:", propertyNames);
                                
                                if (storyType?.value === "mother") {
                                  console.log("This is a mother story type");
                                  // For mother story, use "By {kids_name}"
                                  const kidsNameProp = selectedOrder.line_items[0].properties.find(
                                    (prop) => prop.name === "kids_name"
                                  );
                                  console.log("Kids Name Property:", kidsNameProp);
                                  const kidsName = kidsNameProp?.value || "";
                                  
                                  const dedicationValue = kidsName ? `By ${kidsName}` : "";
                                  
                                  // Force update the DOM by using a timeout
                                  setTimeout(() => {
                                    setDedicationLines((prev) => ({
                                      ...prev,
                                      [selectedOrder.id]: dedicationValue,
                                    }));
                                  }, 0);
                                  
                                  // Also update the input field directly for immediate feedback
                                  const inputField = document.getElementById("dedication-line") as HTMLInputElement;
                                  if (inputField) {
                                    inputField.value = dedicationValue;
                                  }
                                } else {
                                  // Default behavior for non-mother story types
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

                                  // Force update the DOM by using a timeout
                                  setTimeout(() => {
                                    setDedicationLines((prev) => ({
                                      ...prev,
                                      [selectedOrder.id]: value,
                                    }));
                                  }, 0);
                                  
                                  // Also update the input field directly for immediate feedback
                                  const inputField = document.getElementById("dedication-line") as HTMLInputElement;
                                  if (inputField) {
                                    inputField.value = value;
                                  }
                                }
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

                  {/* Mobile Fixed Footer for Subdomain Actions */}
                  <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-700 p-3 border-t border-gray-400 shadow-lg">
                    <div className="flex flex-col gap-3">
                      <div className="w-full">
                        <div className="text-sm font-medium text-gray-300 mb-1">SUBDOMAIN</div>
                        <div className="p-3 rounded bg-gray-800 text-white text-base font-medium truncate border border-gray-400 border">{subdomainValue(selectedOrder)}</div>
                      </div>
                      

                      
                      {/* NFC Button - Full width, first opens QR code scanner, then NFC writing */}
                      <button
                        className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-lg flex items-center justify-center gap-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors border-gray-400 border"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open QR code scanner first
                          setIsSubdomainCheckOpen(true);
                        }}
                        title="Write URL to NFC Tag"
                        aria-label="Write URL to NFC Tag"
                      >
                        <span className="material-symbols-outlined">nfc</span>
                        <span className="font-medium text-lg">Prepare NFC Card</span>
                      </button>
                      
                      {/* Delivery Message and Fulfill Order Buttons - Side by side on mobile */}
                      <div className="flex flex-row gap-3">
                        {/* Delivery Message Button */}
                        <button
                          className="p-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md shadow-lg flex items-center justify-center gap-2 w-1/2 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors border-gray-400 border"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendDeliveryMessage(selectedOrder);
                          }}
                          title="Send Delivery Message"
                          aria-label="Send Delivery Message"
                        >
                          <span className="material-symbols-outlined">send</span>
                          <span className="font-medium text-sm md:text-lg">Delivery Msg</span>
                        </button>
                        
                        {/* Fulfill Order Button */}
                        <button
                          className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-lg flex items-center justify-center gap-2 w-1/2 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors border-gray-400 border"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFulfillOrder(selectedOrder);
                          }}
                          disabled={isFulfilling}
                          title="Mark as Fulfilled & Paid"
                          aria-label="Mark as Fulfilled & Paid"
                        >
                          <span className="material-symbols-outlined">{isFulfilling ? 'hourglass_top' : 'check_circle'}</span>
                          <span className="font-medium text-sm md:text-lg">{isFulfilling ? 'Processing...' : 'Mark Fulfilled'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Spacer for fixed mobile footer in modal */}
                  <div className="md:hidden h-16 mb-2"></div>

                  {/* LEFT HALF: Scrollable list of filtered properties */}
                  <div className="w-full md:w-1/2 md:overflow-y-auto p-6 flex flex-col align-center justify-start relative md:pb-6 pb-44">
                    <div className="text-center font-bold bg-black p-4 md:block hidden">ORDER PROPERTIES</div>

                    {/* Column 1: Order Info (with WhatsApp Quick-Action Buttons) */}
                    <div className="col-span-9 md:col-span-2 text-gray-800 dark:text-gray-300">
                      <b>{selectedOrder.name}</b>
                      <br />
                      {selectedOrder?.shipping_address?.first_name} {selectedOrder?.shipping_address?.last_name}
                      <br />
                      {/* Show phone or "N/A" */}
                      <a
                        href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-block text-blue-500 underline"
                      >
                        {getPhoneNumber(selectedOrder) || "N/A"}
                      </a>
                      <a
                        href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="md:hidden text-blue-500 underline"
                      >
                        {getPhoneNumber(selectedOrder) || "N/A"}
                      </a>
                      <br />

                      {/* 1) Quick Hello Button */}
                      <a
                        href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)), 
                          `Hello ${selectedOrder?.shipping_address?.first_name}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block mr-2 mt-2"
                      >
                        <span className="material-symbols-outlined">waving_hand</span>
                      </a>

                      {/* 2) Thank You / Intro Message Button */}
                      <a
                        href={getWhatsAppUrl(formatPhoneForWhatsApp(getPhoneNumber(selectedOrder)), 
                          `Hello ${selectedOrder?.shipping_address?.first_name}!\nThank you for choosing the Ossotna Story Book.\n\nYour order story is being prepared. Once done, we will share a preview link for your review.`
                        )}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendPreviewLink(selectedOrder);
                            }}
                            className="hidden md:inline-block text-white-500 hover:text-white-600 transition p-1 pt-2 pr-2 pl-2 bg-gray-700 hover:bg-gray-900 inline-block"
                          >
                            <span className="material-symbols-outlined">Draft</span>
                          </button>
                        )}
                    </div>

                    {selectedOrder && selectedOrder.line_items[0].properties.filter(
                      (prop) =>
                        ["_original_view_2",].includes(prop.name)
                    ).map((prop, index) => !!prop.value ? (
                      <Image
                        key={`original-view-${index}`}
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
                  className="w-full p-3 mt-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
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
                  setIsScannerPaused(false); // Reset for next time
                  // Open NFC modal with the current subdomain
                  const currentSubdomain = subdomainValue(selectedOrder);
                  const fullUrl = `https://${currentSubdomain}.ossotna.com`;
                  setNfcUrl(fullUrl);
                  console.log("Setting NFC URL to:", fullUrl);
                  setIsNfcWriteModalOpen(true);
                }}
                className="w-1/2 p-4 bg-blue-700 hover:bg-blue-800 text-white font-medium text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
                className="w-1/2 p-4 bg-gray-900 hover:bg-gray-800 text-white font-medium text-lg rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                title="Close Scanner"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Fulfill Order Confirmation Modal */}
      {showFulfillConfirmation && orderToFulfill && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Confirm Order Fulfillment</h3>
            
            <div className="mb-6 text-gray-700 dark:text-gray-300">
              <p className="mb-4">Are you sure you want to mark this order as fulfilled and paid?</p>
              
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
                className="w-1/2 py-3 bg-gray-300 hover:bg-gray-400 text-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors font-medium"
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
      
      {/* NFC Writing Modal for Android */}
      {isNfcWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center ">
          <div className="flex flex-col items-center w-11/12 max-w-md">
            <div className="relative bg-white dark:bg-gray-800 p-6 rounded-md w-full border-gray-400 border">
              <h3 className="text-lg font-medium text-center mb-4 text-gray-900 dark:text-white">Write URL to NFC Tag</h3>
              
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                On Android, you can write this URL to an NFC tag. Place your phone near an NFC tag when ready.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL to write:</label>
                <input 
                  type="text" 
                  value={nfcUrl}
                  onChange={(e) => setNfcUrl(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isNfcWriting}
                />
              </div>
              
              <div className="flex flex-col items-center justify-center mb-4">
                <div className={`w-24 h-24 mb-4 flex items-center justify-center rounded-full transition-all duration-500 ${isNfcWriting ? 'bg-blue-500 dark:bg-blue-600 shadow-lg shadow-blue-500/50 animate-pulse' : isNfcVerifying ? 'bg-green-500 dark:bg-green-600 shadow-lg shadow-green-500/50 animate-pulse' : 'bg-blue-100 dark:bg-blue-900'}`}>
                  <span className={`material-symbols-outlined text-4xl transition-all duration-500 ${isNfcWriting || isNfcVerifying ? 'text-white animate-bounce' : 'text-blue-600 dark:text-blue-300'}`}>{isNfcVerifying ? 'check_circle' : 'nfc'}</span>
                </div>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {isNfcWriting ? 'Bring your phone close to an NFC tag to write...' : 
                   isNfcVerifying ? 'Tap the tag again to verify the written URL...' : 
                   nfcWriteAttempts > 0 ? `Previous attempt failed. Try again (Attempt ${nfcWriteAttempts + 1}/3)` :
                   'Tap the button below to start NFC writing mode.'}
                </p>
                {nfcWriteAttempts > 0 && !isNfcWriting && !isNfcVerifying && (
                  <p className="text-center text-xs text-red-500 mt-2">
                    Previous write verification failed. The URL may not have been written correctly.
                  </p>
                )}
              </div>
              
              {/* Display the last read URL if available */}
              {lastReadUrl && (
                <div className="mb-4 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last read URL:</p>
                  <p className="text-sm font-mono break-all text-gray-900 dark:text-gray-100">{lastReadUrl}</p>
                  {nfcUrl !== lastReadUrl && (
                    <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                      <span className="font-medium">Warning:</span> This URL is different from what was intended to be written ({nfcUrl}).
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                {/* Show Done button if verification is complete */}
                {showDoneButton && !isNfcWriting && !isNfcVerifying && (
                  <button
                    onClick={() => {
                      // Update order status and close modal
                      if (selectedOrder && selectedOrder.id) {
                        saveStatusAPI(selectedOrder.id, "QA Review")
                          .then(() => {
                            // Update local state
                            setStoryStatuses(prev => ({
                              ...prev,
                              [selectedOrder.id]: "QA Review"
                            }));
                            console.log("Order status updated to QA Review");
                          })
                          .catch(err => {
                            console.error("Failed to update order status:", err);
                          });
                      }
                      // Reset all states
                      setNfcWriteAttempts(0);
                      setLastReadUrl("");
                      setShowDoneButton(false);
                      setVerificationCompleted(false);
                      setIsNfcWriteModalOpen(false);
                      toast.success("NFC writing process completed.");
                    }}
                    className="w-full p-3 text-white rounded-md font-medium transition-all duration-300 bg-green-600 hover:bg-green-700"
                  >
                    Done
                  </button>
                )}
                
                <button
                  onClick={() => {
                    // Reset verification state if retrying
                    if (nfcWriteAttempts > 0) {
                      console.log(`Retrying NFC write. Attempt ${nfcWriteAttempts + 1}/3`);
                    }
                    
                    // On Android, this will try to use the Web NFC API
                    if ('NDEFReader' in window) {
                      try {
                        setIsNfcWriting(true);
                        setIsNfcVerifying(false);
                        setVerificationCompleted(false);
                        const ndef = new (window as any).NDEFReader();
                        
                        console.log("Starting NFC writing with URL:", nfcUrl);
                        
                        // Validate URL format before writing
                        let urlToWrite = nfcUrl;
                        if (!urlToWrite.startsWith('https://') && !urlToWrite.startsWith('http://')) {
                          urlToWrite = 'https://' + urlToWrite;
                          console.log("URL format corrected to:", urlToWrite);
                        }
                        
                        // Set up a scan listener to detect when a tag is in range
                        ndef.addEventListener('reading', ({ message, serialNumber }) => {
                          console.log(`> Serial Number: ${serialNumber}`);
                          console.log(`> Records: (${message.records.length})`);
                          console.log(`> Writing URL: ${urlToWrite}`);
                          
                          // Write only the URL to the tag
                          ndef.write({
                            records: [{ recordType: "url", data: urlToWrite }]
                          }).then(() => {
                            toast.success("URL written to NFC tag! Verifying...");
                            
                            // After writing, switch to verification mode
                            setIsNfcWriting(false);
                            setIsNfcVerifying(true);
                            
                            // Try to read the tag to verify the content
                            console.log("Starting NFC verification...");
                            
                            // Read the tag to verify
                            ndef.scan().then(() => {
                              console.log("Verification scan started. Please tap the tag again.");
                              
                              // Set a timeout for verification
                              setTimeout(() => {
                                if (isNfcVerifying && !verificationCompleted) {
                                  setIsNfcVerifying(false);
                                  setVerificationCompleted(true);
                                  toast.error("Verification timed out. You can try writing again or proceed.");
                                  
                                  // Keep modal open to allow retry
                                  // Don't update order status automatically, wait for user to confirm
                                }
                              }, 30000);
                              
                            }).catch(error => {
                              console.error("Error starting verification scan:", error);
                              setIsNfcVerifying(false);
                              setVerificationCompleted(true);
                              setShowDoneButton(true); // Show done button even if verification fails
                              toast.error("Could not verify the tag. You can try writing again or proceed.");
                              
                              // Don't close the modal, allow user to retry or proceed
                              // Don't update order status automatically, wait for user to confirm
                            });
                            
                            // Add a new reading event listener specifically for verification
                            ndef.addEventListener('reading', ({ message, serialNumber }) => {
                              // Only process if we're verifying and haven't completed verification yet
                              if (isNfcVerifying && !verificationCompleted) {
                                console.log(`Verification - Serial Number: ${serialNumber}`);
                                console.log(`Verification - Records: (${message.records.length})`);
                                
                                let verificationPassed = false;
                                
                                // Check if any of the records match our URL
                                for (const record of message.records) {
                                  if (record.recordType === "url") {
                                    const decoder = new TextDecoder();
                                    const url = decoder.decode(record.data);
                                    console.log(`Verification - Read URL: ${url}`);
                                    
                                    // Store the last read URL for display
                                    setLastReadUrl(url);
                                    setShowDoneButton(true);
                                    
                                    // Compare with the URL we tried to write
                                    if (url === urlToWrite) {
                                      console.log("Verification successful - URLs match!");
                                      verificationPassed = true;
                                      break;
                                    } else {
                                      console.log(`Verification failed - URLs don't match. Expected: ${urlToWrite}, Got: ${url}`);
                                    }
                                  }
                                }
                                
                                setIsNfcVerifying(false);
                                // Mark verification as completed to prevent multiple processing
                                setVerificationCompleted(true);
                                
                                if (verificationPassed) {
                                  toast.success("Verification successful! Correct URL written to tag.");
                                  // Keep modal open to show the Done button
                                  // Don't update order status yet, wait for user to click Done
                                } else {
                                  // Increment attempt counter but keep modal open
                                  setNfcWriteAttempts(prev => prev + 1);
                                  toast.error(`Verification failed. The written URL may be different from what was intended.`);
                                  
                                  // Keep modal open to allow retry or manual confirmation
                                  // The user can now see what was written and decide to retry or proceed
                                }
                              }
                            });
                            
                            // Helper function to update order status
                            function updateOrderStatus() {
                              if (selectedOrder && selectedOrder.id) {
                                saveStatusAPI(selectedOrder.id, "QA Review")
                                  .then(() => {
                                    // Update local state
                                    setStoryStatuses(prev => ({
                                      ...prev,
                                      [selectedOrder.id]: "QA Review"
                                    }));
                                    console.log("Order status updated to QA Review");
                                  })
                                  .catch(err => {
                                    console.error("Failed to update order status:", err);
                                  });
                              }
                            }
                          }).catch((error) => {
                            setIsNfcWriting(false);
                            console.error(error);
                            toast.error("Failed to write to NFC tag: " + error.message);
                          });
                        });
                        
                        // Start scanning for NFC tags
                        ndef.scan().catch((error) => {
                          setIsNfcWriting(false);
                          console.error(error);
                          toast.error("Error scanning for NFC tag: " + error.message);
                        });
                        
                        // Add a timeout to cancel if no tag is found after 30 seconds
                        setTimeout(() => {
                          if (isNfcWriting) {
                            setIsNfcWriting(false);
                            toast.error("NFC operation timed out. Please try again.");
                          }
                        }, 30000);
                        
                      } catch (error: any) {
                        setIsNfcWriting(false);
                        console.error(error);
                        toast.error("Error accessing NFC: " + error.message);
                      }
                    } else {
                      toast.error("NFC is not supported on this device or browser");
                    }
                  }}
                  disabled={isNfcWriting || isNfcVerifying}
                  className={`border-gray-400 border w-full p-3 text-white rounded-md font-medium transition-all duration-300 ${isNfcWriting || isNfcVerifying ? 'bg-blue-400 cursor-not-allowed' : nfcWriteAttempts > 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isNfcWriting ? 'Writing to NFC Tag...' : 
                   isNfcVerifying ? 'Verifying NFC Tag...' : 
                   nfcWriteAttempts > 0 ? `Retry NFC Writing (Attempt ${nfcWriteAttempts + 1}/3)` : 
                   'Start NFC Writing'}
                </button>
                
                <button
                  onClick={() => {
                    if (!isNfcWriting && !isNfcVerifying) {
                      // Reset all states when closing
                      setNfcWriteAttempts(0);
                      setLastReadUrl("");
                      setShowDoneButton(false);
                      setVerificationCompleted(false);
                      setIsNfcWriteModalOpen(false);
                    }
                  }}
                  disabled={isNfcWriting || isNfcVerifying}
                  className={`border-gray-400 border w-full p-3 rounded-md font-medium transition-all duration-300 ${isNfcWriting || isNfcVerifying ? 'bg-gray-400 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'}`}
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