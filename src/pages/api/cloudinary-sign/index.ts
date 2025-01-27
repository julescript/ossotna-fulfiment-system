import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { folder } = req.body;

  if (!folder) {
    return res.status(400).json({ error: 'Folder name is required.' });
  }

  try {
    // Get the Cloudinary environment variables
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Ensure all necessary environment variables are set
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'Cloudinary environment variables are not properly configured.',
      });
    }

    // Generate a timestamp for the signature
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Create the signature string based on the folder and timestamp
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha256')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    // Respond with the signature, timestamp, and API key
    return res.status(200).json({
      timestamp,
      signature,
      api_key: apiKey,
      cloud_name: cloudName, // Optional, useful for debugging
    });
  } catch (error) {
    console.error('Error generating Cloudinary signature:', error.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
}