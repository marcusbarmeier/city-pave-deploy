const functions = require("firebase-functions");
const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Core Logic for Processing Dashcam Uploads
 * Separated for easier unit testing.
 */
exports.processFile = async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;

    // 1. Validate Trigger Conditions
    if (!filePath.startsWith("dashcam_videos/")) {
        return console.log("Skipping: Not in dashcam path.");
    }
    if (!contentType.startsWith("video/")) {
        return console.log("Skipping: Not a video.");
    }
    if (filePath.endsWith("thumb.jpg")) {
        return console.log("Skipping: Already a thumbnail.");
    }

    const fileName = path.basename(filePath);
    const bucket = admin.storage().bucket(fileBucket);

    // Path: dashcam_videos/{uid}/{timestamp}.webm
    const parts = filePath.split('/');
    const uid = parts.length > 2 ? parts[1] : 'unknown';

    console.log(`Processing video: ${filePath} for User: ${uid}`);

    // 2. Setup Temp Paths
    const workingDir = path.join(os.tmpdir(), "dashcam_process");
    const tempFilePath = path.join(workingDir, fileName);
    const tempThumbPath = path.join(workingDir, `${path.parse(fileName).name}_thumb.jpg`);

    await fs.ensureDir(workingDir);

    try {
        // 3. Download File
        await bucket.file(filePath).download({ destination: tempFilePath });
        console.log("File downloaded locally.");

        // 4. Generate Thumbnail
        await new Promise((resolve, reject) => {
            ffmpeg(tempFilePath)
                .screenshots({
                    count: 1,
                    folder: workingDir,
                    filename: path.basename(tempThumbPath),
                    size: '320x?',
                })
                .on('end', resolve)
                .on('error', reject);
        });
        console.log("Thumbnail generated.");

        // 5. Upload Thumbnail
        const thumbStoragePath = filePath.replace("dashcam_videos/", "dashcam_thumbs/").replace(".webm", ".jpg");

        await bucket.upload(tempThumbPath, {
            destination: thumbStoragePath,
            metadata: { contentType: 'image/jpeg' }
        });
        const thumbFile = bucket.file(thumbStoragePath);

        // Obsolete: const [thumbUrl] = await thumbFile.getSignedUrl({ ... });
        // Use a simpler approach or the same logic. Let's keep signed URL for test.
        const [thumbUrl] = await thumbFile.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'
        });

        console.log("Thumbnail uploaded:", thumbUrl);

        // 6. Update Firestore (Remote Indexing)
        const timestampStr = path.parse(fileName).name;

        const clipsRef = admin.firestore().collection("dashcam_clips");
        const snapshot = await clipsRef
            .where("userId", "==", uid)
            .where("timestamp", "==", timestampStr)
            .limit(1)
            .get();

        let docRef;

        if (!snapshot.empty) {
            docRef = snapshot.docs[0].ref;
            console.log("Found existing Firestore doc:", docRef.id);
        } else {
            console.log("No matching doc found. Creating new index.");
            docRef = clipsRef.doc();
            await docRef.set({
                userId: uid,
                timestamp: timestampStr,
                url: object.mediaLink || `gs://${fileBucket}/${filePath}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                recovered: true
            });
        }

        // Update the Doc
        await docRef.set({
            thumbnailUrl: thumbUrl,
            processed: true,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            sizeBytes: object.size,
            contentType: object.contentType
        }, { merge: true });

        console.log("Firestore updated.");

    } catch (err) {
        console.error("Error processing dashcam video:", err);
        // Don't rethrow to avoid endless retries in Cloud Functions?
        // Or rethrow to retry. For now, log.
    } finally {
        // 7. Cleanup
        await fs.remove(workingDir);
    }
};

/**
 * Process Dashcam Upload
 * Triggers when a new file is uploaded to Storage.
 */
const { onObjectFinalized } = require("firebase-functions/v2/storage");

/**
 * Process Dashcam Upload
 * Triggers when a new file is uploaded to Storage.
 */
exports.processDashcamUpload = onObjectFinalized(async (event) => {
    return exports.processFile(event.data);
});
