import axios from "axios";
import sharp from "sharp";
import JSZip from "jszip"; // For creating zip files
import { v4 as uuidv4 } from "uuid"; // For unique IDs

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderName, imageUrls } = req.body;

  if (!orderName || !imageUrls || imageUrls.length === 0) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    const zip = new JSZip();
    const folder = zip.folder(orderName); // Create a folder inside the zip file

    for (const [index, url] of imageUrls.entries()) {
      // Step 1: Download the image
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const buffer = Buffer.from(response.data);

      // Step 2: Resize and convert to JPEG
      const resizedImage = await sharp(buffer)
        .resize({ width: 600 })
        .jpeg()
        .toBuffer();

      // Step 3: Generate unique name
      const imageName = `${orderName}_${String(index + 1).padStart(2, "0")}.jpg`;

      // Step 4: Add the processed image to the zip folder
      folder.file(imageName, resizedImage);
    }

    // Step 5: Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Step 6: Send the zip file as the response
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${orderName}.zip`);
    res.status(200).send(zipBuffer);
  } catch (error) {
    console.error("Error processing images:", error);
    res.status(500).json({ error: "Failed to process images" });
  }
}