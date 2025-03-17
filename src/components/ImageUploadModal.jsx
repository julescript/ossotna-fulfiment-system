import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';

const ImageUploadModal = ({ isOpen, onClose }) => {
  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  
  // Function to reset the form
  const handleReset = () => {
    setFolderName('');
    setFiles([]);
    setUploadedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('Form has been reset');
  };
  const fileInputRef = useRef(null);
  const dropAreaRef = useRef(null);

  // Handle drag and drop events
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.add('bg-gray-600');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('bg-gray-600');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('bg-gray-600');
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type.startsWith('image/')
      );
      
      if (droppedFiles.length === 0) {
        toast.error('Please drop only image files');
        return;
      }
      
      setFiles(droppedFiles);
      console.log('Files set:', droppedFiles);
    }
  };

  // Handle file selection via button
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      console.log('Files selected:', selectedFiles);
    }
  };

  // Process and upload images
  const handleUpload = async () => {
    console.log('handleUpload called', { folderName, files });
    
    if (!folderName) {
      toast.error('Please enter a folder name');
      return;
    }

    if (!files || files.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    setIsUploading(true);
    const resizedImages = [];

    try {
      // Process each file individually using FormData
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file) {
          console.error(`File at index ${i} is undefined`);
          continue; // Skip this file and try the next one
        }
        
        console.log(`Processing file ${i+1}/${files.length}:`, file.name, file.type, file.size);
        
        // Create FormData for the file upload
        const formData = new FormData();
        
        // Ensure we're sending a valid file object
        if (!(file instanceof File)) {
          console.error(`Invalid file object at index ${i}:`, file);
          continue; // Skip this file
        }
        
        // Log file details for debugging
        console.log(`File details for ${i+1}:`, {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified
        });
        
        // Append the file with a specific field name
        formData.append('file', file, file.name);
        formData.append('folderName', folderName);
        formData.append('index', String(i + 1));
        
        // Use the new direct upload endpoint
        console.log(`Uploading file ${i+1} to /api/upload-image`);
        const processResponse = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });
        
        let responseText;
        try {
          responseText = await processResponse.text();
        } catch (err) {
          console.error('Error reading response text:', err);
          responseText = 'Could not read response';
        }
        
        if (!processResponse.ok) {
          console.error(`Server response for file ${i+1}:`, responseText);
          throw new Error(`Failed to process image on the server. Status: ${processResponse.status}`);
        }
        
        // Parse the JSON response
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (err) {
          console.error('Error parsing JSON response:', err, responseText);
          throw new Error('Invalid response from server');
        }
        
        const { filename, resizedBuffer } = responseData;
        
        // Convert the base64-encoded buffer into a Blob
        const blob = new Blob(
          [Uint8Array.from(atob(resizedBuffer), (c) => c.charCodeAt(0))],
          { type: 'image/jpeg' }
        );

        // Request signature for authenticated upload
        const signatureRes = await fetch('/api/cloudinary-sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: folderName }),
        });
        
        if (!signatureRes.ok) {
          throw new Error('Failed to get Cloudinary signature.');
        }

        const { timestamp, signature, api_key } = await signatureRes.json();

        // FormData for Cloudinary's POST upload endpoint
        const cloudinaryFormData = new FormData();
        cloudinaryFormData.append('file', blob, filename);
        cloudinaryFormData.append('timestamp', timestamp);
        cloudinaryFormData.append('signature', signature);
        cloudinaryFormData.append('api_key', api_key);
        cloudinaryFormData.append('folder', folderName);

        const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/ossotna/upload', {
          method: 'POST',
          body: cloudinaryFormData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image to Cloudinary.');
        }

        const uploadData = await uploadResponse.json();
        resizedImages.push({
          name: filename,
          url: uploadData.secure_url,
        });
        
        // Update progress
        toast.info(`Processed and uploaded ${i + 1} of ${files.length} images`, { autoClose: 1000 });
      }

      // Set uploaded images
      setUploadedImages(resizedImages);
      
      // Get URLs
      const photoUrls = resizedImages.map(img => img.url);
      
      // Try to copy URLs to clipboard - wrap in try/catch to handle permission issues
      try {
        await navigator.clipboard.writeText(JSON.stringify(photoUrls));
        toast.success('Image URLs copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        toast.warning('Could not copy to clipboard automatically. Please ensure the page is focused.');
      }
      
      // Download JSON file
      try {
        downloadJsonFile(folderName, photoUrls);
        toast.success('JSON file downloaded successfully!');
      } catch (downloadError) {
        console.error('Download error:', downloadError);
        toast.error('Failed to download JSON file. Please try again.');
      }
      
      toast.success(`${resizedImages.length} images processed and uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(`Failed to upload images: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  
  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Helper function to download JSON file
  const downloadJsonFile = (folderName, photoUrls) => {
    const jsonData = JSON.stringify({ folderName, images: photoUrls }, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folderName}_images.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;
  
  // Debug output
  console.log('Current state:', { folderName, files, isUploading, filesLength: files.length });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-700 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Upload Images</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center h-8 w-8"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white"
              placeholder="Enter folder name"
            />
          </div>

          <div 
            ref={dropAreaRef}
            className="border-2 border-dashed border-gray-500 rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors hover:bg-gray-600"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept="image/*"
            />
            <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">
              cloud_upload
            </span>
            <p className="text-gray-300">
              Drag and drop images here, or click to select files
            </p>
            {files && files.length > 0 && (
              <p className="mt-2 text-green-400">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {files && files.length > 0 && (
            <div className="mb-6 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-gray-300 mb-2">Selected Files:</p>
              <ul className="text-sm text-gray-400">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between py-2 border-b border-gray-600">
                    <div className="flex flex-col">
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newFiles = [...files];
                        newFiles.splice(index, 1);
                        setFiles(newFiles);
                      }}
                      className="text-red-500 hover:text-red-400 ml-2"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        delete
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between">
            {/* Reset Button */}
            <button
              onClick={handleReset}
              disabled={isUploading}
              className={`px-4 py-2 rounded ${
                isUploading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              } text-white flex items-center`}
            >
              <span className="material-symbols-outlined mr-2">
                refresh
              </span>
              Reset
            </button>
            
            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={isUploading || !folderName || !files.length}
              className={`px-4 py-2 rounded ${
                isUploading || !folderName || !files.length
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              } text-white flex items-center`}
            >
              {isUploading ? (
                <>
                  <span className="material-symbols-outlined mr-2 animate-spin">
                    autorenew
                  </span>
                  Uploading...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined mr-2">
                    cloud_upload
                  </span>
                  Upload Images
                </>
              )}
            </button>
          </div>

          {uploadedImages.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-green-400 mb-2">
                {uploadedImages.length} image{uploadedImages.length !== 1 ? 's' : ''} uploaded successfully!
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {uploadedImages.map((img, index) => (
                  <div 
                    key={index} 
                    className="relative w-16 h-16 overflow-hidden rounded cursor-pointer hover:opacity-80 transition-opacity group"
                    onClick={() => {
                      navigator.clipboard.writeText(img.url);
                      toast.success(`Copied image URL: ${img.name}`, { autoClose: 1500 });
                    }}
                    title="Click to copy image URL"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center transition-all">
                      <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        content_copy
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageUploadModal;
