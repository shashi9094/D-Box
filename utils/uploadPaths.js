const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const defaultUploadsRoot = path.join(projectRoot, 'uploads');

const resolveUploadsRoot = () => {
    const configuredRoot = String(process.env.UPLOADS_ROOT || '').trim();
    if (!configuredRoot) {
        return defaultUploadsRoot;
    }

    return path.isAbsolute(configuredRoot)
        ? path.normalize(configuredRoot)
        : path.resolve(projectRoot, configuredRoot);
};

const uploadsRoot = resolveUploadsRoot();
const boxUploadsRoot = path.join(uploadsRoot, 'boxes');
const profileUploadsRoot = path.join(uploadsRoot, 'profiles');

const ensureDirExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const ensureUploadDirectories = () => {
    ensureDirExists(uploadsRoot);
    ensureDirExists(boxUploadsRoot);
    ensureDirExists(profileUploadsRoot);
};

const resolveUploadAbsolutePath = (filePathValue) => {
    const normalizedPath = String(filePathValue || '').replace(/^\/+/, '').replace(/\\/g, '/');
    if (!normalizedPath) return '';

    if (normalizedPath === 'uploads' || normalizedPath.startsWith('uploads/')) {
        const relativeUploadPath = normalizedPath.slice('uploads'.length).replace(/^\/+/, '');
        const relativeFsPath = relativeUploadPath.replace(/\//g, path.sep);
        const configuredPath = path.join(uploadsRoot, relativeFsPath);

        if (path.resolve(uploadsRoot) !== path.resolve(defaultUploadsRoot) && !fs.existsSync(configuredPath)) {
            const legacyPath = path.join(defaultUploadsRoot, relativeFsPath);
            if (fs.existsSync(legacyPath)) {
                return legacyPath;
            }
        }

        return configuredPath;
    }

    return path.join(projectRoot, normalizedPath.replace(/\//g, path.sep));
};

const isUsingDefaultUploadsRoot = () => path.resolve(uploadsRoot) === path.resolve(defaultUploadsRoot);

const logUploadsStorageWarning = () => {
    if (process.env.NODE_ENV !== 'production' || !isUsingDefaultUploadsRoot()) {
        return;
    }

    console.warn(
        `[uploads] UPLOADS_ROOT is not set. Files are being stored in ${uploadsRoot}. ` +
        'On managed hosts like Railway or Render, this directory can be wiped on redeploy or restart. ' +
        'Set UPLOADS_ROOT to a persistent disk mount path to prevent uploaded files from disappearing.'
    );
};

module.exports = {
    uploadsRoot,
    defaultUploadsRoot,
    boxUploadsRoot,
    profileUploadsRoot,
    ensureUploadDirectories,
    resolveUploadAbsolutePath,
    logUploadsStorageWarning
};
