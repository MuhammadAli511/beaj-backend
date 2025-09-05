import { google } from "googleapis"


const sheets = google.sheets("v4")





const authSheet = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
})

const authSheetClient = await authSheet.getClient()

