const service = require('../src/main/services/google.service');
const { app } = require('electron');

async function testConnection() {
    try {
        console.log('--- TEST START ---');
        console.log('1. Auth Check...');
        await service.ensureAuth();
        console.log('✅ Auth OK.');

        // Test with a dummy buffer
        const dummyBuffer = Buffer.from('TEST EXCEL CONTENT');
        const fileName = `Test_Upload_${Date.now()}.xlsx`;

        // Change this email to verify sharing!
        // Using a clear dummy or user's email if familiar.
        const testEmail = 'franciscosalinas_test@gmail.com';

        console.log(`2. Uploading file "${fileName}" and sharing with "${testEmail}"...`);

        const link = await service.uploadFile(
            dummyBuffer,
            fileName,
            'Cliente De Prueba',
            testEmail,
            'Mesociclo Test'
        );

        console.log('✅ TEST SUCCESS!');
        console.log('🔗 Link:', link);
        console.log('--- TEST END ---');
        app.quit();
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        app.quit();
    }
}

app.whenReady().then(testConnection);
