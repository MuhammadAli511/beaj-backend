import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

dotenv.config();

async function uploadImageToBlobStorage(imageBuffer, imageName = 'output-score.jpg') {
    try {
        const containerName = "beajdocuments";
        const azureBlobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlobConnectionString);

        // Create a unique filename with a timestamp and UUID
        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
        const uniqueID = uuidv4();
        const filename = `${timestamp}-${uniqueID}-${imageName}`;

        // Get container and blob clients
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(filename);
        const blockBlobClient = blobClient.getBlockBlobClient();

        // Upload the image buffer to Blob Storage with appropriate headers
        await blockBlobClient.upload(imageBuffer, imageBuffer.byteLength, {
            blobHTTPHeaders: { blobContentType: 'image/jpeg' }
        });

        // Return the URL of the uploaded image
        return `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${filename}`;
    } catch (ex) {
        console.error(`uploadImageToBlobStorage: ${ex.message}`);
        throw new Error('Failed to upload image to Blob Storage');
    }
}


async function uploadToBlobStorage(exact_file, originalName = null) {
    try {
        let newFileName = originalName;
        if (!newFileName) {
            newFileName = exact_file.originalname;
        }
        const containerName = "beajdocuments";
        const azureBlobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlobConnectionString);
        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
        const uniqueID = uuidv4();
        const filename = `${timestamp}-${uniqueID}-${newFileName}`;

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(filename);
        const blockBlobClient = blobClient.getBlockBlobClient();

        if (originalName) {
            await blockBlobClient.upload(exact_file, exact_file.length, {
                blobHTTPHeaders: { blobContentType: "audio/ogg" },
            });
        } else {
            await blockBlobClient.upload(exact_file.buffer, exact_file.size, {
                blobHTTPHeaders: { blobContentType: exact_file.mimetype }
            });
        }

        return `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${filename}`;
    } catch (ex) {
        console.error(`uploadToBlobStorage: ${ex.message}`);
        throw new Error('Failed to upload to Blob Storage');
    }
}

async function deleteFromBlobStorage(fileUrl) {
    try {
        const azureBlobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlobConnectionString);
        const baseUrl = "https://beajbloblive.blob.core.windows.net/beajdocuments/";
        const fileName = fileUrl.substring(baseUrl.length);

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(fileName);

        await blobClient.delete();
    } catch (ex) {
        console.error(`deleteFromBlobStorage: ${ex.message}`);
        throw new Error('Failed to delete from Blob Storage');
    }
}

export default { uploadToBlobStorage, deleteFromBlobStorage, uploadImageToBlobStorage };