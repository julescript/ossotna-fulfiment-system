import axios from "axios";
import sharp from "sharp";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { folderName, imageUrls } = req.body;

  if (!folderName || !imageUrls || imageUrls.length === 0) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    const resizedImages = [];

    for (const [index, url] of imageUrls.entries()) {
      // Fetch the image
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const originalBuffer = Buffer.from(response.data);

      // Process the image (resize to 600px width and convert to JPEG)
      const resizedBuffer = await sharp(originalBuffer)
        .resize({ width: 600 })
        .jpeg()
        .toBuffer();

      // Generate the image name
      const imageName = `${folderName}_${String(index + 1).padStart(2, "0")}.jpg`;

      resizedImages.push({ filename: imageName, resizedBuffer });
    }

    res.status(200).json({
      resizedImages: resizedImages.map((image) => ({
        filename: image.filename,
        resizedBuffer: image.resizedBuffer.toString("base64"), // Encode buffer as Base64
      })),
    });
  } catch (error) {
    console.error("Error processing images:", error.message);
    res.status(500).json({ error: "Failed to process images." });
  }
}