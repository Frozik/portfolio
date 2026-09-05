// The sky and the terrain are the same geometry: one quad covering the whole 800 × 500 field,
// letterboxed inside the canvas by the shared world transform. Only their fragment stage differs.

struct FieldQuadVSOut {
    @builtin(position) position: vec4<f32>,
    // 0..1 across the field, with v = 0 at the field ceiling — the terrain texture's row order.
    @location(0) uv: vec2<f32>,
};

const FIELD_QUAD_CORNERS = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
);

// The screen shake slides the whole world transform, which would otherwise drag the
// letterbox background into view along the edge it moves away from. The two background layers are
// therefore drawn a shake's worth larger than the field on every side. Both samplers clamp to the
// edge, so the extra band is the terrain's own outermost row (dirt below, sky above) rather than a
// seam, and the shake never reaches far enough for the stretch to be visible.
@vertex
fn vsFieldQuad(@builtin(vertex_index) vertexIndex: u32) -> FieldQuadVSOut {
    let corner = FIELD_QUAD_CORNERS[vertexIndex];
    let overscan = vec2<f32>(U.shakeOverscanWu) / U.fieldSize;
    let uv = mix(-overscan, 1.0 + overscan, corner);
    let worldPosition = vec2<f32>(uv.x, 1.0 - uv.y) * U.fieldSize;

    var out: FieldQuadVSOut;
    out.position = worldToClip(worldPosition);
    out.uv = uv;

    return out;
}
