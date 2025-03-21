// pages/api/generate-qr/index.ts

import axios from "axios";
import fs from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Method Check
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 2. Extract and Validate Subdomain
  const { subdomain } = req.body as { subdomain?: string };

  if (!subdomain) {
    return res.status(400).json({ error: "Subdomain is required" });
  }

  // Prevent directory traversal and ensure valid subdomain format
  const subdomainRegex = /^[a-zA-Z0-9-]+$/;
  if (!subdomainRegex.test(subdomain)) {
    return res.status(400).json({ error: "Invalid subdomain format." });
  }

  const urlToEncode = `https://${subdomain}.ossotna.com`;
  const logoPath = "https://res.cloudinary.com/ossotna/image/upload/v1742533310/sample/nfc-icon-new_i1h1ih.svg"; // External logo URL

  // 3. Define Cache Directory and File Path
  const cacheDir = path.join(process.cwd(), "cache", "qr-codes");
  const cacheFilePath = path.join(cacheDir, `${subdomain}.svg`);

  try {
    // 4. Ensure Cache Directory Exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 5. Check if QR Code Exists in Cache
    if (fs.existsSync(cacheFilePath)) {
      // Read the cached SVG file
      const cachedSvg = fs.readFileSync(cacheFilePath, "utf8");

      // Set Content-Type and send the cached SVG
      res.setHeader("Content-Type", "image/svg+xml");
      return res.status(200).send(cachedSvg);
    }

    // 6. If Not Cached, Generate QR Code via External API
    const response = await axios({
      method: "post",
      url: "https://api.qrcode-monkey.com/qr/custom",
      data: {
        data: urlToEncode,
        config: {
          body: "square",
          eye: "frame0",
          eyeBall: "ball0",
          er: "md",
          logo: logoPath, // Logo URL
          logoMode: "clean",
        },
        download: false,
        file: "svg",
      },
      responseType: "text", // Receive SVG as text
    });

    const svgData = response.data;

    // 7. Save the Generated QR Code to Cache
    fs.writeFileSync(cacheFilePath, svgData, "utf8");

    // 8. Return the Newly Generated SVG to Client
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(svgData);
  } catch (error: any) {
    console.error("Error generating QR code:", error.message);
    res
      .status(500)
      .json({ error: "Failed to generate QR code. Please try again later." });
  }
}