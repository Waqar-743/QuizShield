import { supabase } from '../config/supabase';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { emailService } from './emailService';

export const authService = {
  async register(userData: any) {
    const { name, email, password, role = 'student' } = userData;

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

    // Send welcome email (don't block registration if email fails)
    emailService.sendWelcomeEmail(newUser.email, newUser.name).catch(console.error);

    // Generate Token
    const token = jwt.sign({ id: newUser.id, role: newUser.role }, config.jwtSecret, {
      expiresIn: '30d',
    });

    return {
      user: {
        _id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      token,
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

    // Generate Token
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
