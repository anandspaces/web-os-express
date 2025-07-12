// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAnonymous: { type: Boolean, default: false },
  sessionId: { type: String, unique: true }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);