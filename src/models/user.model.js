import mongoose, { Schema } from "mongoose";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, "password is required"],
    },
    fullName: {
        type: String,
        required: [true, "FullName is required"],
        trim: true,
        index: true
    },
    avatar: {
        type: String, //Cloudinary 3rd party
        required: true,
    },
    coverImage: {
        type: String, //Cloudinary 3rd party
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    refreshToken: {
        type: String,
    }
}, 
{
    timestamps: true 
});

userSchema.pre('save', async function(next){
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function(next) {
  return await bcrypt.compare(password, this.password)  
};

userSchema.methods.generateAccessToken = function (){
    return jwt.sign(
        {
        _id = this._id,
        username = this.username,
        fullName = this.fullName,
        email = this.email
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
};

userSchema.methods.generateRefreshToken = function (){
        return jwt.sign(
        {
        _id = this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.Model("User", userSchema);