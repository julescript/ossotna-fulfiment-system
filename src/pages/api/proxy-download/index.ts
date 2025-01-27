import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl } = req.query;

  if (!imageUrl) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    // Fetch the image from the remote server
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

    const contentType = response.headers["content-type"];

    // Set the response headers to return the image as a download
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${imageUrl.split("/").pop()}"`
    );

    // Send the image data as the response
    res.status(200).send(response.data);
  } catch (error) {
    console.error("Error fetching image:", error.message);
    res.status(500).json({ error: "Failed to fetch image" });
  }
}