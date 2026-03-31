const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../database/models/User');
const { validationResult } = require('express-validator');

class AuthController {
  static async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, role, department } = req.body;

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        name,
        email,
        password_hash: passwordHash,
        role,
        department
      });

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Invalid credentials or user inactive.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      await User.updateLastLogin(user.id);

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id);
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          is_active: user.is_active
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async logout(req, res) {
    res.json({ message: 'Logout successful' });
  }
}

module.exports = AuthController;
