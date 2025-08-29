// netlify/functions/submit-specs.js

const { google } = require('googleapis');
const busboy = require('busboy');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const bb = busboy({ headers: event.headers });

        const fields = {};
        const fileUploadPromise = new Promise((resolve, reject) => {
            bb.on('file', (fieldname, file, filename) => {
                const chunks = [];
                file.on('data', (data) => {
                    chunks.push(data);
                });
                file.on('end', () => {
                    fields[fieldname] = {
                        filename: filename.filename,
                        content: Buffer.concat(chunks).toString('utf8'),
                    };
                });
            });
            bb.on('field', (fieldname, value) => {
                fields[fieldname] = value;
            });
            bb.on('close', () => resolve(fields));
            bb.on('error', (err) => reject(err));
            bb.end(Buffer.from(event.body, 'base64'));
        });

        const formData = await fileUploadPromise;

        // Extract all the new form data
        const firstName = formData['first-name'];
        const lastName = formData['last-name'];
        const city = formData['city'];
        const state = formData['state'];
        const email = formData['email'];
        const os = formData['os'];
        const internet = formData['internet'];
        const networkCable = formData['network-cable'];
        const accessModemRouter = formData['access-modem-router'];
        const micWebcam = formData['mic-webcam'];
        const userPrompt = formData['user-prompt'];
        const uploadedFile = formData['file-input'];

        // --- GOOGLE API AUTHENTICATION ---
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
        });
        const drive = google.drive({ version: 'v3', auth });
        const sheets = google.sheets({ version: 'v4', auth });

        // --- UPLOAD FILE TO GOOGLE DRIVE ---
        const fileMetadata = {
            name: uploadedFile.filename,
            parents: ['YOUR_DRIVE_FOLDER_ID'], 
        };
        const media = {
            mimeType: 'text/plain',
            body: uploadedFile.content,
        };
        await drive.files.create({
            resource: fileMetadata,
            media,
            fields: 'id',
        });

        // --- LOG DATA TO GOOGLE SHEETS ---
        const sheetId = 'YOUR_GOOGLE_SHEET_ID';
        const sheetName = 'Sheet1';
        const values = [
            [
                new Date().toISOString(), 
                firstName, 
                lastName, 
                city, 
                state, 
                email, 
                os,
                internet,
                networkCable,
                accessModemRouter,
                micWebcam,
                uploadedFile.filename,
                userPrompt
            ],
        ];
        const resource = { values };
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Data submitted successfully!' }),
        };

    } catch (error) {
        console.error('Error submitting data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'An error occurred during submission.' }),
        };
    }
};