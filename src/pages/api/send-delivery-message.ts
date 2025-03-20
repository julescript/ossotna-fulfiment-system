import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber, orderName } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Format the phone number to ensure it has the country code
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      // If it starts with 0, replace with Egypt country code
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+2' + formattedPhone;
      } else {
        formattedPhone = '+2' + formattedPhone;
      }
    }

    // Create the message text
    const messageText = `Hello, we're delivering your Ossotna order ${orderName || ''}. Please share your location and have the exact amount prepared as we cannot guarantee change. Thank you!`;
    
    // Encode the message for WhatsApp
    const encodedMessage = encodeURIComponent(messageText);
    
    // Generate WhatsApp deep link
    const whatsappLink = `https://wa.me/${formattedPhone.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;

    return res.status(200).json({ 
      success: true, 
      whatsappLink,
      message: 'WhatsApp link generated successfully'
    });
  } catch (error) {
    console.error('Error generating WhatsApp link:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
