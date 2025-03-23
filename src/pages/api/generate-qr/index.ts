// pages/api/generate-qr/index.ts

import axios from "axios";
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
  const logoPath = "https://res.cloudinary.com/ossotna/image/upload/v1742533310/sample/nfc-icon-new_i1h1ih.svg";

  try {
    // Generate QR Code via External API
    const response = await axios({
      method: 'POST',
      url: 'https://api.qrcode-monkey.com/qr/custom',
      data: {
        data: urlToEncode,
        config: {
          body: "square",
          eye: "frame0",
          eyeBall: "ball0",
          erf1: ["fh"],
          erf2: ["fv"],
          erf3: ["fh"],
          brf1: ["fh"],
          brf2: ["fv"],
          brf3: ["fh"],
          bodyColor: "#000000",
          bgColor: "#FFFFFF",
          eye1Color: "#000000",
          eye2Color: "#000000",
          eye3Color: "#000000",
          eyeBall1Color: "#000000",
          eyeBall2Color: "#000000",
          eyeBall3Color: "#000000",
          gradientColor1: "",
          gradientColor2: "",
          gradientType: "linear",
          gradientOnEyes: "true",
          logo: logoPath,
          logoMode: "clean"
        },
        size: 1000,
        download: false,
        file: "svg"
      }
    });

    // Set Content-Type and send the SVG
    res.setHeader("Content-Type", "image/svg+xml");
    return res.status(200).send(response.data);

  } catch (error) {
    console.error('Error generating QR code:', error);
    return res.status(500).json({ error: "Failed to generate QR code" });
  }
}