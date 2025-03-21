// pages/api/generate-pdf.js
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { JSDOM } from "jsdom";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { svgString, subdomain } = req.body;
    if (!svgString) {
      return res.status(400).json({ error: "No SVG string provided" });
    }

    // Log subdomain for debugging
    console.log("Subdomain:", subdomain);

    // Parse the SVG string using JSDOM.
    const dom = new JSDOM(svgString, { contentType: "image/svg+xml" });
    const svgElem = dom.window.document.querySelector("svg");
    if (!svgElem) {
      return res.status(400).json({ error: "Invalid SVG data" });
    }

    // Define desired PDF size (adjust as needed)
    const pdfWidth = 200; // in points
    const pdfHeight = 200; // in points

    // Compute scale from viewBox if available.
    let scale = 1;
    const viewBox = svgElem.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(" ").map(Number);
      const vbWidth = parts[2];
      const vbHeight = parts[3];
      scale = Math.min(pdfWidth / vbWidth, pdfHeight / vbHeight);
      console.log("Computed scale:", scale);
    } else {
      console.log("No viewBox found. Using default scale 1.");
    }

    // Create a new PDF document.
    const doc = new PDFDocument({ size: [pdfWidth, pdfHeight], margin: 0 });
    let buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      // Set filename using the subdomain.
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ossotna card ${subdomain}.pdf"`
      );
      res.status(200).send(pdfData);
    });

    // Render the SVG into the PDF using svg-to-pdfkit
    try {
      console.log("Converting SVG to PDF with SVGtoPDF");
      SVGtoPDF(doc, svgString, 0, 0, {
        width: pdfWidth,
        height: pdfHeight,
        preserveAspectRatio: "xMidYMid meet",
      });
      console.log("SVG successfully converted to PDF");
    } catch (svgError) {
      console.error("Error converting SVG to PDF:", svgError);
      
      // Try fallback method with simplified SVG
      try {
        // Create a simplified SVG with just a rectangle as fallback
        const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pdfWidth}" height="${pdfHeight}" viewBox="0 0 ${pdfWidth} ${pdfHeight}">
          <rect width="100%" height="100%" fill="white"/>
          <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle">${subdomain}.ossotna.com</text>
        </svg>`;
        
        SVGtoPDF(doc, fallbackSvg, 0, 0, {
          width: pdfWidth,
          height: pdfHeight,
        });
        console.log("Fallback SVG used for PDF generation");
      } catch (fallbackError) {
        console.error("Fallback SVG also failed:", fallbackError);
        // Just add text as a last resort
        doc.fontSize(14).text(`QR Code for ${subdomain}.ossotna.com`, 10, pdfHeight/2, {
          align: 'center'
        });
      }
    }
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}