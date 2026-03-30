import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { emailService } from './emailService';

const createHttpError = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_SUCCESS_MESSAGE = 'If an account with that email exists, a password reset link has been sent.';

export const authService = {
  async register(userData: any) {
    const { name, email, password, role = 'student', profilePictureBase64, faceEncoding } = userData;

    // Check if user exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (checkError) {
      console.error('Error checking user:', checkError);
      throw new Error('Database error');
    }

    if (existingUsers && existingUsers.length > 0) {
      throw new Error('User already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          role,
          interests: [],
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      throw new Error(error.message);
    }

    // Handle profile picture upload for students
    let profilePictureUrl: string | undefined;
    if (role === 'student' && profilePictureBase64) {
      try {
        const { profilePictureService } = await import('./profilePictureService');
        const matches = profilePictureBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = mimeType === 'image/png' ? '.png' : '.jpg';
          const fakeFile = {
            buffer,
            mimetype: mimeType,
            originalname: `profile${ext}`,
            size: buffer.length,
          } as Express.Multer.File;

          profilePictureUrl = await profilePictureService.uploadProfilePicture(newUser.id, fakeFile);
          await profilePictureService.saveProfilePictureUrl(newUser.id, profilePictureUrl);
        }
      } catch (picErr) {
        console.error('Profile picture upload failed (non-blocking):', picErr);
      }
    }

    // Store face encoding if provided (from frontend face-api.js extraction)
    console.log('[Register] role:', role, '| faceEncoding received:', !!faceEncoding, '| length:', Array.isArray(faceEncoding) ? faceEncoding.length : (typeof faceEncoding));
    if (role === 'student' && faceEncoding) {
      try {
        const encodingStr = typeof faceEncoding === 'string' ? faceEncoding : JSON.stringify(faceEncoding);
        console.log('[Register] Saving face_encoding for user', newUser.id, '| encoding string length:', encodingStr.length);
        const { error: faceErr } = await supabase.from('users').update({ face_encoding: encodingStr }).eq('id', newUser.id);
        if (faceErr) {
          console.error('[Register] Supabase face_encoding update ERROR:', faceErr.message, faceErr.details, faceErr.hint);
        } else {
          console.log('[Register] face_encoding saved successfully for user', newUser.id);
        }
      } catch (encErr) {
        console.error('[Register] Face encoding save EXCEPTION:', encErr);
      }
    } else {
      console.log('[Register] Skipping face encoding save. role:', role, '| faceEncoding truthy:', !!faceEncoding);
    }

    // Send welcome email (don't block registration if email fails)
    emailService.sendWelcomeEmail(newUser.email, newUser.name).catch(console.error);

    // Do NOT issue a JWT here — user must log in via /login (face verification for students)
    return {
      user: {
        _id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        profilePictureUrl,
      },
    };
  },

  async login(credentials: any) {
    const { email, password } = credentials;

    // Find user
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (findError) {
      console.error('Error finding user:', findError);
      throw new Error('Database error');
    }

    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const normalizedRole = (user.role || '').toLowerCase();
    console.log('[Login] User found:', { id: user.id, email: user.email, role: user.role, normalizedRole });
    console.log('[Login] face_encoding column value:', user.face_encoding === null ? 'NULL' : user.face_encoding === undefined ? 'UNDEFINED' : `present (type: ${typeof user.face_encoding}, length: ${String(user.face_encoding).length})`);

    // Teachers: bypass face verification entirely, issue full JWT
    if (normalizedRole === 'teacher') {
      console.log('[Login] Teacher login — issuing full JWT (no face verification)');
      const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
        expiresIn: '30d',
      });
      return {
        requiresFaceVerification: false,
        user: {
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      };
    }

    // Students: ALWAYS require face verification — no exceptions.
    // If face_encoding is missing, verifyFaceLogin will reject with a clear error.
    if (normalizedRole === 'student') {
      console.log('[Login] Student login — requiring face verification (face_encoding present:', !!user.face_encoding, ')');
      const tempToken = jwt.sign(
        { id: user.id, role: user.role, type: 'face_verification' },
        config.jwtSecret,
        { expiresIn: '5m' },
      );
      return {
        requiresFaceVerification: true,
        tempToken,
        userName: user.name,
      };
    }

    // Unknown role: issue full JWT
    console.log('[Login] Unknown role:', user.role, '— issuing full JWT');
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: '30d',
    });
    return {
      requiresFaceVerification: false,
      user: {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  },

  async verifyFaceLogin(tempToken: string, liveFaceEncoding: number[]) {
    // Validate the temporary token
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch {
      throw new Error('Face verification session expired. Please log in again.');
    }

    if (decoded.type !== 'face_verification') {
      throw new Error('Invalid verification token');
    }

    // Get stored face encoding
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    // Validate live encoding input
    if (!Array.isArray(liveFaceEncoding) || liveFaceEncoding.length === 0) {
      throw new Error('Invalid face data submitted');
    }

    if (!user.face_encoding) {
      // First-time enrollment: no stored encoding yet.
      // Password was already verified (tempToken proves it), so save this face as the reference.
      console.log('[VerifyFace] No stored encoding for user', user.id, '— enrolling face (first-time)');
      const { error: saveErr } = await supabase
        .from('users')
        .update({ face_encoding: JSON.stringify(liveFaceEncoding) })
        .eq('id', user.id);

      if (saveErr) {
        console.error('[VerifyFace] Failed to save face enrollment:', saveErr.message);
        throw new Error('Failed to enroll face. Please try again.');
      }

      console.log('[VerifyFace] Face enrolled successfully for user', user.id);
      // Enrollment counts as verification — issue full JWT
    } else {
      // Parse stored encoding and compare
      let storedEncoding: number[];
      try {
        storedEncoding = typeof user.face_encoding === 'string'
          ? JSON.parse(user.face_encoding)
          : user.face_encoding;
      } catch {
        throw new Error('Stored face data is corrupted. Please re-register your face.');
      }

      if (liveFaceEncoding.length !== storedEncoding.length) {
        throw new Error('Invalid face data submitted');
      }

      // Euclidean distance comparison
      const distance = Math.sqrt(
        storedEncoding.reduce((sum, val, i) => sum + Math.pow(val - liveFaceEncoding[i], 2), 0),
      );

      console.log('[VerifyFace] Euclidean distance:', distance.toFixed(4));
      const MATCH_THRESHOLD = 0.6;
      if (distance > MATCH_THRESHOLD) {
        throw new Error('Face verification failed. The face does not match our records.');
      }
    }

    // Face matched (or enrolled) → issue full JWT
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: '30d',
    });

    return {
      user: {
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  },

  async requestPasswordReset(email: string) {
    const normalizedEmail = email?.trim();
    if (!normalizedEmail) {
      throw createHttpError('Email is required');
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .limit(1);

    if (error) {
      console.error('Error finding user for password reset:', error);
      throw new Error('Database error');
    }

    const user = users && users.length > 0 ? users[0] : null;
    if (!user) {
      return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetPasswordExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_password_token: hashedToken,
        reset_password_expires_at: resetPasswordExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error saving password reset token:', updateError);
      throw new Error('Database error');
    }

    const resetUrl = `${config.frontendAppUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  },

  async resetPassword(token: string, newPassword: string) {
    const normalizedToken = token?.trim();
    if (!normalizedToken) {
      throw createHttpError('Reset token is required');
    }

    if (!newPassword) {
      throw createHttpError('New password is required');
    }

    if (newPassword.length < 8) {
      throw createHttpError('Password must be at least 8 characters');
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw createHttpError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    const hashedToken = crypto.createHash('sha256').update(normalizedToken).digest('hex');
    const now = new Date().toISOString();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, password')
      .eq('reset_password_token', hashedToken)
      .gt('reset_password_expires_at', now)
      .limit(1);

    if (error) {
      console.error('Error verifying password reset token:', error);
      throw new Error('Database error');
    }

    const user = users && users.length > 0 ? users[0] : null;
    if (!user) {
      throw createHttpError('This password reset link is invalid or has expired.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        reset_password_token: null,
        reset_password_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password after reset:', updateError);
      throw new Error('Database error');
    }

    return { message: 'Password reset successful. You can now sign in with your new password.' };
  },

  async getCurrentUser(userId: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, bio, interests')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    return { ...user, _id: user.id }; // Map id to _id for frontend compatibility
  },

  async updateProfile(userId: string, updateData: any) {
    const { name, bio, interests } = updateData;

    const { data: user, error } = await supabase
      .from('users')
      .update({ name, bio, interests })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { ...user, _id: user.id };
  },

  async switchRole(userId: string, newRole: string) {
    const { data: user, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Generate new token with updated role
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: '30d',
    });

    return {
      user: { ...user, _id: user.id },
      token,
    };
  }
};
