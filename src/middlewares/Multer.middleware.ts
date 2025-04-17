import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const getDestinationFolder = (): string => {
      console.log("here, process.env: ", process.env.NODE_ENV);

      // using /tmp folder of vercel VM as it has write access
      if (process.env.NODE_ENV === "production") {
        const tempUploadDir = path.join(os.tmpdir(), "temp", "my-uploads");
        console.log("tempUploadDir: ", tempUploadDir);

        // Ensure the temporary directory exists (handle potential errors)
        try {
          if (!fs.existsSync(tempUploadDir)) {
            fs.mkdirSync(tempUploadDir, { recursive: true });
            console.log("!!!Temporary directory created!!!");
          }
        } catch (err) {
          console.error("!!!Error creating temporary directory:", err);
        }

        return tempUploadDir;
      }

      return "./public/temp/my-uploads";
    };
    cb(null, getDestinationFolder());
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

export const uploadFileInServer = multer({ storage });
