const { google } = require('googleapis');
const Store = require('electron-store');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { shell } = require('electron');
const crypto = require('crypto');
const { Readable } = require('stream');

const store = new Store();

// Credentials (loaded from .env)
const CREDENTIALS = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    project_id: process.env.GOOGLE_PROJECT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: ["http://localhost"]
};

class GoogleDriveService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            CREDENTIALS.client_id,
            CREDENTIALS.client_secret,
            'http://localhost'
        );

        const tokens = store.get('google_tokens');
        if (tokens) {
            this.oauth2Client.setCredentials(tokens);
        }
    }

    async ensureAuth() {
        const tokens = store.get('google_tokens');
        if (!tokens) {
            console.log('Google Service: No tokens found. Starting Auth...');
            await this.authenticate();
        }
    }

    authenticate() {
        return new Promise((resolve, reject) => {
            const state = crypto.randomBytes(32).toString('hex');

            const server = http.createServer(async (req, res) => {
                try {
                    if (req.url.includes('favicon.ico')) { res.writeHead(204); res.end(); return; }

                    const { port } = server.address();
                    const requestUrl = new url.URL(req.url, `http://localhost:${port}`);
                    const code = requestUrl.searchParams.get('code');
                    const receivedState = requestUrl.searchParams.get('state');
                    const error = requestUrl.searchParams.get('error');

                    if (error) {
                        res.end(`Authentication failed: ${error}`);
                        shutdown();
                        reject(new Error(error));
                        return;
                    }

                    if (code) {
                        if (receivedState !== state) {
                            res.end('Security Error: State mismatch');
                            shutdown();
                            reject(new Error('State mismatch'));
                            return;
                        }

                        res.end('<h1>Autenticacion Exitosa</h1><p>Puedes cerrar esta ventana.</p><script>window.close()</script>');

                        const { tokens } = await this.oauth2Client.getToken(code);
                        this.oauth2Client.setCredentials(tokens);
                        store.set('google_tokens', tokens);

                        console.log('Google Auth Success.');
                        shutdown();
                        resolve();
                    }
                } catch (e) {
                    if (!res.writableEnded) res.end('Authentication error: ' + e.message);
                    shutdown();
                    reject(e);
                }
            });

            const sockets = new Set();
            server.on('connection', (socket) => {
                sockets.add(socket);
                socket.on('close', () => sockets.delete(socket));
            });

            const shutdown = () => {
                server.close();
                for (const socket of sockets) {
                    socket.destroy();
                }
            };

            server.listen(0, '127.0.0.1', () => {
                const { port } = server.address();
                const localRedirect = `http://localhost:${port}`;
                this.oauth2Client.redirectUri = localRedirect;

                const authorizeUrl = this.oauth2Client.generateAuthUrl({
                    access_type: 'offline',
                    prompt: 'consent',
                    scope: ['https://www.googleapis.com/auth/drive.file'],
                    state: state,
                    redirect_uri: localRedirect
                });

                console.log(`Google Auth: Listening on port ${port}. URL generated.`);
                shell.openExternal(authorizeUrl);
            });

            server.on('error', (err) => reject(err));
        });
    }

    async getOrCreateFolder(parentFolderId, folderName, shareWithEmail = null) {
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        const safeName = folderName.replace(/'/g, "\\'");

        let query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
        if (parentFolderId) query += ` and '${parentFolderId}' in parents`;

        const res = await drive.files.list({ q: query, fields: 'files(id, name)', spaces: 'drive' });

        let folderId;
        if (res.data.files.length > 0) {
            folderId = res.data.files[0].id; // Existing
        } else {
            const folder = await drive.files.create({
                resource: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: parentFolderId ? [parentFolderId] : []
                },
                fields: 'id'
            });
            folderId = folder.data.id;
        }

        // FOLDER SHARING LOGIC
        if (shareWithEmail && shareWithEmail.includes('@')) {
            try {
                await drive.permissions.create({
                    fileId: folderId,
                    requestBody: { role: 'reader', type: 'user', emailAddress: shareWithEmail }
                });
                console.log(`✅ Carpeta "${folderName}" compartida con ${shareWithEmail}`);
            } catch (e) {
                // Ignore "already exists" error to avoid spam
                if (!e.message.includes('already exists')) {
                    console.log(`⚠️ Aviso: No se pudo compartir carpeta (quizás ya lo está): ${e.message}`);
                }
            }
        }

        return folderId;
    }

    async uploadFile(buffer, fileName, customerName, customerEmail, mesocycleName) {
        await this.ensureAuth();

        // 1. Root
        const rootId = await this.getOrCreateFolder(null, 'GIMNASIO');

        // 2. Customer (SHARE FOLDER HERE)
        const safeCust = (customerName || 'Cliente').trim();
        const custId = await this.getOrCreateFolder(rootId, safeCust, customerEmail);

        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        // 3. DUPLICATE CHECK
        const safeFileName = fileName.replace(/'/g, "\\'");
        const existing = await drive.files.list({
            q: `name='${safeFileName}' and '${custId}' in parents and trashed=false`,
            fields: 'files(id, webViewLink, webContentLink)',
        });

        if (existing.data.files.length > 0) {
            console.log(`♻️ Archivo duplicado detectado: ${fileName}. Usando existente.`);
            return existing.data.files[0].webViewLink;
        }

        // 4. Upload New
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        const media = {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: bufferStream
        };

        const file = await drive.files.create({
            resource: { name: fileName, parents: [custId] },
            media: media,
            fields: 'id, webViewLink, webContentLink'
        });

        // 5. File Permission (Fallback: Anyone with link)
        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        });

        // Also explicitly share file if requested (redundant if folder shared, but ensures notification)
        if (customerEmail && customerEmail.includes('@')) {
            try {
                await drive.permissions.create({
                    fileId: file.data.id,
                    requestBody: { role: 'reader', type: 'user', emailAddress: customerEmail }
                });
            } catch (e) { }
        }

        return file.data.webViewLink;
    }

    async checkFileExistsFromUrl(url) {
        if (!url) return false;
        // Extract ID from URL
        // Matches /d/ID or id=ID
        const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
        if (!idMatch) return false;

        const fileId = idMatch[1];
        await this.ensureAuth();
        const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        try {
            await drive.files.get({ fileId: fileId, fields: 'id, trashed' });
            return true;
        } catch (e) {
            // 404 means it's gone
            if (e.code === 404 || (e.message && e.message.includes('not found'))) {
                return false;
            }
            // For other errors (network), return true to avoid accidental deletion
            console.log('Verification warning:', e.message);
            return true;
        }
    }
}

module.exports = new GoogleDriveService();
