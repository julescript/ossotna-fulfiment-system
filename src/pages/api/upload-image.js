import { formidable } from 'formidable';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import heicConvert from 'heic-convert';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // No limit on response size
    externalResolver: true, // Indicates this route is handled by an external resolver
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create a temporary directory
    const tempDir = path.join(os.tmpdir(), 'ossotna-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Parse the form data
    const options = {
      uploadDir: tempDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      multiples: true,
      filename: (name, ext, part) => {
        // Generate a unique filename
        return `${Date.now()}-${part.originalFilename}`;
      }
    };

    // Parse the form
    const [fields, files] = await new Promise((resolve, reject) => {
      const form = formidable(options);
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parsing error:', err);
          reject(err);
        } else {
          console.log('Formidable parsed files:', JSON.stringify(files, null, 2));
          resolve([fields, files]);
        }
      });
    });

    console.log('Fields:', fields);
    console.log('Files:', files);
    
    const folderName = fields.folderName || 'default';
    const index = fields.index || '1';
    
    // Log the complete structure of the files object
    console.log('Files object structure:', JSON.stringify(files, null, 2));
    
    // Handle different possible file structures
    let file = null;
    
    if (files.file) {
      // Direct file property
      file = Array.isArray(files.file) ? files.file[0] : files.file;
    } else {
      // Look for any file in the files object
      const fileKeys = Object.keys(files);
      if (fileKeys.length > 0) {
        const firstKey = fileKeys[0];
        file = Array.isArray(files[firstKey]) ? files[firstKey][0] : files[firstKey];
      }
    }
    
    if (!file) {
      console.error('No file found in request. Files object:', files);
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('Selected file for processing:', file);
    
    // Get the file path, ensuring it exists
    const filePath = file.filepath || file.path;
    if (!filePath) {
      console.error('File path is undefined. File object:', file);
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Verify file exists on disk
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist at path: ${filePath}`);
      return res.status(400).json({ error: 'File not found on server' });
    }
    
    // Read the file
    const imageBuffer = fs.readFileSync(filePath);

    // Detect the real image format
    const fileType = await fileTypeFromBuffer(imageBuffer);
    
    // Skip non-image files
    if (!fileType || !fileType.mime.startsWith('image/')) {
      // Clean up safely
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error cleaning up file:', err);
      }
      return res.status(400).json({ error: 'Not a valid image file' });
    }

    // Convert HEIC/HEIF to JPEG if needed
    let processedBuffer = imageBuffer;
    if (fileType.ext === 'heic' || fileType.ext === 'heif') {
      processedBuffer = await heicConvert({
        buffer: imageBuffer,
        format: 'JPEG',
        quality: 1,
      });
    }

    // Resize and convert to JPEG
    const resizedBuffer = await sharp(processedBuffer)
      .resize({ width: 800 })
      .jpeg()
      .toBuffer();

    // Generate the image name
    const imageName = `${folderName}_${String(index).padStart(2, '0')}.jpg`;

    // Clean up the temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error cleaning up file after processing:', err);
    }

    // Return the processed image
    res.status(200).json({
      filename: imageName,
      resizedBuffer: resizedBuffer.toString('base64'),
    });
  } catch (error) {
    console.error('Error processing image:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up temporary file if it exists and hasn't been cleaned up yet
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error cleaning up file after error:', err);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to process image', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}
