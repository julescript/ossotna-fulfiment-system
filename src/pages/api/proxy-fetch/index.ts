export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl } = req.query;

  if (!imageUrl) {
    return res.status(400).json({ error: "Image URL is required" });
  }

  try {
    // Fetch the image from the external server
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch the image from the external server.");
    }

    // Get the image as a buffer
    const buffer = await response.arrayBuffer();

    // Set appropriate headers to return the image
    res.setHeader("Content-Type", response.headers.get("Content-Type"));
    res.setHeader("Content-Disposition", `inline; filename="image.png"`);

    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error fetching image:", error.message);
    res.status(500).json({ error: "Failed to fetch the image." });
  }
}