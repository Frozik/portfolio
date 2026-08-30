/** Four samples is the ratio of quality to bandwidth every WebGPU demo here settles on. */
export const MSAA_SAMPLE_COUNT = 4;

/**
 * The depth format the ground and everything standing on it share. They are
 * drawn in separate passes and must occlude each other, so the format — like the
 * texture itself — belongs to the scene rather than to a single layer.
 */
export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/**
 * A struct bound in the uniform address space is aligned — and so sized — to a
 * multiple of sixteen bytes, which a layout reflected off its members alone
 * stops short of. A buffer left at the reflected size fails validation against
 * the pipeline's minimum binding size.
 */
export const UNIFORM_ALIGNMENT_BYTES = 16;

/**
 * Frame-rate governor levels for the 3D session. The view is static unless the
 * camera moves or the plan changes, so the idle floor only has to be often
 * enough to notice that it did.
 */
export const FPS_IDLE = 10;
export const FPS_INTERACTION = 60;
export const FPS_ANIMATION = 60;
export const FPS_RESIZE = 60;
