import axios from "axios";
import sharp from "sharp";
import { cpus } from "os";
import { fileTypeFromBuffer } from "file-type";
import heicConvert from "heic-convert"; // Faster HEIC conversion
import { NextApiRequest, NextApiResponse } from 'next';

interface ProcessImagesUploadRequest {
  folderName: string;
  imageUrls: string[];
}

interface ResizedImage {
  filename: string;
  resizedBuffer: Buffer;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { folderName, imageUrls } = req.body as ProcessImagesUploadRequest;

  if (!folderName || !imageUrls || imageUrls.length === 0) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  const resizedImages: ResizedImage[] = [];

  try {
    // Use traditional for loop to avoid TypeScript iterator issues
    for (let index = 0; index < imageUrls.length; index++) {
      const url = imageUrls[index];
      console.log(`Downloading image ${index + 1}: ${url}`);

      // Fetch the image
      const response = await axios.get(url, { responseType: "arraybuffer" });
      let imageBuffer = Buffer.from(response.data);

      // 🔍 Detect the real image format
      const fileType = await fileTypeFromBuffer(imageBuffer);
      console.log(`Detected format: ${fileType?.mime}`);

      // 🛑 Skip non-image files
      if (!fileType || !fileType.mime.startsWith("image/")) {
        console.warn(`Skipping unsupported file: ${url}`);
        continue;
      }

      // 🎯 Convert HEIC/HEIF to JPEG (Faster with heic-convert)
      if (fileType.ext === "heic" || fileType.ext === "heif") {
        console.log(`Converting HEIC to JPEG: ${url}`);
        imageBuffer = await heicConvert({
          buffer: imageBuffer,
          format: "JPEG",
          quality: 1,
        });
      }

      // 📏 Resize and convert to JPEG
      const resizedBuffer = await sharp(imageBuffer)
        .resize({ width: 800 })
        .jpeg()
        .toBuffer();

      // 🏷️ Generate the image name
      const imageName = `${folderName}_${String(index + 1).padStart(2, "0")}.jpg`;

      resizedImages.push({ filename: imageName, resizedBuffer });
    }

    res.status(200).json({
      resizedImages: resizedImages.map((image) => ({
        filename: image.filename,
        resizedBuffer: image.resizedBuffer.toString("base64"),
      })),
    });
  } catch (error: any) {
    console.error("Error processing images:", error.message);
    res.status(500).json({ error: "Failed to process images.", details: error.message });
  }
}