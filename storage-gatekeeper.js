// Storage Gatekeeper
// Handles client-side compression, storage quotas, and FinOps tracking.

export const StorageGatekeeper = {
    // --- Configuration ---
    MAX_IMAGE_WIDTH: 1920,
    JPEG_QUALITY: 0.7, // 70% quality
    QUOTA_LIMIT_MB: 1024, // 1GB for Starter Tier

    // --- State ---
    currentUsageMB: 450, // Mock usage

    /**
     * Compresses an image file before upload.
     * @param {File} file - The image file to compress.
     * @returns {Promise<Blob>} - The compressed image blob.
     */
    compressImage: async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;
            };

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize if too large
                if (width > StorageGatekeeper.MAX_IMAGE_WIDTH) {
                    height = Math.round(height * (StorageGatekeeper.MAX_IMAGE_WIDTH / width));
                    width = StorageGatekeeper.MAX_IMAGE_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP for better compression
                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`[Gatekeeper] Compressed ${file.name}: ${(file.size / 1024).toFixed(2)}KB -> ${(blob.size / 1024).toFixed(2)}KB`);
                        resolve(blob);
                    } else {
                        reject(new Error("Compression failed"));
                    }
                }, 'image/webp', StorageGatekeeper.JPEG_QUALITY);
            };

            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Checks if the tenant has enough storage quota.
     * @param {number} fileSizeByte 
     * @returns {boolean}
     */
    checkQuota: (fileSizeByte) => {
        const fileSizeMB = fileSizeByte / (1024 * 1024);
        if (StorageGatekeeper.currentUsageMB + fileSizeMB > StorageGatekeeper.QUOTA_LIMIT_MB) {
            alert("⚠️ Storage Quota Exceeded!\n\nPlease upgrade to the Titan Plan for unlimited storage.");
            return false;
        }
        return true;
    },

    /**
     * Tracks a successful upload.
     * @param {number} fileSizeByte 
     */
    trackUpload: (fileSizeByte) => {
        const fileSizeMB = fileSizeByte / (1024 * 1024);
        StorageGatekeeper.currentUsageMB += fileSizeMB;
        console.log(`[FinOps] Storage usage updated: ${StorageGatekeeper.currentUsageMB.toFixed(2)} MB`);
        // In real app: Update Firestore 'tenant_usage' doc
    },

    /**
     * Returns current usage stats.
     */
    getStats: () => {
        return {
            used: StorageGatekeeper.currentUsageMB,
            limit: StorageGatekeeper.QUOTA_LIMIT_MB,
            percent: (StorageGatekeeper.currentUsageMB / StorageGatekeeper.QUOTA_LIMIT_MB) * 100
        };
    }
};
