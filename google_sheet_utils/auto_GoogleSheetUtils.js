import { google } from "googleapis";
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { PassThrough } from "stream";

const creds = JSON.parse(
  await readFile(new URL('../my_cred.json', import.meta.url), 'utf-8')
);

const sheets = google.sheets("v4");

// Retry logic for API calls
const retryOperation = async (operation, maxRetries = 5, initialDelay = 1000) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      const delay = initialDelay * Math.pow(2, retries);
      console.log(`API error. Retrying in ${delay}ms...`);
      console.log(`Error details: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
      
      if (retries >= maxRetries) {
        throw error;
      }
    }
  }
};

const new_loadDataToGoogleSheets = async (
  arrayLevels_List,
  facilitator,
  modules,
  edit_flag,
  ActivityCompletedCount,
  last_activityCompleted_l1,
  last_activityCompleted_l2,
  last_activityCompleted_l3,
  module_week,
) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    const authClient = await auth.getClient();
    const spreadsheetId = "1wAzQ21EL9ELMK-Isb9_jGnpM7RcneYvqt0UD0GAhS1U";

    if(edit_flag == 1){

      console.log("Clearing existing data...");
      await retryOperation(() => 
        sheets.spreadsheets.values.update({
          auth: authClient,
          spreadsheetId,
          range: `Facilitator ${facilitator}!A1`,
          valueInputOption: "RAW",
          resource: {
            values: [["Fetching..."]],
          },
        })
      );

      const spreadsheet = await retryOperation(() => 
        sheets.spreadsheets.get({
          auth: authClient,
          spreadsheetId
        })
      );
      
      const targetSheet = spreadsheet.data.sheets.find(
        sheet => sheet.properties.title === `Facilitator ${facilitator}`
      );
      
      if (!targetSheet) {
        throw new Error(`Sheet "Facilitator ${facilitator}" not found`);
      }
      
      const sheetId = targetSheet.properties.sheetId;
      
      // Reset font color to black for range D3:S55
      await retryOperation(() => 
        sheets.spreadsheets.batchUpdate({
          auth: authClient,
          spreadsheetId,
          resource: {
            requests: [
              {
                updateCells: {
                  range: {
                    sheetId: sheetId,
                    startRowIndex: 2,  // 0-based index for row 3
                    endRowIndex: 55,   // 0-based index for row 55
                    startColumnIndex: 3, // 0-based index for column D
                    endColumnIndex: 19  // 0-based index for column S
                  },
                  rows: [{
                    values: [{
                      userEnteredFormat: {
                        textFormat: {
                          foregroundColor: {
                            red: 0,
                            green: 0,
                            blue: 0
                          }
                        }
                      }
                    }]
                  }],
                  fields: "userEnteredFormat.textFormat.foregroundColor"
                }
              }
            ]
          }
        })
      );

      const resource_clear = {
        ranges: [
            `Facilitator ${facilitator}!A3:AD55`, 
            `Facilitator ${facilitator}!T1:AD2`, 
            `Facilitator ${facilitator}!AV15:BA100`, 
            `Facilitator ${facilitator}!W58`,
        ],
      };

      await retryOperation(() => 
        sheets.spreadsheets.values.batchClear({
          auth: authClient,
          spreadsheetId,
          resource: resource_clear,
        })
      );
      await deleteImagesFromSheet(facilitator);
    }
    
    if(edit_flag == 2){
      console.log("Writing data to sheets...");

      // First, write the array levels data
      await retryOperation(() => 
        sheets.spreadsheets.values.update({
          auth: authClient,
          spreadsheetId,
          range: `Facilitator ${facilitator}!A3:S`,
          valueInputOption: "RAW",
          resource: {
            values: arrayLevels_List,
          },
        })
      );
      let resource_level_list = {} ;
     if(module_week == "Week"){
       // Then write the other data
       resource_level_list = {
        valueInputOption: "RAW",
        data: [
          {
            range: `Facilitator ${facilitator}!T1`,
            values: ActivityCompletedCount,
          },
          {
            range: `Facilitator ${facilitator}!A1`,
            values: [[modules]],
          },
          {
            range: `Facilitator ${facilitator}!AV15:AW`,
            values: last_activityCompleted_l1,
          },
          {
            range: `Facilitator ${facilitator}!AX15:AY`,
            values: last_activityCompleted_l2,
          },
          {
            range: `Facilitator ${facilitator}!AZ15:BA`,
            values: last_activityCompleted_l3,
          },
        ],
      };
     }
     else{
      // Then write the other data
      resource_level_list = {
        valueInputOption: "RAW",
        data: [
          {
          range: `Facilitator ${facilitator}!A3:S`,
          values: arrayLevels_List,
          },
          {
            range: `Facilitator ${facilitator}!T1`,
            values: ActivityCompletedCount,
          },
          {
            range: `Facilitator ${facilitator}!AV15:AW`,
            values: last_activityCompleted_l1,
          },
          {
            range: `Facilitator ${facilitator}!AX15:AY`,
            values: last_activityCompleted_l2,
          },
          {
            range: `Facilitator ${facilitator}!AZ15:BA`,
            values: last_activityCompleted_l3,
          },
          {
            range: `Facilitator ${facilitator}!A1`,
            values: [[modules]],
          },
        ],
      };
    }

      if(module_week == "Week"){
        console.log("Formatting top three values...");
        await formatTopThreeInColumns(arrayLevels_List, facilitator);
         
        let columnIndex = await  getColumnIndexWithPercentageValues(arrayLevels_List, 2);
        await generateStarTeachersImage(arrayLevels_List, columnIndex, 'D:/Beaj/new_code',facilitator);
      }
      await retryOperation(() => 
        sheets.spreadsheets.values.batchUpdate({
          auth: authClient,
          spreadsheetId,
          resource: resource_level_list, 
        })
      );
     
      console.log("Data upload complete.");
    }

  } catch (error) {
    console.error("Error in loadDataToGoogleSheets:", error);
    error.fileName = "googleSheetUtils.js";
    throw error; // Re-throw so caller knows there was an error
  }
};

const formatTopThreeInColumns = async (arrayLevels_List, facilitator) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    const authClient = await auth.getClient();
    const spreadsheetId = "1wAzQ21EL9ELMK-Isb9_jGnpM7RcneYvqt0UD0GAhS1U";

    // Get spreadsheet info
    const spreadsheet = await retryOperation(() => 
      sheets.spreadsheets.get({
        auth: authClient,
        spreadsheetId,
      })
    );

    // Find sheet ID
    const targetSheetName = `Facilitator ${facilitator}`;
    const targetSheet = spreadsheet.data.sheets.find(
      sheet => sheet.properties.title === targetSheetName
    );

    if (!targetSheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }

    const sheetId = targetSheet.properties.sheetId;

    const columnIndexes = [3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16]; // Columns with percentages
    const startRow = 3;
    let allRequests = [];

    // Process each percentage column
    for (const colIndex of columnIndexes) {
      // Get top three values for this column
      const topValues = getTopThreeValues(arrayLevels_List, colIndex);
      
      if (topValues.length === 0) continue;

      console.log(`Column ${colIndex} top values:`, topValues);

      // Colors for top three values
      const colors = [
        { red: 1, green: 0.843, blue: 0 },     // Gold - 1st place
        { red: 153/255, green: 153/255, blue: 153/255 },  //silver
        { red: 0.804, green: 0.498, blue: 0.196 }  // Bronze - 3rd place
      ];

     // Create requests for formatting each value in the column
      arrayLevels_List.forEach((row, rowIndex) => {
        if (row[colIndex] && row[colIndex] !== 'null') {
          const percentStr = String(row[colIndex]);
          const percentValue = parseInt(percentStr.replace('%', ''), 10);
          
          if (!isNaN(percentValue)) {
            // Check if this value is in top 3
            const valueRank = topValues.indexOf(percentValue);
            
            if (valueRank >= 0 && valueRank < 3) {
              // This is a top 3 value, format it with the appropriate color
              allRequests.push({
                updateCells: {
                  range: {
                    sheetId: sheetId,
                    startRowIndex: startRow + rowIndex - 1,
                    endRowIndex: startRow + rowIndex,
                    startColumnIndex: colIndex,
                    endColumnIndex: colIndex + 1
                  },
                  rows: [{
                    values: [{
                      userEnteredFormat: {
                        textFormat: {
                          foregroundColor: colors[valueRank]
                        }
                      }
                    }]
                  }],
                  fields: "userEnteredFormat.textFormat.foregroundColor"
                }
              });
            }
          }
        }
      });
    }

    // Apply formatting in chunks to avoid quota limits
    const chunkSize = 10;
    console.log(`Processing ${allRequests.length} formatting requests in chunks of ${chunkSize}`);
    
    for (let i = 0; i < allRequests.length; i += chunkSize) {
      const chunk = allRequests.slice(i, i + chunkSize);
      console.log(`Processing chunk ${i/chunkSize + 1} of ${Math.ceil(allRequests.length/chunkSize)}`);
      
      await retryOperation(() => 
        sheets.spreadsheets.batchUpdate({
          auth: authClient,
          spreadsheetId,
          resource: {
            requests: chunk
          }
        })
      );
      
      // Add delay between chunks
      if (i + chunkSize < allRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log("Formatting complete");
  } catch (error) {
    console.error("Error in formatTopThreeInColumns:", error);
    throw error;
  }
};

// Updated function to get top three values from a column
const getTopThreeValues = (data, columnIndex) => {
  // Extract values from the specified column, handling rounded percentages
  const columnValues = data.map(row => {
    if (row[columnIndex] && row[columnIndex] !== 'null') {
      const percentStr = String(row[columnIndex]);
      // Extract the number part and convert to integer
      const percentValue = parseInt(percentStr.replace('%', ''), 10);
      return isNaN(percentValue) ? null : percentValue;
    }
    return null;
  }).filter(val => val !== null);

  // Get unique values, sort in descending order, and take top 3
  const uniqueValues = [...new Set(columnValues)].sort((a, b) => b - a);
  return uniqueValues.slice(0, 3);
};


const generateStarTeachersImage = async (arrayLevels_List, columnIndex, imagePath,facilitator) => {
  try {
    console.log("Generating star teachers image...");
    
    // Use absolute paths instead of path.join
    const templatePath = `${imagePath}/input.png`;
    const outputPath = `${imagePath}/output.png`;
    
    console.log(`Looking for template at: ${templatePath}`);
    
    // Check if input image exists
    if (!fs.existsSync(templatePath)) {
      console.error(`Template image not found at path: ${templatePath}`);
      return null;
    }

    // Check if output directory exists and is writable
    const outputDir = imagePath;
    if (!fs.existsSync(outputDir)) {
      console.error(`Output directory does not exist: ${outputDir}`);
      return null;
    }

    if (!fs.statSync(outputDir).isDirectory()) {
      console.error(`Output path is not a directory: ${outputDir}`);
      return null;
    }
    
    // Get top three performers and their scores from the specified column
    const topPerformers = getTopPerformersWithNames(arrayLevels_List, columnIndex);
    console.log("Top performers:", JSON.stringify(topPerformers, null, 2));
    
    if (topPerformers.length === 0) {
      console.log("No performers found for this column");
      return null;
    }
    
    // Load template image
    console.log("Loading template image...");
    const image = await loadImage(templatePath);
    console.log(`Image loaded with dimensions: ${image.width}x${image.height}`);
    
    // Create canvas with same dimensions as template
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw template on canvas
    ctx.drawImage(image, 0, 0, image.width, image.height);
    
    // Position parameters (adjust based on your template)
    const positions = [
      { scoreX: 345, scoreY: 367, nameX: 345, nameY: 485 }, // Gold (1st)
      { scoreX: 493, scoreY: 367, nameX: 493, nameY: 485 }, // Silver (2nd)
      { scoreX: 196, scoreY: 367, nameX: 196, nameY: 485 }  // Bronze (3rd)
    ];
    
    // Draw scores and names
    for (let i = 0; i < Math.min(topPerformers.length, 3); i++) {
      // Draw score
      ctx.fillStyle = '#003399';
      ctx.font = '900 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const scoreText = `${topPerformers[i].score}%`;
      ctx.fillText(scoreText, positions[i].scoreX, positions[i].scoreY);
      console.log(`Drew score ${scoreText} at ${positions[i].scoreX},${positions[i].scoreY}`);
      
      // Draw names
      ctx.font = '900 18px Arial, sans-serif';
      const names = topPerformers[i].names;
      
      if (names.length === 1) {
        // Single name
        ctx.fillText(names[0], positions[i].nameX, positions[i].nameY);
        console.log(`Drew name ${names[0]} at ${positions[i].nameX},${positions[i].nameY}`);
      } else {
        // Multiple names
        const lineHeight = 24;
        const startY = positions[i].nameY - ((names.length - 1) * lineHeight / 2);
        
        names.forEach((name, idx) => {
          ctx.fillText(name, positions[i].nameX, startY + idx * lineHeight);
          console.log(`Drew name ${name} at ${positions[i].nameX},${startY + idx * lineHeight}`);
        });
      }
    }
    
    // Save image
    console.log(`Saving image to ${outputPath}...`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Star teachers image saved to ${outputPath}`);
    uploadImageToCell(buffer, facilitator, 'W58');
    return outputPath;
  } catch (error) {
    console.error("Error generating star teachers image:", error);
    console.error(error.stack);
    return null;
  }
};

// Updated helper function to get top performers with their names
const getTopPerformersWithNames = (data, columnIndex) => {
  // Create a map to store score -> names mapping
  const scoreToNames = new Map();
  
  // Process each row to extract score and name
  data.forEach(row => {
    if (row[columnIndex] && row[columnIndex] !== 'null') {
      const percentStr = String(row[columnIndex]);
      // Extract the number part and convert to integer
      const percentValue = parseInt(percentStr.replace('%', ''), 10);
      const name = row[2]; // Assuming name is in the 3rd column (index 2)
      
      if (!isNaN(percentValue) && name) {
        if (!scoreToNames.has(percentValue)) {
          scoreToNames.set(percentValue, []);
        }
        scoreToNames.get(percentValue).push('• ' + name);
      }
    }
  });
  
  // Convert map to array and sort by score (descending)
  const sortedScores = [...scoreToNames.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .map(([score, names]) => ({
      score: score.toString(), // No need for toFixed since it's already an integer
      names: names
    }));
  
  return sortedScores;
};

// Updated column index finder function
const getColumnIndexWithPercentageValues = (arrayLevels_List, minValues = 2) => {
  if (!arrayLevels_List || arrayLevels_List.length === 0) {
    throw new Error("arrayLevels_List is empty or undefined");
  }

  // Predefined list of column indexes to check
  const columnIndexes = [3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16];

  // Iterate through the column indexes in reverse order
  for (let i = columnIndexes.length - 1; i >= 0; i--) {
    const col = columnIndexes[i];
    let count = 0;

    // Count percentage values in the current column
    for (let row = 0; row < arrayLevels_List.length; row++) {
      if (
        arrayLevels_List[row][col] &&
        typeof arrayLevels_List[row][col] === "string" &&
        arrayLevels_List[row][col].includes("%")
      ) {
        count++;
      }
    }

    // If the column has at least minValues percentage values, return it
    if (count >= minValues) {
      return col;
    }
  }

  throw new Error(`No column found with at least ${minValues} percentage values`);
};

const deleteImagesFromSheet = async (facilitator) => {
  try {
    console.log(`Deleting images from sheet for facilitator ${facilitator}...`);
    
    // Import fetch if not already available
    const fetch = (await import('node-fetch')).default;
    
    // Your deployed Apps Script URL - replace with your actual URL
    const appsScriptUrl = 'https://script.google.com/macros/s/AKfycby2Ob7DGUVF4qSVXv7rXreGweikZVI4UfqbaGr4jV1YOnA27AeeYYLR9y7wxV9D9w/exec';
    
    // Build the request URL with proper encoding of the sheet name
    const deleteImagesUrl = `${appsScriptUrl}?action=deleteImages&sheetName=${encodeURIComponent('Facilitator ' + facilitator)}`;
    
    console.log(`Calling Apps Script: ${deleteImagesUrl}`);
    
    // Make the request
    const response = await fetch(deleteImagesUrl, { 
      method: 'GET',
      timeout: 30000 // 30 second timeout
    });
    
    // Parse the response
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Apps Script error: ${result.message || 'Unknown error'}`);
    }
    
    console.log(`Images deleted successfully: ${result.message}`);
    return true;
    
  } catch (error) {
    console.error(`Error deleting images for facilitator ${facilitator}:`, error);
    return false;
  }
};

const uploadImageToCell = async (imageBuffer, facilitator, cellReference) => {
  // Create a temporary file path
  const tempFilePath = path.join(process.cwd(), `temp_${facilitator}_${Date.now()}.png`);
  
  try {
    console.log(`Starting image upload for facilitator ${facilitator} to cell ${cellReference}...`);
    
    // Save buffer to temp file
    fs.writeFileSync(tempFilePath, imageBuffer);
    console.log(`Temporary file saved: ${tempFilePath}`);
    
    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
    
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    // Upload to Google Drive
    console.log("Uploading image to Google Drive...");
    const fileMetadata = {
      name: `StarTeachers_${facilitator}_${Date.now()}.png`,
      mimeType: 'image/png'
    };
    
    let driveResponse;
    try {
      // Upload using file stream
      const media = {
        mimeType: 'image/png',
        body: fs.createReadStream(tempFilePath)
      };
      
      driveResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
      });
    } catch (uploadError) {
      console.error("Error during Drive upload:", uploadError.message);
      
      // Alternative upload method if streaming fails
      const fileContent = fs.readFileSync(tempFilePath);
      
      driveResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: 'image/png',
          body: fileContent
        },
        fields: 'id'
      });
    }
    
    const fileId = driveResponse.data.id;
    console.log(`Image uploaded to Drive with ID: ${fileId}`);
    
    // Make the file public
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    // Call Apps Script web app to insert the image
    // Replace with your actual deployed script URL
    const appsScriptUrl = 'https://script.google.com/macros/s/AKfycby2Ob7DGUVF4qSVXv7rXreGweikZVI4UfqbaGr4jV1YOnA27AeeYYLR9y7wxV9D9w/exec';
    
    const fetch = (await import('node-fetch')).default;
    console.log(`Calling Apps Script to insert image at cell ${cellReference}...`);
    
    // Use POST with URL encoded form data
    const formData = new URLSearchParams();
    formData.append('sheetName', `Facilitator ${facilitator}`);
    formData.append('cell', cellReference);
    formData.append('imageId', fileId);
    
    const scriptResponse = await fetch(appsScriptUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const responseText = await scriptResponse.text();
    console.log(`Apps Script response: ${responseText}`);
    
    // Wait a bit to ensure the image is inserted
    console.log("Waiting for image to be processed...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Delete the Drive file
    console.log("Deleting file from Drive...");
    await drive.files.delete({
      fileId: fileId
    });
    
    console.log("File deleted from Drive");
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    console.log("Temporary file deleted");
    
    return true;
    
  } catch (error) {
    console.error("Error in uploadImageToCell:", error);
    
    // Clean up temp file if exists
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("Temporary file cleaned up after error");
      } catch (unlinkError) {
        console.error("Error cleaning up temporary file:", unlinkError);
      }
    }
    
    return false;
  }
};

export default new_loadDataToGoogleSheets;