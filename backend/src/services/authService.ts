import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { emailService } from './emailService';

const createHttpError = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_SUCCESS_MESSAGE =
  'If an account with that email exists, a password reset link has been sent.';
const ALLOWED_ROLES = ['student', 'teacher'] as const;
const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '7d';
const FACE_VERIFY_TOKEN_TTL = '5m';
const MAX_NAME_LEN = 80;
const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_BIO_LEN = 500;

export const authService = {
  async register(userData: any) {
    const { name, email, password, role = 'student', profilePictureBase64, faceEncoding } = userData;

    if (!name || name.trim().length < 2) throw createHttpError('Name must be at least 2 characters');
    if (name.trim().length > MAX_NAME_LEN) throw createHttpError(`Name must be at most ${MAX_NAME_LEN} characters`);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_EMAIL_LEN) {
      throw createHttpError('Valid email is required');
    }
    if (!password || password.length < 8) throw createHttpError('Password must be at least 8 characters');
    if (password.length > MAX_PASSWORD_LEN) throw createHttpError(`Password must be at most ${MAX_PASSWORD_LEN} characters`);
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw createHttpError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
    if (!ALLOWED_ROLES.includes(role)) throw createHttpError('Invalid role specified');

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail);

    if (checkError) throw new Error('Database error');
    // Generic message — do not confirm whether the email is registered.
    if (existingUsers && existingUsers.length > 0) {
      throw createHttpError('Unable to register with the provided details', 409);
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
        interests: [],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

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

    if (role === 'student' && faceEncoding) {
      try {
        const encodingStr = typeof faceEncoding === 'string'
          ? faceEncoding
          : JSON.stringify(faceEncoding);
        await supabase.from('users').update({ face_encoding: encodingStr }).eq('id', newUser.id);
      } catch (encErr) {
        console.error('Face encoding save failed (non-blocking):', encErr);
      }
    }

    emailService.sendWelcomeEmail(newUser.email, newUser.name).catch(() => {});

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

    const { data: users, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', (email || '').toLowerCase().trim());

    if (findError) throw new Error('Database error');

    const user = users && users.length > 0 ? users[0] : null;
    if (!user) throw new Error('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');

    const normalizedRole = (user.role || '').toLowerCase();

    if (normalizedRole === 'teacher') {
      const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
      return {
        requiresFaceVerification: false,
        user: { _id: user.id, name: user.name, email: user.email, role: user.role },
        token,
      };
    }

    if (normalizedRole === 'student') {
      const tempToken = jwt.sign(
        { id: user.id, role: user.role, type: 'face_verification' },
        config.jwtSecret,
        { expiresIn: FACE_VERIFY_TOKEN_TTL },
      );
      return { requiresFaceVerification: true, tempToken, userName: user.name };
    }

    // Fallback for unknown roles — issue token so app doesn't deadlock
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
    return {
      requiresFaceVerification: false,
      user: { _id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    };
  },

  async verifyFaceLogin(tempToken: string, liveFaceEncoding: number[]) {
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch {
      throw new Error('Face verification session expired. Please log in again.');
    }

    if (decoded.type !== 'face_verification') throw new Error('Invalid verification token');

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) throw new Error('User not found');

    if (!Array.isArray(liveFaceEncoding) || liveFaceEncoding.length === 0) {
      throw new Error('Invalid face data submitted');
    }

    if (!user.face_encoding) {
      const { error: saveErr } = await supabase
        .from('users')
        .update({ face_encoding: JSON.stringify(liveFaceEncoding) })
        .eq('id', user.id);

      if (saveErr) throw new Error('Failed to enroll face. Please try again.');
    } else {
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

      const distance = Math.sqrt(
        storedEncoding.reduce((sum, val, i) => sum + Math.pow(val - liveFaceEncoding[i], 2), 0),
      );

      const MATCH_THRESHOLD = 0.6;
      if (distance > MATCH_THRESHOLD) {
        throw new Error('Face verification failed. The face does not match our records.');
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
    return {
      user: { _id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    };
  },

  async requestPasswordReset(email: string) {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) throw createHttpError('Email is required');

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', normalizedEmail)
      .limit(1);

    if (error) throw new Error('Database error');

    const user = users && users.length > 0 ? users[0] : null;
    if (!user) return { message: PASSWORD_RESET_SUCCESS_MESSAGE };

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

    if (updateError) throw new Error('Database error');

    const resetUrl = `${config.frontendAppUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  },

  async resetPassword(token: string, newPassword: string) {
    const normalizedToken = token?.trim();
    if (!normalizedToken) throw createHttpError('Reset token is required');
    if (!newPassword) throw createHttpError('New password is required');
    if (newPassword.length < 8) throw createHttpError('Password must be at least 8 characters');
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

    if (error) throw new Error('Database error');

    const user = users && users.length > 0 ? users[0] : null;
    if (!user) throw createHttpError('This password reset link is invalid or has expired.');

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
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

    if (updateError) throw new Error('Database error');

    return { message: 'Password reset successful. You can now sign in with your new password.' };
  },

  async getCurrentUser(userId: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, bio, interests')
      .eq('id', userId)
      .single();

    if (error || !user) throw new Error('User not found');
    return { ...user, _id: user.id };
  },

  async updateProfile(userId: string, updateData: any) {
    const { name, bio, interests } = updateData;

    const cleanName = typeof name === 'string' ? name.trim() : undefined;
    if (cleanName !== undefined) {
      if (cleanName.length < 2) throw createHttpError('Name must be at least 2 characters');
      if (cleanName.length > MAX_NAME_LEN) throw createHttpError(`Name must be at most ${MAX_NAME_LEN} characters`);
    }
    if (bio !== undefined && bio !== null && typeof bio !== 'string') {
      throw createHttpError('Bio must be a string');
    }
    if (typeof bio === 'string' && bio.length > MAX_BIO_LEN) {
      throw createHttpError(`Bio must be at most ${MAX_BIO_LEN} characters`);
    }
    if (interests !== undefined && !Array.isArray(interests)) {
      throw createHttpError('Interests must be an array');
    }
    if (Array.isArray(interests) && interests.length > 20) {
      throw createHttpError('At most 20 interests are allowed');
    }

    const patch: Record<string, any> = {};
    if (cleanName !== undefined) patch.name = cleanName;
    if (bio !== undefined) patch.bio = bio;
    if (interests !== undefined) patch.interests = interests;

    const { data: user, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...user, _id: user.id };
  },

  async switchRole(userId: string, newRole: string) {
    if (!ALLOWED_ROLES.includes(newRole as any)) {
      throw createHttpError('Invalid role specified. Allowed roles: student, teacher', 400);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
    return { user: { ...user, _id: user.id }, token };
  },
};
