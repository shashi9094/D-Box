import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export const uploadFileToS3 = async (fileBuffer, fileName, mimeType) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `uploads/${Date.now()}-${fileName}`,
      Body: fileBuffer,
      ContentType: mimeType,
    };

    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      key: result.Key,
      size: fileBuffer.length,
    };
  } catch (error) {
    throw new Error(`S3 upload error: ${error.message}`);
  }
};

export const deleteFileFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    throw new Error(`S3 delete error: ${error.message}`);
  }
};

export const getS3FileUrl = (key) => {
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

export const listS3Files = async (prefix) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: prefix,
    };

    const result = await s3.listObjectsV2(params).promise();
    return result.Contents || [];
  } catch (error) {
    throw new Error(`S3 list error: ${error.message}`);
  }
};

export const getBucketSize = async () => {
  try {
    const objects = await listS3Files('uploads/');
    const totalSize = objects.reduce((sum, obj) => sum + obj.Size, 0);
    return totalSize;
  } catch (error) {
    throw new Error(`Error calculating bucket size: ${error.message}`);
  }
};

export default s3;
