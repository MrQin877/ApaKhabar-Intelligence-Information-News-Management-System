export const cropPlatforms = {
    website: { label: 'Aplikasi', width: 1600, height: 900, ratio: '16:9' },
    instagram: { label: 'Instagram', width: 1080, height: 1080, ratio: '1:1' },
    facebook: {
        label: 'Facebook',
        width: 1200,
        height: 630,
        ratio: '1200:630',
    },
} as const;
export type CropPlatform = keyof typeof cropPlatforms;
export type CropType = 'portrait' | 'square' | 'landscape';
export type Crop = { x: number; y: number; zoom: number; type?: CropType };
export function imageOrientation(width: number, height: number): CropType {
    const ratio = width / height;

    return ratio < 0.9 ? 'portrait' : ratio > 1.1 ? 'landscape' : 'square';
}

// Exact output dimensions define the ratio, including landscape rounding.
export function cropSpec(platform: CropPlatform, crop: Crop) {
    const legacy = cropPlatforms[platform];

    if (platform === 'website' || !crop.type) {
        return legacy;
    }

    const sizes = {
        portrait: { width: 1080, height: 1350, ratio: '4:5' },
        square: { width: 1080, height: 1080, ratio: '1:1' },
        landscape: {
            width: platform === 'instagram' ? 1080 : 1200,
            height: platform === 'instagram' ? 566 : 630,
            ratio: '1.91:1',
        },
    };

    return { label: legacy.label, ...sizes[crop.type] };
}

export function initializeCrops(
    crops: ImageCrops,
    width: number,
    height: number,
): ImageCrops {
    const type = imageOrientation(width, height);

    return {
        ...crops,
        instagram: { ...crops.instagram, type: crops.instagram.type ?? type },
        facebook: { ...crops.facebook, type: crops.facebook.type ?? type },
    };
}
export type ImageCrops = { sync: boolean } & Record<CropPlatform, Crop>;
export const defaultCrops = (): ImageCrops => ({
    sync: true,
    website: { x: 0.5, y: 0.5, zoom: 1 },
    instagram: { x: 0.5, y: 0.5, zoom: 1 },
    facebook: { x: 0.5, y: 0.5, zoom: 1 },
});
export const clamp = (value: number, min = 0, max = 1) =>
    Math.max(min, Math.min(max, value));

export function updateCrop(
    previous: ImageCrops,
    platform: CropPlatform,
    crop: Crop,
): ImageCrops {
    const next = { ...previous, [platform]: crop };

    if (previous.sync) {
        for (const key of Object.keys(cropPlatforms) as CropPlatform[]) {
            next[key] = { ...next[key], x: crop.x, y: crop.y };
        }
    }

    return next;
}

// Keep integer source rectangles identical to NewsImageCropService.
export function cropRectangle(
    width: number,
    height: number,
    platform: CropPlatform,
    crop: Crop,
) {
    const spec = cropSpec(platform, crop);
    const ratio = spec.width / spec.height;
    const w = Math.max(
        1,
        Math.round(Math.min(width, height * ratio) / crop.zoom),
    );
    const h = Math.max(
        1,
        Math.round(Math.min(height, width / ratio) / crop.zoom),
    );

    return {
        width: w,
        height: h,
        x: Math.round(clamp(crop.x * width - w / 2, 0, width - w)),
        y: Math.round(clamp(crop.y * height - h / 2, 0, height - h)),
    };
}
