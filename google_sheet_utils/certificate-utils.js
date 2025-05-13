import { google } from "googleapis";
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const SPREADSHEET_ID = '1Nat0B3coOFoIeF_aO-vY-KHuqQxtjLYKx5lNPFBJndg';
const SHEET_NAME = 'Certificate Tracker';
const CERTIFICATE_TEMPLATE_PATH = path.join(__dirname, 'certificate.png');
const MAIN_DRIVE_FOLDER = 'Teacher Self Development - Certificates';


async function checkFolderStructure() {
  try {
    // Load credentials
    const creds = JSON.parse(
      await readFile(new URL('../cert_cred.json', import.meta.url), 'utf-8')
    );

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Improved folder finder with exact parent matching
    const findExactFolder = async (folderName, parentId = null) => {
      let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
      if (parentId) query += ` and '${parentId}' in parents`;

      const res = await drive.files.list({
        q: query,
        fields: 'files(id, name, parents)',
        spaces: 'drive'
      });

      // Exact match - must have correct parent (if specified)
      const exactMatch = res.data.files.find(f => {
        const hasCorrectParent = !parentId || (f.parents && f.parents.includes(parentId));
        return hasCorrectParent && f.name === folderName;
      });

      return exactMatch?.id || null;
    };

    // Atomic folder creation with verification
    const ensureFolderExists = async (folderName, parentId = null) => {
      // First try to find exact match
      const existingId = await findExactFolder(folderName, parentId);
      if (existingId) return existingId;

      // If not found, create with collision handling
      try {
        const folder = await drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : []
          },
          fields: 'id'
        });
        console.log(`Created folder: ${folderName}`);
        return folder.data.id;
      } catch (error) {
        if (error.errors?.some(e => e.reason === 'duplicate')) {
          // If creation failed due to duplicate, try finding again
          const foundId = await findExactFolder(folderName, parentId);
          if (foundId) {
            console.log(`Folder already exists (race condition handled): ${folderName}`);
            return foundId;
          }
        }
        throw error;
      }
    };

    console.log('Verifying folder structure...');

    // 1. Main folder
    const mainFolderId = await ensureFolderExists('Teacher Self Development - Certificates');

    // 2. T1/T2 folders
    const [t1Id, t2Id] = await Promise.all([
      ensureFolderExists('T1', mainFolderId),
      ensureFolderExists('T2', mainFolderId)
    ]);

    // 3. Cohort folders (processed in batches)
    const createCohorts = async (prefix, start, end, parentId) => {
      const promises = [];
      for (let i = start; i <= end; i++) {
        promises.push(ensureFolderExists(`${prefix} ${i}`, parentId));
      }
      await Promise.all(promises);
    };

    await Promise.all([
      createCohorts('Cohort', 1, 20, t1Id),
      createCohorts('Cohort', 25, 44, t2Id)
    ]);

    console.log('Folder structure verified successfully');
    return true;

  } catch (error) {
    console.error('Folder structure verification failed:', error);
    throw error;
  }
}

// Export the function
export { checkFolderStructure };

const generateCertificate = async (name) => {
  try {
    console.log(`Generating certificate for ${name}...`);

    // Check if template exists
    if (!fs.existsSync(CERTIFICATE_TEMPLATE_PATH)) {
      throw new Error(`Certificate template not found at: ${CERTIFICATE_TEMPLATE_PATH}`);
    }

    // Load the certificate template
    const image = await loadImage(CERTIFICATE_TEMPLATE_PATH);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw template on canvas
    ctx.drawImage(image, 0, 0, image.width, image.height);

    // Configure text style for the name
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'Bold 20.1px Arial, Sans-serif';

    // Position for the name (centered)
    const nameX = image.width / 2;
    const nameY = image.height / 2 - 30;

    // Draw the name
    ctx.fillText(name.toUpperCase(), nameX, nameY);

    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`Certificate generated successfully for ${name}`);
    return buffer;
  } catch (error) {
    console.error("Error generating certificate:", error);
    throw error;
  }
};


const findFolder = async (drive, folderName, parentFolderId = null) => {
  try {
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentFolderId) query += ` and '${parentFolderId}' in parents`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    return response.data.files?.[0]?.id || null;
  } catch (error) {
    console.error(`Error finding folder ${folderName}:`, error);
    throw error;
  }
};



const uploadCertificateToDrive = async (buffer, name, cohort, targetGrp) => {
  try {
    console.log(`Uploading certificate for ${name} to Drive (${targetGrp}/${cohort})...`);

    // Load credentials
    const creds = JSON.parse(
      await readFile(new URL('../cert_cred.json', import.meta.url), 'utf-8')
    );

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Find the main certificates folder
    const mainFolderId = await findFolder(drive, MAIN_DRIVE_FOLDER);
    if (!mainFolderId) throw new Error(`Main folder "${MAIN_DRIVE_FOLDER}" not found`);

    // Find target group folder within main folder
    const targetGroupFolder = await findFolder(drive, targetGrp, mainFolderId);
    if (!targetGroupFolder) throw new Error(`Target group folder "${targetGrp}" not found`);

    // Find cohort folder within target group
    const cohortFolder = await findFolder(drive, cohort, targetGroupFolder);
    if (!cohortFolder) throw new Error(`Cohort folder "${cohort}" not found`);

    // Format name and create filename
    name = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const fileName = `${safeName}_Certificate_${timestamp}.png`;

    // Convert buffer to stream
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null); // Signals end of stream

    // Upload to Drive
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [cohortFolder],
        mimeType: 'image/png'
      },
      media: {
        mimeType: 'image/png',
        body: bufferStream
      },
      fields: 'id, webViewLink'
    });

    const fileId = uploadResponse.data.id;
    const viewLink = uploadResponse.data.webViewLink;

    // Make file publicly viewable
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    console.log(`Certificate uploaded successfully. File ID: ${fileId}`);
    return { fileId, viewLink };

  } catch (error) {
    console.error("Error uploading certificate to Drive:", error);
    throw error;
  }
};

const processCertificate = async (name, cohort, targetGrp) => {
  try {
    const certificateBuffer = await generateCertificate(name);
    const driveInfo = await uploadCertificateToDrive(certificateBuffer, name, cohort, targetGrp);
    return {
      fileId: driveInfo.fileId,
      viewLink: driveInfo.viewLink
    };
  } catch (error) {
    console.error("Error processing certificate:", error);
    throw error;
  }
};


const initializeSheets = async () => {
  const creds = JSON.parse(
    await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
  );
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
};

const loadTrackingSheet = async (spreadsheetId, sheetName) => {
  try {
    const sheets = await initializeSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:C`, // Skip header row
    });

    const trackedStudents = new Set();
    const rows = response.data.values || [];

    for (const row of rows) {
      if (row[0]?.trim()) { // Phone number in column A
        trackedStudents.add(row[0].trim());
      }
    }

    console.log(`Loaded ${trackedStudents.size} students from tracking sheet`);
    return trackedStudents;
  } catch (error) {
    console.error(`Error loading tracking sheet: ${error.message}`);
    throw error;
  }
};

const updateTrackingSheet = async (spreadsheetId, sheetName, newStudents) => {
  try {
    const sheets = await initializeSheets();
    const rowsToAppend = newStudents.map(student => [student.phoneNumber, student.name, student.cohort]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A2:C`, // Append after last row
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rowsToAppend },
    });

    console.log(`Added ${newStudents.length} new entries to tracking sheet`);
  } catch (error) {
    console.error(`Error updating tracking sheet: ${error.message}`);
    throw error;
  }
};

const updateCohortInTrackingSheet = async (spreadsheetId, sheetName, phoneNumber, cohort) => {
  const sheets = await initializeSheets();
  // const sheets = google.sheets({ version: 'v4', auth }); // Make sure `auth` is correctly imported

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:A`, // Column A has phone numbers, assume header in row 1
  });

  const phoneList = res.data.values?.flat() || [];

  // Find the row number (add 2 for zero-based index + header row)
  const rowIndex = phoneList.findIndex(p => p.trim() === phoneNumber.trim());
  if (rowIndex === -1) {
    console.warn(`Phone number ${phoneNumber} not found in sheet to update cohort.`);
    return;
  }

  const rowNumber = rowIndex + 2;
  const cohortRange = `${sheetName}!C${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cohortRange,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[cohort]],
    },
  });

  console.log(`Updated cohort '${cohort}' for ${phoneNumber} at row ${rowNumber}`);
};


const generateCertificatesForEligibleStudents = async (
  studentData,
  callType = "cumulative",
  targetGroup = null,
  cohort = null
) => {
  try {
    await checkFolderStructure();
    console.log('Starting certificate generation process...');

    // Load existing phone numbers from tracking sheet
    const trackedStudents = await loadTrackingSheet(SPREADSHEET_ID, SHEET_NAME);

    const stats = {
      total: studentData.length,
      eligible: 0,
      alreadyGenerated: 0,
      newlyGenerated: 0,
      failed: 0,
      skipped: 0,
    };

    const newlyGeneratedStudents = [];

    for (const student of studentData) {
      try {
        const phoneNumber = student[1];
        const name = student[2];
        const week4Score = student[16]; // L3 Week 4 percentage

        // Determine cohort and target group
        const studentCohort = callType === "cumulative" ? student[18] : cohort;
        const studentTargetGroup = callType === "cumulative" ? student[19] : targetGroup;

        if (!week4Score || week4Score === 'null') {
          console.log(`Skipping ${name} - L3 Week 4 not completed`);
          stats.skipped++;
          continue;
        }

        stats.eligible++;

        if (trackedStudents.has(phoneNumber)) {
          await updateCohortInTrackingSheet(SPREADSHEET_ID, SHEET_NAME, phoneNumber, studentCohort);
          console.log(`Skipping ${name} - certificate already generated`);
          stats.alreadyGenerated++;

          continue;
        }

        // Generate and upload certificate
        console.log(`Processing certificate for ${name} (${phoneNumber})`);
        await processCertificate(name, studentCohort, studentTargetGroup);

        newlyGeneratedStudents.push({ phoneNumber, name , cohort: studentCohort });
        stats.newlyGenerated++;
      } catch (error) {
        console.error(`Error processing student: ${error.message}`);
        stats.failed++;
      }
    }

    // Update tracking sheet with new students
    if (newlyGeneratedStudents.length > 0) {
      await updateTrackingSheet(SPREADSHEET_ID, SHEET_NAME, newlyGeneratedStudents);
    }

    console.log('Certificate generation complete:');
    console.log(`- Total students: ${stats.total}`);
    console.log(`- Eligible students: ${stats.eligible}`);
    console.log(`- Already had certificates: ${stats.alreadyGenerated}`);
    console.log(`- New certificates generated: ${stats.newlyGenerated}`);
    console.log(`- Failed to generate: ${stats.failed}`);
    console.log(`- Skipped (not eligible): ${stats.skipped}`);

    return stats;
  } catch (error) {
    console.error(`Error in certificate generation process: ${error.message}`);
    throw error;
  }
};

export {
  generateCertificate,
  uploadCertificateToDrive,
  processCertificate,
  generateCertificatesForEligibleStudents
};