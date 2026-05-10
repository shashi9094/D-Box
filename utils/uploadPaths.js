const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const defaultUploadsRoot = path.join(projectRoot, 'uploads');
const isProduction = process.env.NODE_ENV === 'production';

const resolveUploadsRoot = () => {
    const configuredRoot = String(process.env.UPLOADS_ROOT || '').trim();
    // In production, default to a safe tmp folder to avoid writing into project dir
    if (!configuredRoot) {
        if (isProduction) return '/tmp';
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
    // Only create project-local uploads in non-production or when uploadsRoot is explicitly set
    if (isProduction && String(process.env.UPLOADS_ROOT || '').trim() === '') {
        // production fallback is /tmp — ensure that's usable but avoid creating project uploads folder
        ensureDirExists(uploadsRoot);
        ensureDirExists(boxUploadsRoot);
        ensureDirExists(profileUploadsRoot);
        return;
    }

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
    if (process.env.NODE_ENV !== 'production') return;

    if (isUsingDefaultUploadsRoot()) {
        console.warn(
            `[uploads] UPLOADS_ROOT is not set. In production the app will use ${uploadsRoot} as a fallback. ` +
            'This is ephemeral on many hosts. Prefer S3 for durable storage and set UPLOADS_ROOT to a persistent disk if needed.'
        );
        return;
    }
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
