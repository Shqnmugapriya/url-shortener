const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  try {
    // Check if user exists
    const userSelect = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userSelect.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Determine role: always regular user for manual admin security
    const finalRole = 'user';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await db.query(
      'INSERT INTO users (name, email, password, role, country) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, country, created_at',
      [name, email, hashedPassword, finalRole, req.body.country || 'India']
    );

    const user = newUser.rows[0];

    // Create token
    const payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user });
      }
    );
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check user
    const userSelect = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userSelect.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = userSelect.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    const payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            country: user.country,
            created_at: user.created_at
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.getMe = async (req, res) => {
  try {
    const userSelect = await db.query('SELECT id, name, email, role, country, created_at FROM users WHERE id = $1', [req.user.id]);
    res.json(userSelect.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).send('Server Error');
  }
};

// In-memory store for mock password reset tokens
const resetTokens = new Map();

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const userSelect = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userSelect.rows.length === 0) {
      return res.status(400).json({ message: 'User with this email does not exist' });
    }

    // Generate a mock token
    const token = 'reset-' + Math.random().toString(36).substring(2, 15);
    resetTokens.set(token, email);

    // In a real app we'd email this. For mock, we just return the token
    res.json({ 
      message: 'Reset link generated successfully', 
      token, 
      instructions: 'Use this token to perform the password reset.' 
    });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  const email = resetTokens.get(token);
  if (!email) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }

  try {
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user
    await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
    
    // Clear token
    resetTokens.delete(token);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).send('Server Error');
  }
};

exports.updateProfile = async (req, res) => {
  const { name, email, password, country } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and Email are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  try {
    // Check if email is already taken by another user
    const checkEmail = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ message: 'Email is already in use by another account' });
    }

    let result;
    if (password && password.trim() !== '') {
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password.trim(), salt);
      
      result = await db.query(
        'UPDATE users SET name = $1, email = $2, password = $3, country = $4 WHERE id = $5 RETURNING id, name, email, role, country, created_at',
        [name, email, hashedPassword, country, req.user.id]
      );
    } else {
      result = await db.query(
        'UPDATE users SET name = $1, email = $2, country = $3 WHERE id = $4 RETURNING id, name, email, role, country, created_at',
        [name, email, country, req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).send('Server Error');
  }
};
