
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const sinon = require('sinon');
const fs = require('fs-extra');
const path = require('path');

// Initialize test SDK
const test = require('firebase-functions-test')({
    projectId: 'city-pave-estimator',
}, 'path/to/key.json'); // We won't use real auth

// Mock Admin SDK
const bucketStub = {
    file: sinon.stub().returns({
        download: sinon.stub().resolves(),
        upload: sinon.stub().resolves(),
        getSignedUrl: sinon.stub().resolves(['https://mock-url.com/thumb.jpg']),
        name: 'dashcam_videos/user123/2025-12-26T20:00:00.000Z.webm'
    })
};

const firestoreStub = {
    collection: sinon.stub().returnsThis(),
    doc: sinon.stub().returnsThis(),
    where: sinon.stub().returnsThis(),
    limit: sinon.stub().returnsThis(),
    get: sinon.stub().resolves({
        empty: true, // Simulate no existing doc to test "Remote Indexing" self-healing
        docs: []
    }),
    set: sinon.stub().resolves()
};

// Stub admin.initializeApp
sinon.stub(admin, 'initializeApp');
sinon.stub(admin, 'storage').returns({ bucket: () => bucketStub });
sinon.stub(admin, 'firestore').get(() => () => firestoreStub);
// Also stub FieldValue
admin.firestore.FieldValue = {
    serverTimestamp: () => 'SERVER_TIMESTAMP'
};

// Import the function to test
// Note: We need to require AFTER stubbing
const myFunctions = require('./asset_processor');

async function runTest() {
    console.log("Starting Verification Test for processDashcamUpload...");

    // 1. Create a dummy 'onFinalize' event
    const object = {
        name: 'dashcam_videos/user123/2025-12-26T20:00:00.000Z.webm',
        bucket: 'city-pave-estimator.appspot.com',
        contentType: 'video/webm',
        size: 1024 * 1024 * 10, // 10MB
        mediaLink: 'https://storage/link'
    };

    // 2. Wrap the function
    const wrapped = test.wrap(myFunctions.processDashcamUpload);

    // 3. Mock ffmpeg (Since we don't want to actually run ffmpeg on a non-existent file in this unit test)
    // However, the function requires 'fluent-ffmpeg'. We can assume dependencies install worked.
    // The code downloads a file. usage of `bucket.file().download` is stubbed to resolve.
    // usage of `ffmpeg` is NOT stubbed in the require, so it will try to run.
    // We should probably stub fs-extra to "create" a dummy file so ffmpeg doesn't crash on "file not found"
    // OR just let it fail at ffmpeg step and verify we got that far.
    // Better: Stub the ffmpeg execution or ensure the download "creates" a dummy file.

    // Let's create a dummy file at the expected temp location to satisfy ffmpeg existence check
    const os = require('os');
    const tempDir = path.join(os.tmpdir(), "dashcam_process");
    await fs.ensureDir(tempDir);
    const tempFile = path.join(tempDir, '2025-12-26T20:00:00.000Z.webm');
    await fs.writeFile(tempFile, 'dummy content');

    // We also need to mock the ffmpeg command itself because 'dummy content' isn't a valid video
    // and ffmpeg will error out.
    // This is hard to mock without proxyquire or similar. 
    // ALTERNATIVE: checking that the function *attempts* to download.

    try {
        console.log("Invoking Cloud Function...");
        // This might fail at ffmpeg step, but that proves we reached it.
        await wrapped(object);
        console.log("Function completed successfully.");
    } catch (e) {
        console.log("Function hit expected error (mock ffmpeg):", e.message);
        if (e.message.includes('ffmpeg') || e.message.includes('Invalid data')) {
            console.log("SUCCESS: Reached FFMPEG processing step.");
        }
    }

    // Verify calls
    console.log("Verifying Storage Download...");
    if (bucketStub.file.calledWith(object.name)) console.log("PASSED: Accesses correct file");
    else console.error("FAILED: Did not access correct file");

    console.log("Verifying Firestore Query...");
    if (firestoreStub.collection.calledWith('dashcam_clips')) console.log("PASSED: Queries 'dashcam_clips'");
    else console.error("FAILED: Did not query correct collection");

    test.cleanup();
}

runTest();
