const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

/**
 * Registrar usuario admin (solo para inicialización)
 */
exports.registerAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validaciones
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verificar si existe
    const existing = await AdminUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Crear usuario
    const user = new AdminUser({
      email,
      password,
      name,
      role: 'SUPER_ADMIN' // Primer usuario es SUPER_ADMIN
    });

    await user.save();

    // Generar token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Admin user created successfully',
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error registering admin:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Login de admin
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Buscar usuario
    const user = await AdminUser.findOne({ email });
    if (!user) {
      // Registrar intento fallido (sin revelar si existe)
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verificar si está bloqueado
    if (user.isLocked()) {
      return res.status(403).json({ error: 'Account is temporarily locked' });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Incrementar intentos fallidos
      await user.incLoginAttempts();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset intentos fallidos
    await user.resetLoginAttempts();

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Generar token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener perfil del usuario
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user._id).select('-password');

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error getting profile:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Cambiar contraseña
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const user = await AdminUser.findById(req.user._id);

    // Verificar contraseña actual
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Listar usuarios admin
 */
exports.listUsers = async (req, res) => {
  try {
    const users = await AdminUser.find()
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error listing users:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Crear nuevo usuario admin
 */
exports.createUser = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Solo SUPER_ADMIN puede crear usuarios
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can create users' });
    }

    // Validaciones
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verificar si existe
    const existing = await AdminUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Crear usuario
    const user = new AdminUser({
      email,
      password,
      name,
      role: role || 'ADMIN'
    });

    await user.save();

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error creating user:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Eliminar usuario admin
 */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Solo SUPER_ADMIN puede eliminar usuarios
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can delete users' });
    }

    // No permitir auto-eliminarse
    if (req.user._id.toString() === userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const user = await AdminUser.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
