/**
 * OTP Model
 * Handles OTP storage, validation, and expiry management
 */

const db = require('../db/connection');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

class OTPModel {
  /**
   * Generate a secure 6-digit OTP
   */
  static generateOTP() {
    return String(crypto.randomInt(100000, 1000000));
  }

  /**
   * Hash OTP for storage
   */
  static async hashOTP(otp) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(otp, salt);
  }

  /**
   * Verify OTP against hash
   */
  static async verifyOTP(otp, hash) {
    return bcrypt.compare(otp, hash);
  }

  /**
   * Create OTP record
   */
  static async createOTP(email, purpose = 'verification') {
    const sql = db.promise();
    const otp = this.generateOTP();
    const hashedOtp = await this.hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    try {
      const query = `
        INSERT INTO otps (email, otp_hash, purpose, expires_at, attempts, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          otp_hash = VALUES(otp_hash),
          purpose = VALUES(purpose),
          expires_at = VALUES(expires_at),
          attempts = 0,
          created_at = NOW()
      `;

      await sql.query(query, [
        email.toLowerCase().trim(),
        hashedOtp,
        purpose,
        expiresAt,
        0,
      ]);

      return {
        success: true,
        otp, // Return plain OTP for sending via email
        email,
        purpose,
        expiresAt,
      };
    } catch (error) {
      console.error('Error creating OTP:', error);
      throw new Error('Failed to create OTP');
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTPCode(email, otp, purpose = 'verification') {
    const sql = db.promise();

    try {
      const query = `
        SELECT id, otp_hash, expires_at, attempts 
        FROM otps 
        WHERE email = ? AND purpose = ? 
        LIMIT 1
      `;

      const [rows] = await sql.query(query, [
        email.toLowerCase().trim(),
        purpose,
      ]);

      if (rows.length === 0) {
        return {
          success: false,
          message: 'OTP not found or expired',
        };
      }

      const otpRecord = rows[0];

      // Check expiry
      if (new Date(otpRecord.expires_at) < new Date()) {
        await this.deleteOTP(email, purpose);
        return {
          success: false,
          message: 'OTP has expired',
        };
      }

      // Check attempts
      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        await this.deleteOTP(email, purpose);
        return {
          success: false,
          message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
        };
      }

      // Verify OTP
      const isValid = await this.verifyOTP(otp, otpRecord.otp_hash);

      if (!isValid) {
        // Increment attempts
        const updateQuery = `
          UPDATE otps 
          SET attempts = attempts + 1 
          WHERE id = ?
        `;
        await sql.query(updateQuery, [otpRecord.id]);

        return {
          success: false,
          message: 'Invalid OTP',
          remainingAttempts: OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1),
        };
      }

      // Delete OTP after successful verification
      await this.deleteOTP(email, purpose);

      return {
        success: true,
        message: 'OTP verified successfully',
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw new Error('Failed to verify OTP');
    }
  }

  /**
   * Delete OTP record
   */
  static async deleteOTP(email, purpose) {
    const sql = db.promise();

    try {
      const query = `DELETE FROM otps WHERE email = ? AND purpose = ?`;
      await sql.query(query, [email.toLowerCase().trim(), purpose]);
    } catch (error) {
      console.error('Error deleting OTP:', error);
    }
  }

  /**
   * Check if OTP can be resent (cooldown check)
   */
  static async canResendOTP(email, purpose = 'verification') {
    const sql = db.promise();
    const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

    try {
      const query = `
        SELECT created_at 
        FROM otps 
        WHERE email = ? AND purpose = ? 
        LIMIT 1
      `;

      const [rows] = await sql.query(query, [
        email.toLowerCase().trim(),
        purpose,
      ]);

      if (rows.length === 0) {
        return { canResend: true, waitSeconds: 0 };
      }

      const createdAt = new Date(rows[0].created_at).getTime();
      const now = Date.now();
      const elapsed = now - createdAt;
      const waitMs = Math.max(0, RESEND_COOLDOWN_MS - elapsed);

      return {
        canResend: waitMs === 0,
        waitSeconds: Math.ceil(waitMs / 1000),
      };
    } catch (error) {
      console.error('Error checking resend cooldown:', error);
      return { canResend: true, waitSeconds: 0 };
    }
  }

  /**
   * Clean up expired OTPs (should be run periodically)
   */
  static async cleanupExpiredOTPs() {
    const sql = db.promise();

    try {
      const query = `DELETE FROM otps WHERE expires_at < NOW()`;
      const result = await sql.query(query);
      console.log(`Cleaned up ${result[0].affectedRows} expired OTPs`);
    } catch (error) {
      console.error('Error cleaning up OTPs:', error);
    }
  }
}

module.exports = OTPModel;
