/**
 * WhatsApp utility functions for formatting phone numbers and generating WhatsApp URLs
 * that work correctly across different devices.
 */

/**
 * Formats a phone number to the appropriate international format
 * Handles various input formats and prevents duplicate country codes
 * @param phone - The phone number to format
 * @returns Formatted phone number with + prefix
 */
export const formatLebanesePhoneNumber = (phone: string | undefined | null): string => {
  if (!phone) return '';
  
  // First, clean the phone number by removing all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Store original input for comparison
  const originalInput = cleaned;
  
  // If it already has a + sign, remove it temporarily for consistent processing
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Check for common international country codes
  // Kuwait: 965, UAE: 971, Saudi: 966, Qatar: 974, Bahrain: 973, Oman: 968
  const commonCountryCodes = ['965', '971', '966', '974', '973', '968'];
  
  // Check if the number already has a recognized international code
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code)) {
      // It's an international number with a recognized country code
      return `+${cleaned}`;
    }
  }
  
  // Lebanese number handling
  // Check for multiple instances of country code (961961...)
  while (cleaned.indexOf('961961') === 0) {
    cleaned = cleaned.substring(3); // Remove one instance of 961
  }
  
  // Now apply the formatting rules for Lebanese numbers
  if (cleaned.startsWith('0')) {
    // If it starts with 0, replace with Lebanese country code
    return `+961${cleaned.slice(1)}`;
  } else if (cleaned.startsWith('961')) {
    // If it already has the Lebanese country code, just add the + sign
    return `+${cleaned}`;
  } else if (cleaned.length >= 8 && !originalInput.startsWith('+')) {
    // If it's a valid number without country code and the original input didn't have a + sign
    // Assume it's a Lebanese number
    return `+961${cleaned}`;
  } else {
    // For any other case, just add the + sign
    return `+${cleaned}`;
  }
};

/**
 * Formats a phone number for WhatsApp by removing the + sign
 * and ensuring no duplicate country codes
 * @param phone - The phone number to format
 * @returns Formatted phone number without + prefix
 */
export const formatPhoneForWhatsApp = (phone: string | undefined | null): string => {
  if (!phone) return '';
  
  // Preserve the original input
  const originalInput = phone;
  
  // First, do a pre-cleaning to handle any obvious duplicate country codes
  let preClean = phone.replace(/[^\d+]/g, '');
  
  // If the original input starts with +, preserve the international format
  if (originalInput.startsWith('+')) {
    // Just remove the + sign
    return preClean.substring(1);
  }
  
  // Common international country codes
  const commonCountryCodes = ['965', '971', '966', '974', '973', '968'];
  
  // Remove + sign if present
  if (preClean.startsWith('+')) {
    preClean = preClean.substring(1);
  }
  
  // Check if the number already has a recognized international code
  for (const code of commonCountryCodes) {
    if (preClean.startsWith(code)) {
      // It's an international number, return as is without the + sign
      return preClean;
    }
  }
  
  // Lebanese number handling
  // Check for multiple instances of country code before formatting
  while (preClean.indexOf('961961') === 0) {
    preClean = preClean.substring(3); // Remove one instance of 961
  }
  
  // Now format with the cleaned number
  const formattedPhone = formatLebanesePhoneNumber(preClean);
  
  // Remove the + sign for WhatsApp URL format
  let noPlus = formattedPhone.replace(/\+/g, '');
  
  // Final safety check to prevent duplicate country codes
  while (noPlus.indexOf('961961') === 0) {
    noPlus = noPlus.substring(3); // Remove one instance of 961
  }
  
  return noPlus;
};

/**
 * Generates a WhatsApp URL based on the device type
 * Mobile devices use wa.me format which opens the app
 * Desktop uses web.whatsapp.com which opens in browser
 * @param phoneNumber - The formatted phone number (without +)
 * @param message - Optional message text to pre-fill
 * @returns The appropriate WhatsApp URL
 */
export const getWhatsAppUrl = (phoneNumber: string, message: string = ''): string => {
  // Check if we're on a mobile device
  const isMobile = typeof navigator !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // For mobile, use wa.me which will open the app
  if (isMobile) {
    return `https://wa.me/${phoneNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  }

  // For desktop, use web.whatsapp.com which will open in browser
  return `https://web.whatsapp.com/send?phone=${phoneNumber}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
};
