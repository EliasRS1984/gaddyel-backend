import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('RefreshToken', refreshTokenSchema);
