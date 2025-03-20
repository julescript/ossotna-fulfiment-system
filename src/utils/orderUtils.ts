// utils/orderUtils.js

/**
 * Extracts the default subdomain from the order's metafields (if any).
 */
export const getDefaultSubdomain = (order) => {
  const storyUrlMetafield = order.metafields?.find(
    (mf) => mf.namespace === "custom" && mf.key === "story-url"
  );
  return storyUrlMetafield ? storyUrlMetafield.value : "";
};

/**
 * Generates an order-based URL from line item properties.
 * If the user specified a custom URL, return that; 
 * otherwise use the milestone date, or fallback to empty string.
 */
export const getOrderURL = (order) => {
  const properties = order.line_items[0].properties;
  const customURL = properties.find((p) => p.name === "custom URL");
  if (customURL) return customURL.value;

  const milestoneDate = properties.find((p) => p.name === "milestone date");
  if (milestoneDate) return milestoneDate.value.replace(/\//g, "");

  return "";
};

// utils/orderUtils.js
export const convertToGid = (type, id) => `gid://shopify/${type}/${id}`;
// utils/orderUtils.js

import DOMPurify from "dompurify";

/**
 * Processes the fetched QR code SVG string.
 * - Removes fixed width and height attributes.
 * - Ensures a viewBox is present.
 * - Sets any white fills to transparent.
 * - Changes any black fills to #fafafa.
 * - Removes all <image> elements.
 * - Replaces <image> elements with a provided SVG snippet.
 * - Handles colors defined in both 'fill' and 'style' attributes.
 * - Removes spaces within fill attribute values before processing.
 * @param {string} svgString - The raw SVG string fetched from the API.
 * @returns {string} - The processed SVG string.
 */
export const processQrCodeSvg = (svgString) => {
    // Create a new DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) {
        console.error("Invalid SVG data.");
        return "";
    }

    // Remove width and height attributes to make it scalable
    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");

    // Ensure viewBox is present
    if (!svgElement.getAttribute("viewBox")) {
        const width = svgElement.getAttribute("width") || "100";
        const height = svgElement.getAttribute("height") || "100";
        svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    /**
     * Processes the 'fill' attribute of an element.
     * - Sets white fills to 'transparent'.
     * - Sets black fills to '#fafafa'.
     * @param {Element} elem - The SVG element to process.
     */
    const processFillAttribute = (elem) => {
        let fillValue = elem.getAttribute("fill");

        if (!fillValue) return; // Skip if 'fill' is not set

        // Remove all spaces and convert to lowercase for accurate comparison
        fillValue = fillValue.replace(/\s+/g, "").toLowerCase();

        // Check if the fill is white in various representations
        const isWhiteFill =
            fillValue === "white" ||
            fillValue === "#fff" ||
            fillValue === "#ffffff" ||
            fillValue === "rgb(255,255,255)";

        // Check if the fill is black in various representations
        const isBlackFill =
            fillValue === "black" ||
            fillValue === "#000" ||
            fillValue === "#000000" ||
            fillValue === "rgb(0,0,0)";

        if (isWhiteFill) {
            // Set fill to 'transparent' for white fills
            elem.setAttribute("fill", "transparent");
        } else if (isBlackFill) {
            // Set fill to '#fafafa' for black fills
            elem.setAttribute("fill", "#fafafa");
        }
    };

    /**
     * Processes the 'style' attribute of an element.
     * - Extracts the 'fill' property.
     * - Sets white fills to 'transparent'.
     * - Sets black fills to '#fafafa'.
     * @param {Element} elem - The SVG element to process.
     */
    const processStyleAttribute = (elem) => {
        let styleValue = elem.getAttribute("style");

        if (!styleValue) return; // Skip if 'style' is not set

        // Split the style string into individual properties
        const styleProperties = styleValue.split(";").map((s) => s.trim()).filter(Boolean);
        const styleObj: { [key: string]: string } = {};

        // Populate the style object
        styleProperties.forEach((s) => {
            const [key, value] = s.split(":").map((part) => part.trim());
            if (key && value) {
                styleObj[key] = value;
            }
        });

        if (styleObj.fill) {
            let fillValue = styleObj.fill;

            // Remove all spaces and convert to lowercase for accurate comparison
            fillValue = fillValue.replace(/\s+/g, "").toLowerCase();

            // Check if the fill is white in various representations
            const isWhiteFill =
                fillValue === "white" ||
                fillValue === "#fff" ||
                fillValue === "#ffffff" ||
                fillValue === "rgb(255,255,255)";

            // Check if the fill is black in various representations
            const isBlackFill =
                fillValue === "black" ||
                fillValue === "#000" ||
                fillValue === "#000000" ||
                fillValue === "rgb(0,0,0)";

            if (isWhiteFill) {
                // Set fill to 'transparent' for white fills
                styleObj.fill = "transparent";
            } else if (isBlackFill) {
                // Set fill to '#fafafa' for black fills
                styleObj.fill = "#fafafa";
            }

            // Reconstruct the style string
            const newStyle = Object.entries(styleObj)
                .map(([key, value]) => `${key}: ${value}`)
                .join("; ");

            elem.setAttribute("style", newStyle);
        }
    };

    // Process all elements with 'fill' attribute
    const elementsWithFill = svgElement.querySelectorAll("[fill]");
    elementsWithFill.forEach((elem) => {
        processFillAttribute(elem);
    });

    // Process all elements with 'style' attribute containing 'fill'
    const elementsWithStyle = svgElement.querySelectorAll("[style]");
    elementsWithStyle.forEach((elem) => {
        // Only process elements where the style includes 'fill'
        if (/fill\s*:/.test(elem.getAttribute("style"))) {
            processStyleAttribute(elem);
        }
    });

    // Serialize the SVG back to string
    const serializer = new XMLSerializer();
    let processedSvg = serializer.serializeToString(svgElement);

    // Sanitize the SVG to prevent XSS attacks
    processedSvg = DOMPurify.sanitize(processedSvg, { USE_PROFILES: { svg: true } });

    return processedSvg;
};