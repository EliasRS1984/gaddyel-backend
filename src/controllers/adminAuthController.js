import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import RefreshToken from '../models/RefreshToken.js';
import bcrypt from 'bcryptjs';

const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_EXP_DAYS || 30);

function createRandomToken() {
  return crypto.randomBytes(40).toString('hex');
}

function signAccessToken(admin) {
  // Buscar la clave en varias variables de entorno por compatibilidad
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT signing secret not configured (check JWT_ACCESS_SECRET / JWT_SECRET_KEY / JWT_SECRET)');
  }
  return jwt.sign({ id: admin._id, usuario: admin.usuario, role: admin.role || 'admin' }, secret, { expiresIn: '15m' });
}

export const register = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'usuario y password requeridos' });

    const existing = await Admin.findOne({ usuario });
    if (existing) return res.status(400).json({ error: 'Usuario ya existe' });

    const hash = await bcrypt.hash(password, 10);
    const admin = new Admin({ usuario, password: hash });
    await admin.save();
    res.json({ ok: true, admin: { id: admin._id, usuario: admin.usuario } });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Error registrando admin' });
  }
};

export const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: 'usuario y password requeridos' });

    const admin = await Admin.findOne({ usuario });
    if (!admin) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const accessToken = signAccessToken(admin);
    const refreshToken = createRandomToken();
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await RefreshToken.create({ token: refreshToken, adminId: admin._id, expiresAt });

    // set httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    });

    res.json({ token: accessToken, admin: { id: admin._id, usuario: admin.usuario } });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Error en login' });
  }
};

export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const stored = await RefreshToken.findOne({ token });
    if (!stored) return res.status(401).json({ error: 'Refresh token inválido' });

    if (stored.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: stored._id });
      return res.status(401).json({ error: 'Refresh token expirado' });
    }

    // rotate
    await RefreshToken.deleteOne({ _id: stored._id });
    const newToken = createRandomToken();
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await RefreshToken.create({ token: newToken, adminId: stored.adminId, expiresAt });

    // set cookie
    res.cookie('refreshToken', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
    });

    const admin = await Admin.findById(stored.adminId);
    const accessToken = signAccessToken(admin);
    res.json({ token: accessToken });
  } catch (err) {
    console.error('refresh error', err);
    res.status(500).json({ error: 'Error en refresh' });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await RefreshToken.deleteOne({ token }).catch(() => {});
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) {
    console.error('logout error', err);
    res.status(500).json({ error: 'Error en logout' });
  }
};

export default { register, login, refresh, logout };
