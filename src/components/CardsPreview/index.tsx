import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import opentype from "opentype.js";
import { toast } from "react-toastify";
import { Document, Page, pdfjs } from "react-pdf";
import { processQrCodeSvg } from "@/utils/orderUtils";
pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js";

// API call to generate QR code (returns SVG string)
export const generateQRCodeAPI = async (subdomain) => {
  const response = await fetch("/api/generate-qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subdomain }),
  });
  if (!response.ok) {
    throw new Error("Failed to generate QR code");
  }
  return response.text();
};

// API call to convert the QR SVG into a PDF (runs on the server)
export const generateQrCodePdf = async (svgString, subdomain) => {
  const response = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svgString, subdomain }),
  });
  if (!response.ok) {
    throw new Error("PDF generation failed");
  }
  const pdfBlob = await response.blob();
  return pdfBlob;
};

// Define the component props interface
interface OnePDFWithTwoFramesProps {
  milestoneDate?: string;
  title?: string;
  dedicationLine?: string;
  subdomain?: string;
  overlay1?: string;
  overlay2?: string;
  qr?: string;
  onSendCardPreview?: (imageData: string) => void;
  onSendToPrinter?: (pdfUrl: string) => void;
}

// Define the ref interface
export interface OnePDFWithTwoFramesRef {
  generatePDF: () => Promise<void>;
  convertPdfToImage: () => Promise<string | null>;
  getImageData: () => string | null;
  handleSend: () => Promise<void>;
  handlePrint: () => void;
}

const OnePDFWithTwoFrames = forwardRef<OnePDFWithTwoFramesRef, OnePDFWithTwoFramesProps>(({
  milestoneDate = "01/01/2025",
  title = "A Special Title That Might Span Multiple Lines",
  dedicationLine = "With all my love",
  subdomain = "example",
  overlay1 = "/overlay1.pdf",
  overlay2 = "/overlay2.pdf",
  onSendCardPreview,
  onSendToPrinter,
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [imageData, setImageData] = useState(null);

  // Helper: wrap text into lines that do not exceed maxWidth
  const wrapText = (text, font, fontSize, maxWidth) => {
    // First split by explicit line breaks
    const paragraphs = text.split('\n');
    let lines = [];
    
    // Then process each paragraph for word wrapping
    for (let paragraph of paragraphs) {
      const words = paragraph.split(" ");
      let currentLine = "";
      
      // If this is an empty paragraph (just a line break), add an empty line
      if (words.length === 1 && words[0] === "") {
        lines.push("");
        continue;
      }
      
      for (let word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testLineWidth = font.getAdvanceWidth(testLine, fontSize);
        if (testLineWidth > maxWidth && currentLine !== "") {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
    return lines;
  };

  // Helper: draw text as vector outlines using a given opentype font
  const drawTextAsVector = (page, font, text, x, y, fontSize, color) => {
    const textPath = font.getPath(text, 0, 0, fontSize);
    const pathData = textPath.toPathData();
    page.drawSvgPath(pathData, { x, y, color });
  };

  const generatePDF = async () => {
    setIsLoading(true);
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const mmToPt = (mm) => mm * 2.83465;
      const CARD_WIDTH = mmToPt(54);
      const CARD_HEIGHT = mmToPt(85.6);
      const pageWidth = CARD_WIDTH * 2;
      const pageHeight = CARD_HEIGHT;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Embed overlay PDFs.
      const overlay1PdfBytes = await fetch(overlay1).then((res) => res.arrayBuffer());
      const overlay2PdfBytes = await fetch(overlay2).then((res) => res.arrayBuffer());
      const [overlay1EmbeddedPage] = await pdfDoc.embedPdf(overlay1PdfBytes);
      const [overlay2EmbeddedPage] = await pdfDoc.embedPdf(overlay2PdfBytes);

      // Load fonts.
      const vollkornRegular = await opentype.load("/Vollkorn-Regular.ttf");
      const vollkornBold = await opentype.load("/Vollkorn-Bold.ttf");
      const vollkornItalic = await opentype.load("/Vollkorn-Italic.ttf");
      const notoSansMono = await opentype.load("/NotoSansMono-Bold.ttf");

      // Draw Left Card.
      page.drawRectangle({
        x: 0,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        color: rgb(0, 0, 0),
      });
      page.drawPage(overlay1EmbeddedPage, {
        x: 0,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });

      // Title.
      const titleFontSize = 11.5;
      const maxTitleWidth = (2 / 3) * CARD_WIDTH;
      const titleLines = wrapText(title, vollkornBold, titleFontSize, maxTitleWidth);
      const lineHeight = titleFontSize * 1.2;
      const totalTitleHeight = titleLines.length * lineHeight;
      let currentY = (CARD_HEIGHT + totalTitleHeight) / 2 - 10;
      titleLines.forEach((line) => {
        const lineWidth = vollkornBold.getAdvanceWidth(line, titleFontSize);
        const lineX = (CARD_WIDTH - lineWidth) / 2;
        drawTextAsVector(page, vollkornBold, line, lineX, currentY, titleFontSize, rgb(0.98, 0.98, 0.98));
        currentY -= lineHeight;
      });

      // Milestone Date.
      const milestoneFontSize = 8.5;
      const milestoneWidth = vollkornRegular.getAdvanceWidth(milestoneDate, milestoneFontSize);
      const milestoneX = (CARD_WIDTH - milestoneWidth) / 2;
      const milestoneY = CARD_HEIGHT - 33.5;
      drawTextAsVector(page, vollkornRegular, milestoneDate, milestoneX, milestoneY, milestoneFontSize, rgb(0.98, 0.98, 0.98));

      // Dedication.
      const dedicationFontSize = 8.5;
      const dedicationWidth = vollkornItalic.getAdvanceWidth(dedicationLine, dedicationFontSize);
      const dedicationX = (CARD_WIDTH - dedicationWidth) / 2;
      const dedicationY = 28;
      drawTextAsVector(page, vollkornItalic, dedicationLine, dedicationX, dedicationY, dedicationFontSize, rgb(0.98, 0.98, 0.98));

      // Draw Right Card.
      page.drawRectangle({
        x: CARD_WIDTH,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        color: rgb(0, 0, 0),
      });
      page.drawPage(overlay2EmbeddedPage, {
        x: CARD_WIDTH,
        y: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });

      // Subdomain.
      const subdomainText = `${subdomain}.ossotna.com`;
      const subdomainFontSize = 6;
      const subdomainX = CARD_WIDTH + 36.35;
      const subdomainY = 24;
      drawTextAsVector(page, notoSansMono, subdomainText, subdomainX, subdomainY, subdomainFontSize, rgb(0.98, 0.98, 0.98));

      // QR Code.
      try {
        const rawSvg = await generateQRCodeAPI(subdomain);
        console.log("Raw SVG:", rawSvg);
        const cleanedSvg = processQrCodeSvg(rawSvg);
        console.log("Cleaned SVG:", cleanedSvg);
        const qrPdfBlob = await generateQrCodePdf(cleanedSvg, subdomain);
        console.log("QR PDF Blob:", qrPdfBlob);
        const qrPdfBytes = await qrPdfBlob.arrayBuffer();
        console.log("QR PDF Bytes length:", qrPdfBytes.byteLength);
        const embeddedPages = await pdfDoc.embedPdf(qrPdfBytes);
        const qrEmbeddedPage = embeddedPages[0];
        const qrDesiredSize = mmToPt(33);
        const qrX = CARD_WIDTH + (CARD_WIDTH - qrDesiredSize) / 2;
        const qrY = (CARD_HEIGHT - qrDesiredSize) / 2;
        page.drawPage(qrEmbeddedPage, {
          x: qrX,
          y: qrY,
          width: qrDesiredSize,
          height: qrDesiredSize,
        });
        console.log("QR code embedded successfully.");
      } catch (error) {
        console.error("Error embedding QR code:", error);
        const qrDesiredSize = mmToPt(30);
        const qrX = CARD_WIDTH + (CARD_WIDTH - qrDesiredSize) / 2;
        const qrY = (CARD_HEIGHT - qrDesiredSize) / 2;
        page.drawRectangle({
          x: qrX,
          y: qrY,
          width: qrDesiredSize,
          height: qrDesiredSize,
          borderColor: rgb(0.98, 0.98, 0.98),
          borderWidth: 1,
          color: rgb(0.9, 0.9, 0.9),
        });
        const qrTextX = qrX + qrDesiredSize / 2 - 25;
        const qrTextY = qrY + qrDesiredSize / 2;
        drawTextAsVector(page, notoSansMono, "QR Code", qrTextX, qrTextY, 10, rgb(0, 0, 0));
      }

      const pdfBytes = await pdfDoc.save();
      console.log("PDF Bytes length:", pdfBytes.length);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      console.log("Blob URL:", blobUrl);
      setDownloadUrl(blobUrl);
      setPdfData(blobUrl);
      toast.success("PDF generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to convert the PDF preview to an image
  const convertPdfToImage = async () => {
    try {
      if (!pdfData) {
        await generatePDF();
      }
      
      // Get the PDF preview element
      const pdfElement = document.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
      if (!pdfElement) {
        throw new Error('PDF preview element not found');
      }
      
      // Convert the canvas to a data URL
      const dataUrl = pdfElement.toDataURL('image/jpeg', 0.8);
      setImageData(dataUrl);
      
      return dataUrl;
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      toast.error('Failed to convert PDF to image');
      return null;
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const filename = `ossotna card ${subdomain}.pdf`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSend = async () => {
    try {
      if (!pdfData) {
        await generatePDF();
      }
      
      // Convert PDF to image
      const imageData = await convertPdfToImage();
      
      if (imageData && onSendCardPreview) {
        onSendCardPreview(imageData);
      } else {
        toast.success("PDF ready to send!");
      }
    } catch (error) {
      console.error('Error sending PDF:', error);
      toast.error('Failed to send PDF');
    }
  };

  const handlePrint = () => {
    if (!downloadUrl) return;
    
    if (onSendToPrinter) {
      onSendToPrinter(downloadUrl);
    } else {
      toast.info("Print functionality not configured");
    }
  };

  // Expose functions through ref
  useImperativeHandle(ref, () => ({
    generatePDF,
    convertPdfToImage,
    getImageData: () => imageData,
    handleSend,
    handlePrint
  }));

  useEffect(() => {
    generatePDF();
  }, []);

  return (
    <div className="p-4 w-full display-flex justify-center align-center">
      {/* PDF Preview using react-pdf */}
      <div className="relative w-full" style={{ aspectRatio: '1.26/1', display: "flex", justifyContent: "center", alignItems: "center" }}>
        {pdfData ? (
          <Document 
            file={pdfData}
            onLoadSuccess={(pdf) => console.log("PDF loaded successfully:", pdf)}
            onLoadError={(err) => console.error("Error loading PDF:", err)}
          >
            <Page pageNumber={1} style={{ width: '100%' }}  scale={1.2} />
          </Document>
        ) : (
          <p className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            {isLoading ? "Generating PDF..." : "No PDF data"}
          </p>
        )}
      </div>
      <div className="flex gap-4 m-2">
        <button
          onClick={generatePDF}
          className="w-1/4 px-2 py-2 bg-yellow-700 text-white hover:bg-yellow-900 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Generating..." : "Generate"}
        </button>

        <button
          onClick={handleDownload}
          className="w-1/4 px-2 py-2 bg-blue-700 text-white hover:bg-blue-900 disabled:opacity-50"
          disabled={!downloadUrl}
        >
          Download
        </button>

        <button
          onClick={handleSend}
          className="w-1/4 px-2 py-2 bg-green-700 text-white hover:bg-green-900 disabled:opacity-50"
          disabled={!pdfData}
        >
          Send
        </button>

        <button
          onClick={handlePrint}
          className="w-1/4 px-2 py-2 bg-purple-700 text-white hover:bg-purple-900 disabled:opacity-50"
          disabled={!downloadUrl}
        >
          Print
        </button>
      </div>
    </div>
  );
});

export default OnePDFWithTwoFrames;