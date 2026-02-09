#!/usr/bin/env node

/**
 * Credential Migration Script
 *
 * This script helps migrate from the old .env system to the new secure credential system.
 * It will:
 * 1. Check if old .env exists
 * 2. Create .env.local with the same credentials
 * 3. Prompt to delete the old .env
 * 4. Verify .env is in .gitignore
 *
 * Run with: node scripts/migrate-credentials.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log('🔐 Gym Manager Pro - Credential Migration Tool\n');

    const projectRoot = path.join(__dirname, '..');
    const oldEnvPath = path.join(projectRoot, '.env');
    const newEnvPath = path.join(projectRoot, '.env.local');
    const gitignorePath = path.join(projectRoot, '.gitignore');

    // Step 1: Check if old .env exists
    if (!fs.existsSync(oldEnvPath)) {
        console.log('✅ No old .env file found. Migration not needed.');
        console.log('ℹ️  Use .env.local.example as a template to create .env.local\n');
        rl.close();
        return;
    }

    console.log('⚠️  Found old .env file with potentially exposed credentials\n');

    // Step 2: Check if it was committed to git
    const execSync = require('child_process').execSync;
    let wasCommitted = false;
    try {
        const result = execSync('git log --all --full-history -- .env', { encoding: 'utf-8', cwd: projectRoot });
        wasCommitted = result.trim().length > 0;
    } catch (e) {
        console.log('ℹ️  Could not check git history (may not be a git repo)\n');
    }

    if (wasCommitted) {
        console.log('🚨 SECURITY ALERT: .env was committed to git!');
        console.log('   You MUST rotate (change) all credentials:');
        console.log('   - Supabase: https://supabase.com/dashboard → Settings → API → Reset Keys');
        console.log('   - Google OAuth: https://console.cloud.google.com → Credentials → Delete & Recreate');
        console.log('   - GitHub Token: https://github.com/settings/tokens → Revoke & Create New\n');

        const proceed = await question('Have you rotated all credentials? (yes/no): ');
        if (proceed.toLowerCase() !== 'yes') {
            console.log('\n⚠️  Please rotate credentials first, then run this script again.');
            rl.close();
            return;
        }
    }

    // Step 3: Read old .env
    console.log('\n📖 Reading old .env file...');
    const oldEnvContent = fs.readFileSync(oldEnvPath, 'utf-8');

    // Step 4: Check if .env.local already exists
    if (fs.existsSync(newEnvPath)) {
        console.log('⚠️  .env.local already exists');
        const overwrite = await question('Overwrite it with .env content? (yes/no): ');
        if (overwrite.toLowerCase() !== 'yes') {
            console.log('\n✅ Keeping existing .env.local');
            const deleteOld = await question('Delete old .env file? (yes/no): ');
            if (deleteOld.toLowerCase() === 'yes') {
                fs.unlinkSync(oldEnvPath);
                console.log('✅ Old .env deleted');
            }
            rl.close();
            return;
        }
    }

    // Step 5: Create .env.local
    console.log('✍️  Creating .env.local...');
    const header = `# Gym Manager Pro - Secure Credentials
# Migrated from .env on ${new Date().toISOString()}
# This file is git-ignored and should NEVER be committed
#
# For more information, see: CREDENTIALS_SETUP.md

`;
    fs.writeFileSync(newEnvPath, header + oldEnvContent);
    console.log('✅ Created .env.local');

    // Step 6: Verify .gitignore
    console.log('\n🔍 Verifying .gitignore...');
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    }

    const mustIgnore = ['.env', '.env.local', '.env.*.local'];
    let gitignoreUpdated = false;

    for (const pattern of mustIgnore) {
        if (!gitignoreContent.includes(pattern)) {
            console.log(`⚠️  Adding ${pattern} to .gitignore`);
            gitignoreContent += `\n${pattern}`;
            gitignoreUpdated = true;
        }
    }

    if (gitignoreUpdated) {
        fs.writeFileSync(gitignorePath, gitignoreContent);
        console.log('✅ Updated .gitignore');
    } else {
        console.log('✅ .gitignore already correct');
    }

    // Step 7: Prompt to delete old .env
    console.log('\n⚠️  Old .env file still exists');
    const deleteOld = await question('Delete it now? (RECOMMENDED - yes/no): ');

    if (deleteOld.toLowerCase() === 'yes') {
        fs.unlinkSync(oldEnvPath);
        console.log('✅ Old .env deleted');
    } else {
        console.log('⚠️  Keeping old .env - Remember to delete it manually!');
    }

    // Step 8: Remove .env from git history if it was committed
    if (wasCommitted) {
        console.log('\n🔧 IMPORTANT: Remove .env from git history:');
        console.log('   Run this command in your terminal:\n');
        console.log('   git filter-branch --force --index-filter \\');
        console.log('   "git rm --cached --ignore-unmatch .env" \\');
        console.log('   --prune-empty --tag-name-filter cat -- --all\n');
        console.log('   Then force-push to remote: git push origin --force --all\n');
    }

    // Step 9: Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Created .env.local with your credentials');
    console.log('✓ Verified .gitignore configuration');
    if (deleteOld.toLowerCase() === 'yes') {
        console.log('✓ Deleted old .env file');
    }
    console.log('\nNext steps:');
    console.log('1. Test the app: npm run dev');
    console.log('2. Verify credentials load correctly');
    console.log('3. Read CREDENTIALS_SETUP.md for production setup');
    if (wasCommitted) {
        console.log('4. ⚠️  Remove .env from git history (see command above)');
    }
    console.log('\n💡 For production, consider using system environment variables');
    console.log('   See: CREDENTIALS_SETUP.md - Method 1\n');

    rl.close();
}

main().catch(err => {
    console.error('❌ Migration failed:', err);
    rl.close();
    process.exit(1);
});
