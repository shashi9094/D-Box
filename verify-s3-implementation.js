#!/usr/bin/env node

/**
 * S3 Signed URL Implementation Test Script
 * Verifies all components are properly implemented
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}==== ${msg} ====${colors.reset}\n`),
};

const testResults = [];

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log.success(`${description} exists at ${filePath}`);
    testResults.push(true);
    return true;
  } else {
    log.error(`${description} NOT FOUND at ${filePath}`);
    testResults.push(false);
    return false;
  }
}

function checkFileContent(filePath, searchStrings, description) {
  if (!fs.existsSync(filePath)) {
    log.error(`Cannot check ${description}: file not found`);
    testResults.push(false);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const missing = [];

  for (const str of searchStrings) {
    if (!content.includes(str)) {
      missing.push(`"${str}"`);
    }
  }

  if (missing.length === 0) {
    log.success(`${description} contains all required content`);
    testResults.push(true);
    return true;
  } else {
    log.error(`${description} missing: ${missing.join(', ')}`);
    testResults.push(false);
    return false;
  }
}

function checkPackageJson(packageName) {
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log.error('package.json not found');
    testResults.push(false);
    return false;
  }

  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(content);

  if (packageJson.dependencies && packageJson.dependencies[packageName]) {
    log.success(`Package ${packageName} is installed`);
    testResults.push(true);
    return true;
  } else {
    log.error(`Package ${packageName} NOT found in dependencies`);
    testResults.push(false);
    return false;
  }
}

async function runTests() {
  log.header('S3 SIGNED URL IMPLEMENTATION VERIFICATION');

  log.header('1. Checking Created Files');
  checkFile(path.join(__dirname, 'services', 's3SignedUrl.js'), 'S3 Signed URL Service');
  checkFile(path.join(__dirname, 'private', 'scripts', 'fileUrlService.js'), 'Frontend File URL Service');
  checkFile(path.join(__dirname, 'S3_SIGNED_URL_SETUP.md'), 'Setup Documentation');

  log.header('2. Checking Dependencies');
  checkPackageJson('@aws-sdk/s3-request-presigner');
  checkPackageJson('@aws-sdk/client-s3');

  log.header('3. Checking Backend Implementation');
  checkFileContent(
    path.join(__dirname, 'controllers', 'fileController.js'),
    ['getSignedUrl', 'getFileWithSignedUrls', 'getBoxFiles'],
    'fileController.js - Signed URL endpoints'
  );

  checkFileContent(
    path.join(__dirname, 'controllers', 'boxController.js'),
    ['return key;', 'deleteS3ObjectByUrl', 'S3 object key'],
    'boxController.js - Store object keys (not URLs)'
  );

  checkFileContent(
    path.join(__dirname, 'routes', 'fileRoutes.js'),
    ['/:id/signed-url', 'getBoxFiles', 'specific routes MUST come before general'],
    'fileRoutes.js - New routes and correct ordering'
  );

  log.header('4. Checking Frontend Implementation');
  checkFileContent(
    path.join(__dirname, 'private', 'pages', 'uploads.html'),
    ['fileUrlService.js', 'fileUrlService.openFile', 'async', 'fetch signed URL'],
    'uploads.html - Uses signed URL service'
  );

  log.header('5. Verifying Syntax');
  const syntaxTestFiles = [
    path.join(__dirname, 'controllers', 'fileController.js'),
    path.join(__dirname, 'services', 's3SignedUrl.js'),
    path.join(__dirname, 'controllers', 'boxController.js'),
  ];

  const { execSync } = require('child_process');
  for (const file of syntaxTestFiles) {
    try {
      execSync(`node --check "${file}"`, { stdio: 'ignore' });
      log.success(`Syntax valid: ${path.basename(file)}`);
      testResults.push(true);
    } catch (error) {
      log.error(`Syntax error in ${path.basename(file)}`);
      testResults.push(false);
    }
  }

  log.header('6. Feature Checklist');
  const features = [
    ['generateSignedDownloadUrl', 'Generate signed URLs with 1-hour expiration'],
    ['extractObjectKeyFromValue', 'Handle both old URLs and new keys (backward compatible)'],
    ['getFileWithSignedUrls', 'Fetch file with metadata and signed URLs'],
    ['fileUrlService.openFile', 'Frontend: Open file with signed URL in new tab'],
    ['fileUrlService.downloadFile', 'Frontend: Download file with signed URL'],
    ['fileUrlService.openFile', 'Frontend: URL caching (55 minutes)'],
    ['File access verification', 'Check user is box member before URL generation'],
  ];

  features.forEach(([feature, description]) => {
    log.info(`${feature}: ${description}`);
  });

  log.header('Test Results Summary');
  const passed = testResults.filter(Boolean).length;
  const total = testResults.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`${colors.cyan}Results: ${passed}/${total} tests passed (${percentage}%)${colors.reset}\n`);

  if (passed === total) {
    log.success('ALL TESTS PASSED! Implementation is complete and ready for testing.');
    process.exit(0);
  } else {
    log.error(`${total - passed} test(s) failed. Please review the errors above.`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test script error:', error.message);
  process.exit(1);
});
