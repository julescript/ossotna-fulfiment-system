import React, { useRef, useState, useEffect } from "react";
import { toast } from "react-toastify";

const OneSVGWithTwoFrames = ({
    milestoneDate = "01/01/2025",
    title = "A Special Title",
    dedicationLine = "With all my love",
    // Remove qrCodeSvg from props as we'll fetch it within the component
    qr,
    subdomain = "example.ossotna.com",
}) => {
    const svgRef = useRef(null);

    // State variables for QR code SVG, loading, and error
    const [qrCodeSvg, setQrCodeSvg] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch QR code when component mounts or subdomain changes
    useEffect(() => {
        const fetchQRCode = async () => {
            setIsLoading(true);
            setError(null);
            try {
                setQrCodeSvg(qr);
            } catch (err) {
                console.error("Error parse QR code:", err);
                setError("Failed to parse QR code.");
                toast.error("Failed parsing QR code.", { autoClose: 2000 });
            } finally {
                setIsLoading(false);
            }
        };

        fetchQRCode();
    }, [qr]);

    const handleDownload = () => {
        if (!svgRef.current) return;

        const svgElement = svgRef.current;
        const svgData = new XMLSerializer().serializeToString(svgElement);

        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "combined-frames.svg";
        link.click();

        URL.revokeObjectURL(url);
    };

    function wrapTextIntoTspans(text, maxChars) {
        const lines = [];
        let current = 0;
        while (current < text.length) {
            lines.push(text.slice(current, current + maxChars));
            current += maxChars;
        }
        return lines;
    }

    /**
     * Copy the raw SVG code to the clipboard and show a toast
     */
    const handleCopyToClipboard = async () => {
        if (!svgRef.current) return;

        try {
            const svgElement = svgRef.current;
            const svgData = new XMLSerializer().serializeToString(svgElement);

            await navigator.clipboard.writeText(svgData);
            toast.success("SVG code copied to clipboard!", { autoClose: 2000 });
        } catch (err) {
            console.error("Failed to copy SVG:", err);
            toast.error("Failed to copy SVG.", { autoClose: 2000 });
        }
    };

    return (
        <div className="p-0">
            {/* Show loading indicator or error message if needed */}
            {isLoading && <p>Loading QR Code...</p>}
            {error && <p className="text-red-500">{error}</p>}
            {!isLoading && !error && (
                <svg
                    ref={svgRef}
                    // Total width = 2 frames wide = (2 * 5.4cm) = 10.8cm
                    // Height = 8.56cm
                    width="10.80cm"
                    height="8.56cm"
                    viewBox="0 0 1080.6 856"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ display: "block", border: "0.5px solid orange" }}
                >
                    {/* FRAME #1 group at x=0 */}
                    <g id="frame1">
                        {/* Black background for Frame #1 */}
                        <rect
                            x="0"
                            y="0"
                            width="540"
                            height="856"
                            fill="black"
                        />
                        {/* White border rectangle */}
                        <rect
                            x="30"
                            y="30"
                            width="480"
                            height="796"
                            stroke="#FAFAFA"
                            fill="none"
                            strokeWidth="2.5"
                            rx="18"
                            ry="18"
                        />

                        {/* Milestone Date near top */}
                        <text
                            x="25%"
                            y="120" // near top
                            fill="#FAFAFA"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                            fontSize="28"
                        >
                            {milestoneDate}
                        </text>

                        {/* Title (bold, near the middle) */}
                        <text
                            x="25%"
                            y="50%"
                            fill="#FAFAFA"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                            fontWeight="bold"
                            fontSize="38"
                        >
                            {wrapTextIntoTspans(title, 18).map((line, index) => (
                                <tspan key={index} x="25%" dy="1.4em" textAnchor="middle">
                                    {line}
                                </tspan>
                            ))}
                        </text>

                        {/* Dedication Line near bottom */}
                        <text
                            x="25%"
                            y="760"
                            fill="#FAFAFA"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                            fontSize="28"
                        >
                            {dedicationLine}
                        </text>
                    </g>

                    {/* FRAME #2 group shifted horizontally by 540px */}
                    <g id="frame2" transform="translate(540, 0)">
                        {/* Black background for Frame #2 */}
                        <rect
                            x="0"
                            y="0"
                            width="540"
                            height="856"
                            fill="#11f"
                        />
                        {/* For the second frame, just an example structure: */}
                        {/* "Ossotna" near top */}
                        <svg
                            x="15%"
                            y="0"
                            viewBox="0 0 250 160"
                            fill="#FAFAFA"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <rect
                                x="0"
                                y="0"
                                fill="#ff00ff"  // or any color you like
                            />
                            <path d="M9.0651 2.90468C10.9971 4.83668 10.9971 7.97268 9.0651 9.90468C7.1191 11.8367 3.9831 11.8367 2.0511 9.90468C0.119103 7.97268 0.119103 4.83668 2.0511 2.90468C3.9831 0.95868 7.1331 0.95868 9.0651 2.90468ZM8.9951 9.84868C10.6471 8.18268 9.8771 5.77468 7.9871 3.87068C6.0831 1.96668 3.7731 1.30868 2.1211 2.97468C0.469103 4.62668 1.2671 7.27268 3.1711 9.17668C5.0611 11.0667 7.3431 11.5007 8.9951 9.84868ZM14.0358 7.49668C14.9318 7.90268 15.9958 8.37868 15.9958 9.58268C15.9958 10.7727 14.9738 11.5147 13.5038 11.5147C12.7338 11.5147 11.8658 11.3187 11.0958 10.7867L11.5438 9.68068C12.1178 10.2687 12.5518 11.4167 13.5458 11.4167C14.6518 11.4167 15.3938 10.9267 15.4218 10.0307C15.4498 9.34468 14.4418 8.92468 13.6018 8.54668L13.0698 8.30868C12.1178 7.87468 11.2498 7.00668 11.2498 5.87268C11.2498 4.80868 12.2158 4.17868 13.4758 4.17868C14.3158 4.17868 15.1698 4.43068 15.7298 4.76668L15.0998 6.16668C14.6378 5.78868 14.2738 4.26268 13.4058 4.26268C12.3698 4.26268 11.8098 4.97668 11.8098 5.67668C11.8098 6.55868 12.7898 6.93668 13.5038 7.25868L14.0358 7.49668ZM19.5319 7.49668C20.4279 7.90268 21.4919 8.37868 21.4919 9.58268C21.4919 10.7727 20.4699 11.5147 18.9999 11.5147C18.2299 11.5147 17.3619 11.3187 16.5919 10.7867L17.0399 9.68068C17.6139 10.2687 18.0479 11.4167 19.0419 11.4167C20.1479 11.4167 20.8899 10.9267 20.9179 10.0307C20.9459 9.34468 19.9379 8.92468 19.0979 8.54668L18.5659 8.30868C17.6139 7.87468 16.7459 7.00668 16.7459 5.87268C16.7459 4.80868 17.7119 4.17868 18.9719 4.17868C19.8119 4.17868 20.6659 4.43068 21.2259 4.76668L20.5959 6.16668C20.1339 5.78868 19.7699 4.26268 18.9019 4.26268C17.8659 4.26268 17.3059 4.97668 17.3059 5.67668C17.3059 6.55868 18.2859 6.93668 18.9999 7.25868L19.5319 7.49668ZM28.3599 5.18668C29.0599 5.88668 29.4379 6.81068 29.4379 7.79068C29.4379 8.77068 29.0599 9.69468 28.3599 10.3807C27.6739 11.0807 26.7499 11.4587 25.7699 11.4587C24.7899 11.4587 23.8659 11.0807 23.1659 10.3807C21.7379 8.95268 21.7379 6.61468 23.1659 5.18668C24.6079 3.75868 26.9319 3.75868 28.3599 5.18668ZM28.2339 10.2547C28.7939 9.68068 28.8219 8.89668 28.7379 8.04268C28.6679 7.17468 28.2619 6.34868 27.6039 5.67668C26.8479 4.92068 25.8959 4.52868 24.9999 4.52868C24.2719 4.52868 23.8239 4.79468 23.3059 5.32668C22.1299 6.50268 22.5639 8.33668 23.9499 9.70868C25.3359 11.0947 27.0579 11.4307 28.2339 10.2547ZM34.2115 10.8567L34.3095 11.0247C33.8055 11.3187 33.3295 11.5147 32.6995 11.5147C31.1175 11.5147 30.5995 10.2267 30.5995 9.75068L30.5855 4.54268L29.5355 4.89268L29.4375 4.34668L30.5155 4.33268L31.7055 2.23268H31.7615V4.33268H34.2395L33.9035 4.99068L31.7615 4.55668V9.63868C31.7615 10.0587 31.7755 11.3467 33.0075 11.3467C33.3295 11.3467 33.7355 11.1087 34.2115 10.8567ZM38.9351 4.17868C40.3911 4.17868 41.1471 4.96268 41.1471 6.67068V11.3467H39.9991V6.76868C39.9991 6.18068 40.3491 4.45868 38.5011 4.45868C37.6331 4.45868 36.9751 4.87868 36.1631 5.64868V11.3467H35.0431V4.50068L36.1071 4.23468H36.1631V5.39668C37.0311 4.59868 37.8711 4.17868 38.9351 4.17868ZM48.3352 11.1507C48.4052 11.1507 48.4892 11.1367 48.5732 11.1227V11.2067C48.3212 11.3607 48.0552 11.4447 47.8032 11.4447C47.1452 11.4447 46.4732 10.8007 46.4452 10.4367C45.6892 11.1227 44.6812 11.4867 43.8132 11.4867C42.7492 11.4867 41.9792 10.9127 41.9792 9.90468C41.9792 8.63068 43.2252 7.91668 45.0452 7.70668C45.5212 7.65068 45.9972 7.60868 46.4452 7.58068V6.78268C46.4452 5.27068 45.8572 4.52868 44.6252 4.52868C43.8692 4.52868 43.2532 4.79468 42.5812 5.36868L42.4692 5.22868C43.1972 4.55668 44.4992 4.22068 45.4652 4.22068C46.9072 4.22068 47.6632 5.00468 47.6632 6.71268V10.1427C47.6632 10.7867 47.6632 11.1507 48.3352 11.1507ZM46.4452 10.1847V7.91668C44.5692 7.84668 42.7492 7.98668 42.8472 9.41468C42.9172 10.4647 43.5472 10.9407 44.4152 10.9407C45.1572 10.9407 45.7872 10.8147 46.4452 10.1847Z" fill="#FAFAFA" />
                        </svg>

                        {/* Updated QR Code Positioning */}
                        <svg
                            x="8.5%" // Centers the QR code horizontally (540px * 20% = 108px)
                            y="0" // Starts positioning from the vertical center
                            width="33%" // Sets the QR code width to 60% of frame width (324px)
                            height="auto" // Maintains aspect ratio
                            // Adjust the transform to center vertically by translating up by half the QR code's height
                            transform="translate(0, 0)" // 162px is half of 324px
                            preserveAspectRatio="xMidYMid meet"
                            xmlns="http://www.w3.org/2000/svg"
                            dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                        />

                        {/* Subdomain near bottom */}
                        <text
                            x="25%"
                            y="760"
                            fill="#FAFAFA"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                            fontSize="20"
                            dominantBaseline="middle"
                        >
                            {subdomain}.ossotna.com
                        </text>
                    </g>
                </svg>
            )}

            <div className="mt-4 flex gap-4">
                {/* Copy to Clipboard Button */}
                <button
                    onClick={handleCopyToClipboard}
                    className="text-white-500 hover:text-white-600 transition p-2 pt-2 pr-4 pl-4 bg-yellow-700 hover:bg-yellow-900"
                    disabled={isLoading || !!error}
                >
                    Copy SVG
                </button>
                {/* Download Button */}
                <button
                    onClick={handleDownload}
                    className="text-white-500 hover:text-white-600 transition p-2 pt-2 pr-4 pl-4 bg-yellow-700 hover:bg-yellow-900"
                    disabled={isLoading || !!error}
                >
                    Download SVG
                </button>
            </div>
        </div>
    );
};

export default OneSVGWithTwoFrames;