import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      default: ''
    },
    picture: {
      type: String,
      default: ''
    },
    googleTokens: {
      accessToken: {
        type: String,
        default: null
      },
      refreshToken: {
        type: String,
        default: null
      },
      expiryDate: {
        type: Number,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

// Never serialize tokens to JSON response for frontend security
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.googleTokens;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
