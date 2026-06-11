import { v2 as Cloudinary } from "cloudinary";
import fs from "fs"

Cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;

        const response = await Cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        // console.log("File is Uploaded on cloudinary", response.url);
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        console.log("Cloudinary response failed:", error.response);

        fs.unlinkSync(localFilePath);

        return null;
    }
};


export { uploadOnCloudinary }