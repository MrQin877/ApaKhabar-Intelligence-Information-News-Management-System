export type VideoCrop = {
    x: number;
    y: number;
    zoom: number;
    start: number;
    end: number;
};

export function cropRectangle(width: number, height: number, crop: VideoCrop) {
    const unit = Math.floor(Math.min(width / 18, height / 32) / crop.zoom);
    const w = unit * 18;
    const h = unit * 32;

    return {
        width: w,
        height: h,
        x: Math.floor(((width - w) * crop.x) / 2) * 2,
        y: Math.floor(((height - h) * crop.y) / 2) * 2,
    };
}

export function cropChanged(
    width: number,
    height: number,
    duration: number,
    crop: VideoCrop,
    previous?: VideoCrop,
) {
    const rect = cropRectangle(width, height, crop);

    if (!previous) {
        return (
            rect.width !== width ||
            rect.height !== height ||
            crop.start !== 0 ||
            Math.abs(crop.end - duration) >= 0.001
        );
    }

    return (
        JSON.stringify(rect) !==
            JSON.stringify(cropRectangle(width, height, previous)) ||
        Math.abs(crop.start - previous.start) >= 0.001 ||
        Math.abs(crop.end - previous.end) >= 0.001
    );
}
