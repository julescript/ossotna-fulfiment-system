import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import opentype from "opentype.js";
import ArabicReshaper from "arabic-reshaper";
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
  orderName?: string;
  cardQuantity?: number;
  storyType?: string;
  onSendCardPreview?: (imageData: string) => void;
  onSendCombo?: (imageData: string) => void;
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
  onSendCombo,
  onSendToPrinter,
  orderName = "",
  cardQuantity = 1,
  storyType = "",
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [imageData, setImageData] = useState(null);

  // Helper: detect if text contains Arabic characters
  const isArabic = (text) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

  // Helper: reshape Arabic text for correct rendering
  const reshapeArabic = (text) => {
    try {
      const reshaped = ArabicReshaper.convertArabic(text);
      // Return reshaped text as-is; pdf-lib with embedded font handles rendering
      return reshaped;
    } catch (e) {
      console.error('Arabic reshaping failed:', e);
      return text;
    }
  };

  // Helper: wrap text for pdf-lib embedded fonts (uses widthOfTextAtSize)
  const wrapTextEmbedded = (text, font, fontSize, maxWidth) => {
    const paragraphs = text.split('\n');
    let lines = [];
    for (let paragraph of paragraphs) {
      const words = paragraph.split(" ");
      let currentLine = "";
      if (words.length === 1 && words[0] === "") {
        lines.push("");
        continue;
      }
      for (let word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);
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

  // Helper: get advance width for Arabic text glyph-by-glyph (bypasses broken GSUB in opentype.js)
  const getArabicAdvanceWidth = (font, text, fontSize) => {
    const fontScale = fontSize / font.unitsPerEm;
    let width = 0;
    for (const ch of text) {
      const glyph = font.charToGlyph(ch);
      width += glyph.advanceWidth * fontScale;
    }
    return width;
  };

  // Helper: wrap Arabic text using manual glyph width calculation
  const wrapTextArabic = (text, font, fontSize, maxWidth) => {
    const paragraphs = text.split('\n');
    let lines = [];
    for (let paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let currentLine = '';
      if (words.length === 1 && words[0] === '') {
        lines.push('');
        continue;
      }
      for (let word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testLineWidth = getArabicAdvanceWidth(font, testLine, fontSize);
        if (testLineWidth > maxWidth && currentLine !== '') {
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

  // Helper: draw Arabic text as vector outlines glyph-by-glyph (bypasses broken GSUB in opentype.js)
  // Characters are reversed for RTL visual order: first logical char renders at the right.
  const drawArabicAsVector = (page, font, text, x, y, fontSize, color) => {
    const fontScale = fontSize / font.unitsPerEm;
    const chars = [...text].reverse();
    let cursorX = 0;
    const allCommands = [];
    for (const ch of chars) {
      const glyph = font.charToGlyph(ch);
      const glyphPath = glyph.getPath(cursorX, 0, fontSize);
      allCommands.push(...glyphPath.commands);
      cursorX += glyph.advanceWidth * fontScale;
    }
    const path = new opentype.Path();
    path.commands = allCommands;
    const pathData = path.toPathData();
    if (pathData) {
      page.drawSvgPath(pathData, { x, y, color });
    }
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

      // Load Arabic fonts via opentype.js for vector outline rendering.
      // We use glyph-by-glyph path building to bypass opentype.js's broken GSUB
      // (lookupType 5 substFormat 3 not supported). ArabicReshaper already provides
      // presentation form codepoints so no OpenType features are needed.
      const needsArabic = isArabic(title) || isArabic(milestoneDate) || isArabic(dedicationLine);
      let arabicBoldFont = null;
      let arabicRegularFont = null;
      if (needsArabic) {
        try {
          arabicBoldFont = await opentype.load("/Noto_Kufi_Arabic/NotoKufiArabic-Bold.ttf");
          arabicRegularFont = await opentype.load("/Noto_Kufi_Arabic/NotoKufiArabic-Regular.ttf");
          console.log("Arabic fonts loaded successfully");
        } catch (e) {
          console.error("Failed to load Arabic fonts:", e);
        }
      }

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

      // Title (with optional mother icon above).
      const isMother = storyType?.toLowerCase() === "mother";
      const titleIsArabic = isArabic(title) && arabicBoldFont;
      const titleFontSize = titleIsArabic ? 11.5 : 11.5;
      const maxTitleWidth = (2 / 3) * CARD_WIDTH;

      // Calculate title lines and height
      let titleLines: string[];
      let lineHeight: number;
      let totalTitleHeight: number;
      if (titleIsArabic) {
        const titleText = reshapeArabic(title);
        titleLines = wrapTextArabic(titleText, arabicBoldFont, titleFontSize, maxTitleWidth);
        lineHeight = titleFontSize * 1.4;
        totalTitleHeight = titleLines.length * lineHeight;
      } else {
        titleLines = wrapText(title, vollkornBold, titleFontSize, maxTitleWidth);
        lineHeight = titleFontSize * 1.2;
        totalTitleHeight = titleLines.length * lineHeight;
      }

      // Mother icon dimensions
      const iconWidth = isMother ? CARD_WIDTH * 0.244 : 0;
      const iconNaturalW = 38;
      const iconNaturalH = 48;
      const iconHeight = isMother ? iconWidth * (iconNaturalH / iconNaturalW) : 0;
      const iconGap = isMother ? 16 : 0; // gap between icon and title

      // Combined height of icon + gap + title text
      const combinedHeight = iconHeight + iconGap + totalTitleHeight;

      // Vertically center the combined block (icon + title)
      const blockTopY = (CARD_HEIGHT + combinedHeight) / 2 - 10;

      // Draw mother icon as SVG path (vector graphics)
      if (isMother) {
        try {
          // SVG path data from mother-icon.svg
          const iconPathData = "M37.167 31.6601C36.3998 27.7221 34.4052 24.3978 32.0014 21.2268C30.6717 19.488 28.984 18.6185 26.8871 18.1582C22.233 17.1865 17.5278 17.2888 12.8737 17.9537C9.8051 18.4139 7.19677 19.4368 5.56018 22.352C3.10528 26.6481 0.701531 30.893 0.0878072 35.9051C-0.423629 40.0477 1.26411 44.5995 6.07161 46.3895C9.85624 47.8215 13.7943 48.1795 17.7835 47.9238C20.3918 47.7704 21.7216 46.3895 21.6704 44.2415C21.6193 42.1446 20.2384 41.0194 17.5789 40.9172C15.3798 40.8149 13.1294 40.8149 10.9303 40.6614C9.29366 40.5591 7.70821 40.2011 6.88991 38.3088C7.60592 38.2065 8.1685 38.1042 8.73108 38.002C9.8051 37.7974 10.9303 37.644 12.0043 37.3882C12.7714 37.2348 13.1294 36.8257 12.7714 35.9562C12.3111 34.7799 11.9531 33.6036 11.6974 32.3762C11.4928 31.4044 11.5951 30.3816 12.6691 29.8701C13.692 29.3587 14.6637 29.8701 15.3286 30.535C16.3515 31.5579 17.2721 32.6319 18.0392 33.8082C19.6758 36.2119 21.7216 37.8485 24.8925 37.5417C24.9948 37.5417 25.0971 37.644 25.4039 37.7462C24.8413 38.3088 24.381 38.718 23.9719 39.1783C22.591 40.8149 22.8467 42.8606 24.6879 43.7301C25.6085 44.1903 26.8359 44.3949 27.8588 44.2926C31.1831 43.9346 33.2289 41.6843 35.3769 39.434C37.525 37.1837 37.6784 34.473 37.167 31.6601ZM24.7902 36.6722C21.3124 36.6722 19.0621 34.5753 19.0621 31.3533C19.0621 27.8755 21.5681 25.5229 25.2505 25.5229C28.3702 25.5229 30.3649 27.5175 30.3649 30.6884C30.3649 34.115 28.0122 36.6722 24.7902 36.6722ZM19.2155 15.4476C24.4833 15.4476 27.1939 11.4073 26.8359 7.98064C27.0917 3.83801 23.8185 0.155662 18.5507 0.00223133C13.9989 -0.100056 10.5211 3.32656 10.5211 7.77606C10.5723 12.379 14.408 15.4476 19.2155 15.4476Z";
          // SVG viewBox is 38x48, scale to iconWidth x iconHeight
          const scaleX = iconWidth / iconNaturalW;
          const scaleY = iconHeight / iconNaturalH;
          const iconX = (CARD_WIDTH - iconWidth) / 2;
          const iconY = blockTopY - iconHeight;
          // Transform: translate to position, scale to size, flip Y (SVG top-left vs PDF bottom-left)
          page.drawSvgPath(iconPathData, {
            x: iconX,
            y: iconY + iconHeight, // PDF y is bottom-left, SVG is top-left
            scale: scaleX, // uniform scale (aspect ratio preserved)
            color: rgb(0.98, 0.98, 0.98),
            borderColor: rgb(0.98, 0.98, 0.98),
            borderWidth: 0,
          });
        } catch (e) {
          console.error("Failed to draw mother icon:", e);
        }
      }

      // Draw title lines below icon
      let currentY = blockTopY - iconHeight - iconGap;
      if (titleIsArabic) {
        titleLines.forEach((line) => {
          const lineWidth = getArabicAdvanceWidth(arabicBoldFont, line, titleFontSize);
          const lineX = (CARD_WIDTH - lineWidth) / 2;
          drawArabicAsVector(page, arabicBoldFont, line, lineX, currentY, titleFontSize, rgb(0.98, 0.98, 0.98));
          currentY -= lineHeight;
        });
      } else {
        titleLines.forEach((line) => {
          const lineWidth = vollkornBold.getAdvanceWidth(line, titleFontSize);
          const lineX = (CARD_WIDTH - lineWidth) / 2;
          drawTextAsVector(page, vollkornBold, line, lineX, currentY, titleFontSize, rgb(0.98, 0.98, 0.98));
          currentY -= lineHeight;
        });
      }

      // Milestone Date.
      const dateIsArabic = isArabic(milestoneDate) && arabicRegularFont;
      const milestoneFontSize = dateIsArabic ? 8.5 : 8.5;
      const milestoneY = CARD_HEIGHT - 33.5;
      if (dateIsArabic) {
        const dateText = reshapeArabic(milestoneDate);
        const milestoneWidth = getArabicAdvanceWidth(arabicRegularFont, dateText, milestoneFontSize);
        const milestoneX = (CARD_WIDTH - milestoneWidth) / 2;
        drawArabicAsVector(page, arabicRegularFont, dateText, milestoneX, milestoneY, milestoneFontSize, rgb(0.98, 0.98, 0.98));
      } else {
        const milestoneWidth = vollkornRegular.getAdvanceWidth(milestoneDate, milestoneFontSize);
        const milestoneX = (CARD_WIDTH - milestoneWidth) / 2;
        drawTextAsVector(page, vollkornRegular, milestoneDate, milestoneX, milestoneY, milestoneFontSize, rgb(0.98, 0.98, 0.98));
      }

      // Dedication (supports multi-line via \n).
      const dedicationIsArabic = isArabic(dedicationLine) && arabicRegularFont;
      const dedicationFontSize = dedicationIsArabic ? 8.5 : 8.5;
      const dedicationBaseY = 28;
      const dedicationLineHeight = dedicationFontSize * 1.3;
      const maxDedicationWidth = (2 / 3) * CARD_WIDTH;
      if (dedicationIsArabic) {
        const dedicationText = reshapeArabic(dedicationLine);
        const dedicationLines = wrapTextArabic(dedicationText, arabicRegularFont, dedicationFontSize, maxDedicationWidth);
        let currentY = dedicationBaseY + (dedicationLines.length - 1) * dedicationLineHeight;
        dedicationLines.forEach((line) => {
          const lineWidth = getArabicAdvanceWidth(arabicRegularFont, line, dedicationFontSize);
          const lineX = (CARD_WIDTH - lineWidth) / 2;
          drawArabicAsVector(page, arabicRegularFont, line, lineX, currentY, dedicationFontSize, rgb(0.98, 0.98, 0.98));
          currentY -= dedicationLineHeight;
        });
      } else {
        const dedicationLines = wrapText(dedicationLine, vollkornItalic, dedicationFontSize, maxDedicationWidth);
        let currentY = dedicationBaseY + (dedicationLines.length - 1) * dedicationLineHeight;
        dedicationLines.forEach((line) => {
          const lineWidth = vollkornItalic.getAdvanceWidth(line, dedicationFontSize);
          const lineX = (CARD_WIDTH - lineWidth) / 2;
          drawTextAsVector(page, vollkornItalic, line, lineX, currentY, dedicationFontSize, rgb(0.98, 0.98, 0.98));
          currentY -= dedicationLineHeight;
        });
      }

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
    const filename = orderName
      ? `Ossotna ${cardQuantity} card${cardQuantity > 1 ? 's' : ''} ${orderName.replace('#', '')}.pdf`
      : `ossotna card ${subdomain}.pdf`;
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

  const handleSendCombo = async () => {
    try {
      if (!pdfData) {
        await generatePDF();
      }
      const imageData = await convertPdfToImage();
      if (imageData && onSendCombo) {
        onSendCombo(imageData);
      } else {
        toast.error('Failed to generate card preview for combo send');
      }
    } catch (error) {
      console.error('Error in combo send:', error);
      toast.error('Failed to prepare combo send');
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

  // PDF generation is manual — click the Generate button

  return (
    <div className="w-full flex flex-col items-center">
      {/* PDF Preview - fills container width */}
      <div className="relative w-full flex justify-center items-center" style={{ minHeight: '300px' }}>
        {pdfData ? (
          <Document 
            file={pdfData}
            onLoadSuccess={(pdf) => console.log("PDF loaded successfully:", pdf)}
            onLoadError={(err) => console.error("Error loading PDF:", err)}
          >
            <Page pageNumber={1} width={420} />
          </Document>
        ) : (
          <div
            className={`w-full min-h-[300px] rounded-lg border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-3 bg-gray-900/30 ${!isLoading ? 'cursor-pointer hover:border-yellow-600 hover:bg-gray-900/50 transition-colors' : ''}`}
            onClick={() => { if (!isLoading) generatePDF(); }}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500"></div>
                <span className="text-sm text-gray-400">Generating PDF...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[48px] text-gray-600">picture_as_pdf</span>
                <span className="text-sm text-gray-500">Click to generate preview</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action buttons - row below preview */}
      <div className="flex gap-2 mt-3 w-full">
        <button onClick={generatePDF} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-medium disabled:opacity-50 transition" disabled={isLoading}>
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          {isLoading ? "..." : "Generate"}
        </button>
        <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50 transition" disabled={!downloadUrl}>
          <span className="material-symbols-outlined text-[18px]">download</span>
          Download
        </button>
        <button onClick={handleSend} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-green-700 hover:bg-green-600 text-white text-sm font-medium disabled:opacity-50 transition" disabled={!pdfData}>
          <span className="material-symbols-outlined text-[18px]">send</span>
          Send
        </button>
        <button onClick={handleSendCombo} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium disabled:opacity-50 transition" disabled={!pdfData}>
          <span className="material-symbols-outlined text-[18px]">package_2</span>
          Combo
        </button>
        <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium disabled:opacity-50 transition" disabled={!downloadUrl}>
          <span className="material-symbols-outlined text-[18px]">print</span>
          Print
        </button>
      </div>
    </div>
  );
});

export default OnePDFWithTwoFrames;