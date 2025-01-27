const express = require("express");
const multer = require("multer");
const archiver = require("archiver");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");

const app = express();
const PORT = 3241;

const authenticate = (req, res, next) => {
    if (req.headers.pass !== "fox") {
        return res.status(403).json({ error: "Unauthorized" });
    }
    next();
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folderPath = path.join(__dirname, req.params.folder);
        fse.ensureDirSync(folderPath);
        cb(null, folderPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname) === ".jar") {
            cb(null, true);
        } else {
            cb(new Error("Only .jar files are allowed"));
        }
    },
});

app.post("/:folder/upload", authenticate, upload.array("files[]", 100), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
    }
    const uploadedFiles = req.files.map(file => ({
        originalname: file.originalname,
        path: file.path,
        size: file.size,
    }));

    res.json({ message: "Files uploaded successfully", files: uploadedFiles });
});

app.get("/:folder", (req, res) => {
    const folderPath = path.join(__dirname, req.params.folder);

    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: "Folder not found" });
    }

    const files = fs.readdirSync(folderPath);
    if (files.length === 0) {
        return res.status(200).json({ message: "Folder is empty" });
    }

    const zipFileName = `${req.params.folder}.zip`;
    res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=${zipFileName}`,
    });

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize().catch((err) => {
        console.error(err);
        res.status(500).json({ error: "Failed to create ZIP" });
    });
});

app.get("/:folder/get/:file", (req, res) => {
    const filePath = path.join(__dirname, req.params.folder, req.params.file);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath);
});

app.get("/:folder/info", (req, res) => {
    const folderPath = path.join(__dirname, req.params.folder);

    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: "Folder not found" });
    }

    const files = fs.readdirSync(folderPath).map((file) => {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);

        return {
            name: file,
            size: stats.size,
            lastModified: stats.mtime,
        };
    });

    res.json(files);
});

app.delete("/:folder/:file", authenticate, (req, res) => {
    const filePath = path.join(__dirname, req.params.folder, req.params.file);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    fs.unlinkSync(filePath);
    res.json({ message: "File deleted successfully" });
});

app.use((req, res, next) => {
    res.status(404).json({ error: "Not found" });
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

