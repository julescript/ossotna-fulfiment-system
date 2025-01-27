import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { subdomain } = req.body;

  if (!subdomain) {
    return res.status(400).json({ error: "Subdomain is required" });
  }

  const urlToEncode = `https://${subdomain}.ossotna.com`;
  const logoPath =
    "https://res.cloudinary.com/dyvaavnkb/image/upload/v1706862931/Rectangle_3_lkrv2d.png"; // Replace with your actual logo path

  try {
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
          logo: logoPath, // Your logo here
          logoMode: "clean",
        },
        size: 75,
        download: false,
        file: "svg",
      },
      responseType: "arraybuffer", // Important to handle the SVG file as binary
    });

    // Return the SVG file content to the client
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(response.data);
  } catch (error) {
    console.error("Error generating QR code:", error.message);
    res
      .status(500)
      .json({ error: "Failed to generate QR code. Please try again later." });
  }
}