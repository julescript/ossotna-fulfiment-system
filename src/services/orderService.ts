// services/orderService.js

/**
 * Fetch orders from Shopify (via your Next.js API route).
 */
export const fetchOrdersAPI = async (limit) => {
    const res = await fetch(`api/shopify/orders?limit=${limit}`);
    if (!res.ok) {
        throw new Error("Failed to fetch orders");
    }
    return res.json();
};

/**
 * Save a subdomain metafield for a given order.
 */
export const saveSubdomainAPI = async (orderId, subdomain) => {
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
    return response;
};

/**
 * Save a subdomain metafield for a given order.
 */
export const saveStatusAPI = async (orderId, status) => {
    const response = await fetch("/api/save-metafield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderId,
            metafield: {
                namespace: "custom",
                key: "story-status",
                type: "single_line_text_field",
                value: status,
            },
        }),
    });
    if (!response.ok) {
        throw new Error("Failed to save subdomain");
    }
    return response;
};

/**
 * Generate a QR Code for a subdomain.
 */
export const generateQRCodeAPI = async (subdomain) => {
    const response = await fetch("/api/generate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain }),
    });
    if (!response.ok) {
        throw new Error("Failed to generate QR code");
    }
    return response.text(); // returns the SVG data
};

/**
 * Save image URLs to a metafield
 */
export const saveMetafieldAPI = async (orderId, key, type, value) => {
    const response = await fetch("/api/save-metafield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderId,
            metafield: {
                namespace: "custom",
                key,
                type,
                value,
            },
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to save ${key} metafield`);
    }
    return response;
};

// services/orderService.js

/**
 * Process images (e.g. resize) on your server, then upload them to Cloudinary.
 *
 * @param {Object} params
 * @param {string} params.folderName   - A name for grouping images (e.g. order.name)
 * @param {string[]} params.imageUrls  - Array of source image URLs
 * @param {string} [params.orderId]    - If needed for subsequent API calls (e.g., saving metafields)
 *
 * @returns {Promise<Object[]>}        - Resolves to an array of uploaded image info: [{ name, url }, ...]
 * @throws  {Error}                    - Throws if any step fails
 */
export const processAndUploadImagesAPI = async ({ orderId, folderName, imageUrls }) => {
    if (!folderName) {
        throw new Error("Missing folderName parameter");
    }
    if (!imageUrls || imageUrls.length === 0) {
        throw new Error("No images provided for processing");
    }

    // Step 1: Call your /api/process-images-upload endpoint to resize (or otherwise process) images
    const processResponse = await fetch("/api/process-images-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName, imageUrls }),
    });
    if (!processResponse.ok) {
        throw new Error("Failed to process images on the server.");
    }

    const { resizedImages } = await processResponse.json();
    // resizedImages is expected to be an array of objects: [{ filename, resizedBuffer }, ...]

    // Step 2: Upload each processed image to Cloudinary
    const processedImages = [];
    for (const { filename, resizedBuffer } of resizedImages) {
        // Convert the base64-encoded buffer into a Blob
        const blob = new Blob(
            [Uint8Array.from(atob(resizedBuffer), (c) => c.charCodeAt(0))],
            { type: "image/jpeg" }
        );

        // Request signature for authenticated upload
        const signatureRes = await fetch("/api/cloudinary-sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: folderName }),
        });
        if (!signatureRes.ok) {
            throw new Error("Failed to get Cloudinary signature.");
        }

        const { timestamp, signature, api_key } = await signatureRes.json();

        // FormData for Cloudinary’s POST upload endpoint
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("timestamp", timestamp);
        formData.append("signature", signature);
        formData.append("api_key", api_key);
        formData.append("folder", folderName);

        const uploadResponse = await fetch("https://api.cloudinary.com/v1_1/ossotna/upload", {
            method: "POST",
            body: formData,
        });
        if (!uploadResponse.ok) {
            throw new Error("Failed to upload image to Cloudinary.");
        }

        const uploadData = await uploadResponse.json();
        processedImages.push({
            name: filename,
            url: uploadData.secure_url,
        });
    }

    // Optional Step 3: If you want, you can save the URLs to a metafield here:
    // (Requires `orderId` and your existing save-metafield endpoint)
    //
    // if (orderId) {
    //   const photoUrls = processedImages.map(img => img.url);
    //   const saveResponse = await fetch("/api/save-metafield", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       orderId,
    //       metafield: {
    //         namespace: "custom",
    //         key: "story-photos",
    //         type: "json",
    //         value: JSON.stringify(photoUrls),
    //       },
    //     }),
    //   });
    //   if (!saveResponse.ok) {
    //     throw new Error("Failed to save image URLs to metafield.");
    //   }
    // }

    // Return the final array of processed & uploaded images
    return processedImages;
};

/**
 * Download images as a ZIP file after server-side processing (if any).
 * 
 * @param {string} folderName  - Typically the order’s name or similar
 * @param {string[]} imageUrls - Array of raw image URLs
 *
 * @returns {Promise<Blob>} - Resolves to a Blob (the ZIP file contents). 
 *                           The calling code can create an <a> element & download it.
 * @throws  {Error}         - Throws if the ZIP generation or fetch fails
 */
export const downloadImagesAsZipAPI = async (folderName, imageUrls) => {
    if (!folderName) {
        throw new Error("Missing folderName parameter.");
    }
    if (!imageUrls || imageUrls.length === 0) {
        throw new Error("No valid images provided for downloading.");
    }

    // Call your /api/process-images endpoint 
    // which presumably zips & returns a .zip blob
    const response = await fetch("/api/process-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderName: folderName, imageUrls }),
    });

    if (!response.ok) {
        throw new Error("Failed to process images for ZIP download.");
    }

    // Return the binary .zip blob to the caller
    return response.blob();
};