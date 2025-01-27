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