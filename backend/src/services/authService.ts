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
const MAX_NAME_LEN = 80;
const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_BIO_LEN = 500;
const USER_PROFILE_FIELDS = 'id, name, email, role, bio, interests, profile_picture_url';
const profileResponse = async (user: any) => {
  let profilePictureUrl:string|undefined;
  if(user.profile_picture_url){
    try{const {profilePictureService}=await import('./profilePictureService');profilePictureUrl=await profilePictureService.signedProfilePictureUrl(user.profile_picture_url,user.id);}
    catch{console.warn('Profile picture is temporarily unavailable');}
  }
  return {_id:user.id,id:user.id,name:user.name,email:user.email,role:user.role,bio:user.bio,interests:user.interests||[],profilePictureUrl};
};

export const authService = {
  async register(userData: any) {
    const { name, email, password, role = 'student' } = userData;
    if ('faceEncoding' in userData || 'profilePictureBase64' in userData) throw createHttpError('Registration accepts account details only. Photo enrolment has been removed.');

    if (typeof name !== 'string' || name.trim().length < 2) throw createHttpError('Name must be at least 2 characters');
    if (name.trim().length > MAX_NAME_LEN) throw createHttpError(`Name must be at most ${MAX_NAME_LEN} characters`);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > MAX_EMAIL_LEN) {
      throw createHttpError('Valid email is required');
    }
    if (typeof password !== 'string' || password.length < 8) throw createHttpError('Password must be at least 8 characters');
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

    // Routine welcome emails are opt-in per course through the durable outbox.

    return {
      user: {
        _id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  },

  async login(credentials: any) {
    const { email, password } = credentials;
    if (typeof email !== 'string' || !email.trim() || email.length > MAX_EMAIL_LEN ||
        typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LEN) {
      throw createHttpError('Valid email and password are required');
    }

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

    if (user.status !== 'active') throw createHttpError('Account access is unavailable. Contact your administrator.', 403);
    if (!['student','teacher','admin'].includes(normalizedRole)) throw createHttpError('This account role cannot sign in.',403);
    const token = jwt.sign({ id:user.id, role:user.role, version:user.session_version },config.jwtSecret,{expiresIn:ACCESS_TOKEN_TTL});
    return {user:await profileResponse(user),token};
  },

  async requestPasswordReset(email: string) {
    if (typeof email !== 'string' || email.length > MAX_EMAIL_LEN) throw createHttpError('Valid email is required');
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) throw createHttpError('Email is required');

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, status')
      .eq('email', normalizedEmail)
      .limit(1);

    if (error) throw new Error('Database error');

    const user = users && users.length > 0 ? users[0] : null;
    if (!user || !['active','invited'].includes(user.status)) return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
    // The staging recipient gate applies to account recovery too.
    if (!config.automationAllowAll && !(config.automationRecipients || []).includes(user.email.toLowerCase())) {
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

    if (updateError) throw new Error('Database error');

    const resetUrl = `${config.frontendAppUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  },

  async resetPassword(token: string, newPassword: string) {
    if (typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length > MAX_PASSWORD_LEN) throw createHttpError('Valid reset token and password are required');
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
      .select('id, password, status')
      .eq('reset_password_token', hashedToken)
      .gt('reset_password_expires_at', now)
      .limit(1);

    if (error) throw new Error('Database error');

    const user = users && users.length > 0 ? users[0] : null;
    if (!user || !['active','invited'].includes(user.status)) throw createHttpError('This password reset link is invalid or has expired.');

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { data: consumed, error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        status: 'active',
        reset_password_token: null,
        reset_password_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .eq('reset_password_token', hashedToken)
      .in('status', ['active','invited'])
      .gt('reset_password_expires_at', now)
      .select('id');

    if (updateError) throw new Error('Database error');
    if(!consumed?.length) throw createHttpError('This password reset link is invalid or has expired.');

    return { message: 'Password reset successful. You can now sign in with your new password.' };
  },

  async getCurrentUser(userId: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select(USER_PROFILE_FIELDS)
      .eq('id', userId)
      .single();

    if (error || !user) throw new Error('User not found');
    return profileResponse(user);
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
    if(Array.isArray(interests) && interests.some(value=>typeof value!=='string' || value.length>80)) throw createHttpError('Each interest must be a string of at most 80 characters');

    const patch: Record<string, any> = {};
    if (cleanName !== undefined) patch.name = cleanName;
    if (bio !== undefined) patch.bio = bio;
    if (interests !== undefined) patch.interests = interests;
    if(!Object.keys(patch).length) throw createHttpError('No profile changes provided');

    const { data: user, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select(USER_PROFILE_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    return profileResponse(user);
  },

};
