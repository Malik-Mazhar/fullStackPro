import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res ) => {
    // Get user details from fronted
    // Validation
    // Check if user already exists: userName, email
    // Check for Image, Check for avatar
    // Upload them to cloudinary, avatar
    // Create user Object  - Create entry in db.
    // Remove password and refresh token filed from response
    // Return res

    const { username, email, fullName, password } = await req.body;
    console.log("email ..", email);

    if(
        [username, email, fullName, password].some((field) => field?.trim === "")
    ){
        throw new ApiError(400, "All fields are required")
    };

    const existedUser = await User.findOne({
        $or: [
            { email }, { password }
        ]
    });

    if(existedUser){
        throw new ApiError(409, "User with this email or password alredy exist")
    };

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    };

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    };

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    });

    const createdUser = await user.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registring a user")
    };

    return res.status(200).json(
        new ApiResponse(200, createdUser, "User registered Succesfully")
    )
});

export {
    registerUser
};