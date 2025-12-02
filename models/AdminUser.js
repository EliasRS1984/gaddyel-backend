const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  
  name: { type: String, required: true },
  
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
    default: 'ADMIN'
  },
  
  permissions: [String],
  
  isActive: { type: Boolean, default: true },
  
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password antes de guardar
AdminUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
AdminUserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Método para validar lock
AdminUserSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Método para incrementar intentos fallidos
AdminUserSchema.methods.incLoginAttempts = async function() {
  // Reset si han pasado 2 horas
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock si ha habido 5 intentos fallidos
  const maxAttempts = 5;
  const lockTimeInHours = 2;
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTimeInHours * 60 * 60 * 1000) };
  }
  
  return this.updateOne(updates);
};

// Método para reset de intentos
AdminUserSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model('AdminUser', AdminUserSchema);
