import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

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

const registerUser = asyncHandler(async ( req, res ) => {
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


const loginUser = asyncHandler(async ( req, res ) => {
    // req.body = Get user deta
    // validation
    // check user already exiest or not Find the user
    // password verification
    // Genrate Access and refresh toke
    // sand cookie

    const { username, email, password } = req.body;

    if(!username && !email){
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

const logoutUser = asyncHandler(async ( req, res ) => {
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

const refreshAccessToken = asyncHandler(async ( req, res ) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
       throw new ApiError(401, "Unuthorize request")
   };

  try {
     const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  
     const user = await User.findById(decodedToken?._id);
  
     if(!user){
         throw new ApiError(401, "Invalid refresh Token")
     };
  
     if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh token is expired or used")
     };
  
      const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);
  
      const options = {
          httpOnly: true,
          secure: true
      };
  
      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
           accessToken, refreshToken: newRefreshToken
          },
          "Access Token Refreshed Successfully"
        )
      )
  
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh tokens")
  }
});

const changeCurrentPassword = asyncHandler(async ( req, res ) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isCorrectPassword = await user.isPasswordCorrect(oldPassword);
    if(!isCorrectPassword){
        throw new ApiError(401, "Invalid password")
    };

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "changed password successfully!")
    );

});

const getCurrentUser = asyncHandler(async ( req, res ) => {
    return res
    .status(200)
    .json(200, req.user, "current user fatched successfully!")
});

const updateAccountDetails = asyncHandler(async ( req, res ) => {
    const { fullName, email } = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All filed are required for update")
    };

    const updatetedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res
    .status(200)
    .json(200, updatetedUser, "Account detail updated")
});

const updateUserAvatar = asyncHandler(async ( req, res ) => {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "updated avater file is missing");
    };

    const avatar = await uploadOnCloudinary(avatarLocalPath);
     
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar");
    };

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar Image updated Successfully")
    );
});

const updateUserCoverImage = asyncHandler(async ( req, res ) => {
    const coverImgLocalPath = req.file?.path;
    if(!coverImgLocalPath){
        throw new ApiError(400, "updated cover Image file is missing");
    };

    const coverImage = await uploadOnCloudinary(coverImgLocalPath);
     
    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on cover Image");
    };

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "cover Image updated Successfully")
    );
});

const getUserChannelProfile = asyncHandler(async ( req, res ) => {
    const { username } = req.params

    if(!username?.trim()) {
        throw new ApiError(400, "username is mising")
    };

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1, 
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if (!channel?.length){
        throw new ApiError(404, "channel does not exist")
    };

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "user channel fetched successfully")
    )
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};