import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while while generating access and refresh tokens");
    }
};

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

    // console.log("avatarLocalPath", avatarLocalPath)

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    if(!avatar){
        throw new ApiError(400, "Avatar upload failed")
    };
    
    const user = await User.create({
        username: username.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    });

    const createdUser = await User.findById(user._id).select(     
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registring a user")
    };

    return res.status(200).json(
        new ApiResponse(200, createdUser, "User registered Succesfully")
    )
});


const loginUser = asyncHandler(async () => {
    // req.body = Get user deta
    // validation
    // check user already exiest or not Find the user
    // password verification
    // Genrate Access and refresh toke
    // sand cookie

    const { username, email, password } = req.body;

    if(!username || !email){
        throw new ApiError(400, "username or email required")
    };

    const user = await User.findOne({
        $or: [ { username } , { email }]
    });

    if(!user){
        throw new ApiError(404, "user does not exist")
    };

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError("Invalid user credentials")
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(" -password -refreshToken ");

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "user logged in Successfully"
      )
    )

});

const logoutUser = asyncHandler( async (req, res ) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logOut SuccessFully!"))
});
export {
    registerUser,
    loginUser,
    logoutUser
};