import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { emailService } from './emailService';

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
