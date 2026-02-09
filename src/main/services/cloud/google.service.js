const { google } = require('googleapis');
const Store = require('electron-store');
const credentialManager = require('../../config/credentials');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { shell } = require('electron');
const crypto = require('crypto');
const { Readable } = require('stream');

const store = new Store({ name: 'google_data' });

class GoogleDriveService {
    constructor() {
        this.oauth2Client = null;
        this.credentials = null;
        this.isEnabled = false;

        try {
            // Load credentials from secure manager
            if (!credentialManager.isLoaded()) {
                console.warn('[GOOGLE_DRIVE] ⚠️ Credentials not loaded. Google Drive disabled.');
                return;
            }

            const creds = credentialManager.get();
            const { google: googleCreds } = creds;

            // Google Drive is optional - check if configured
            if (!googleCreds?.clientId || !googleCreds?.clientSecret) {
                console.log('[GOOGLE_DRIVE] ℹ️ Google OAuth not configured (optional feature)');
                return;
            }

            this.credentials = {
                client_id: googleCreds.clientId,
                project_id: googleCreds.projectId,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_secret: googleCreds.clientSecret,
                redirect_uris: ["http://localhost"]
            };

            console.log('[GOOGLE_DRIVE] ✅ Initializing with secure credentials');

            this.oauth2Client = new google.auth.OAuth2(
                this.credentials.client_id,
                this.credentials.client_secret,
                'http://localhost'
            );

            const tokens = store.get('google_tokens');
            const storedClientId = store.get('last_client_id');

            // FORCE LOGOUT if credentials changed
            if (storedClientId && storedClientId !== this.credentials.client_id) {
                console.log('🔄 Google Credentials changed. Resetting session...');
                this.signOut();
            } else if (tokens) {
                this.oauth2Client.setCredentials(tokens);
            }

            this.isEnabled = true;
        } catch (error) {
            console.error('[GOOGLE_DRIVE] ❌ Failed to initialize:', error.message);
            return;
        }

        // Save current ID for next check
        if (this.credentials?.client_id) {
            store.set('last_client_id', this.credentials.client_id);
        }
    }

    _checkEnabled() {
        if (!this.isEnabled || !this.oauth2Client) {
            throw new Error('Google Drive service not available. Please configure Google OAuth credentials.');
        }
    }

    async ensureAuth() {
        this._checkEnabled();

        console.log('━━━ GOOGLE AUTH CHECK ━━━');
        console.log('📍 Environment:', __dirname.includes('app.asar') ? 'PRODUCTION' : 'DEVELOPMENT');
        console.log('🔑 Client ID available:', !!this.oauth2Client._clientId);
        console.log('🔐 Client Secret available:', !!this.oauth2Client._clientSecret);

        const tokens = store.get('google_tokens');
        console.log('🎫 Stored tokens:', tokens ? 'FOUND' : 'NOT FOUND');

        if (!tokens) {
            console.log('⚠️ No tokens found. Starting Auth...');
            await this.authenticate();
        } else {
            console.log('✅ Using existing tokens');
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━');
    }

    authenticate() {
        this._checkEnabled();
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
                    scope: [
                        'https://www.googleapis.com/auth/drive.file',
                        'https://www.googleapis.com/auth/userinfo.email',
                        'https://www.googleapis.com/auth/userinfo.profile'
                    ],
                    state: state,
                    redirect_uri: localRedirect
                });

                console.log(`Google Auth: Listening on port ${port}. URL generated.`);
                shell.openExternal(authorizeUrl);
            });

            server.on('error', (err) => reject(err));
        })
            .then(async () => {
                // Fetch user info after successful auth
                try {
                    const info = await this.getUserInfo();
                    store.set('google_user', info);
                    return info;
                } catch (e) {
                    console.error('Error fetching user info after auth:', e);
                    return { email: 'Usuario', name: 'Desconocido' };
                }
            });
    }

    async getUserInfo() {
        if (!this.oauth2Client.credentials) return null;
        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
            const { data } = await oauth2.userinfo.get();
            return { email: data.email, name: data.name, picture: data.picture };
        } catch (error) {
            console.error('Error fetching Google User Info:', error);
            return null;
        }
    }

    signOut() {
        store.delete('google_tokens');
        store.delete('google_user');
        this.oauth2Client.setCredentials({});
        console.log('🚪 Google Account disconnected.');
        return true;
    }

    isAuthenticated() {
        const tokens = store.get('google_tokens');
        return !!tokens;
    }

    getStoredUser() {
        return store.get('google_user');
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
        console.log('━━━ GOOGLE DRIVE UPLOAD START ━━━');
        console.log('📄 File:', fileName);
        console.log('👤 Customer:', customerName);
        console.log('📧 Email:', customerEmail);
        console.log('📦 Buffer size:', buffer?.length || 0, 'bytes');

        try {
            await this.ensureAuth();
            console.log('✅ Auth completed');

            // 1. Root
            console.log('📁 Creating/finding root folder...');
            const rootId = await this.getOrCreateFolder(null, 'GIMNASIO');
            console.log('✅ Root folder ID:', rootId);

            // 2. Customer (SHARE FOLDER HERE)
            const safeCust = (customerName || 'Cliente').trim();
            console.log('📁 Creating/finding customer folder:', safeCust);
            const custId = await this.getOrCreateFolder(rootId, safeCust, customerEmail);
            console.log('✅ Customer folder ID:', custId);

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

            console.log('📤 Uploading file to Drive...');
            const file = await drive.files.create({
                resource: { name: fileName, parents: [custId] },
                media: media,
                fields: 'id, webViewLink, webContentLink'
            });
            console.log('✅ File uploaded! ID:', file.data.id);

            // 5. File Permission (Fallback: Anyone with link)
            console.log('🔓 Setting public permissions...');
            await drive.permissions.create({
                fileId: file.data.id,
                requestBody: { role: 'reader', type: 'anyone' }
            });
            console.log('✅ Public permissions set');

            // Also explicitly share file if requested (redundant if folder shared, but ensures notification)
            if (customerEmail && customerEmail.includes('@')) {
                try {
                    console.log('📧 Sharing with email:', customerEmail);
                    await drive.permissions.create({
                        fileId: file.data.id,
                        requestBody: { role: 'reader', type: 'user', emailAddress: customerEmail }
                    });
                    console.log('✅ Email share successful');
                } catch (e) {
                    console.log('⚠️ Email share failed:', e.message);
                }
            }

            console.log('━━━ UPLOAD COMPLETE ━━━');
            console.log('🔗 URL:', file.data.webViewLink);
            return file.data.webViewLink;
        } catch (error) {
            console.error('━━━ GOOGLE DRIVE UPLOAD ERROR ━━━');
            console.error('❌ Error type:', error.constructor.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error details:', JSON.stringify(error, null, 2));
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            throw error;
        }
    }

    async checkFileExistsFromUrl(url) {
        if (!url) return false;
        // Extract ID from URL
        // Matches /d/ID or id=ID
        const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
        if (!idMatch) return false;

        const fileId = idMatch[1];

        // Prevent auto-auth popup for background checks
        if (!this.isAuthenticated()) {
            return null; // Unknown status (Disconnected), do NOT treat as missing
        }

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
