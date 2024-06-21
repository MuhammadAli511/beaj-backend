import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

dotenv.config();


async function uploadToBlobStorage(fileBuffer) {
    try {
        const newFileName = fileBuffer.originalname;
        const containerName = "beajdocuments";
        const azureBlobConnectionString = process.env.azure_blob_connection_string;
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureBlobConnectionString);
        const timestamp = format(new Date(), 'yyyyMMddHHmmssSSS');
        const uniqueID = uuidv4();
        const filename = `${timestamp}-${uniqueID}-${newFileName}`;

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(filename);
        const blockBlobClient = blobClient.getBlockBlobClient();

        await blockBlobClient.upload(fileBuffer.buffer, fileBuffer.size, {
            blobHTTPHeaders: { blobContentType: "application/octet-stream" }
        });

        return `https://${blobServiceClient.accountName}.blob.core.windows.net/${containerName}/${filename}`;
    } catch (ex) {
        console.error(`uploadToBlobStorage: ${ex.message}`);
        throw new Error('Failed to upload to Blob Storage');
    }
}

async function deleteFromBlobStorage(fileUrl) {
    try {
        const azureBlobConnectionString = process.env.azure_blob_connection_string;
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

export default { uploadToBlobStorage, deleteFromBlobStorage };