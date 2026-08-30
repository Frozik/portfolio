import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

/**
 * A parsed model ready for the textured pipeline: world-space-ready triangles
 * with the texture coordinates that paint them. One material per asset — the
 * palette-textured low-poly kits this loader exists for use exactly one.
 */
export interface TexturedAssetMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

const FLOAT32 = 5126;
const BYTES_PER_FLOAT = 4;
const UINT16 = 5123;
const UINT32 = 5125;

const COMPONENTS: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

interface GltfAccessor {
  readonly bufferView: number;
  readonly byteOffset?: number;
  readonly componentType: number;
  readonly count: number;
  readonly type: string;
}

interface GltfBufferView {
  readonly byteOffset?: number;
  readonly byteLength: number;
  readonly byteStride?: number;
}

interface GltfPrimitive {
  readonly attributes: Readonly<Record<string, number>>;
  readonly indices: number;
}

interface GltfNode {
  readonly mesh?: number;
  readonly children?: readonly number[];
  readonly translation?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number, number];
  readonly scale?: readonly [number, number, number];
}

interface GltfDocument {
  readonly accessors: readonly GltfAccessor[];
  readonly bufferViews: readonly GltfBufferView[];
  readonly meshes: readonly { readonly primitives: readonly GltfPrimitive[] }[];
  readonly nodes: readonly GltfNode[];
  readonly scenes: readonly { readonly nodes: readonly number[] }[];
  readonly scene?: number;
}

/**
 * Reads the subset of a binary glTF this feature needs: every primitive of the
 * default scene, its node transforms baked into the positions and normals,
 * concatenated into one indexed mesh. Materials, skins, animations and
 * embedded images are out of scope — the palette texture ships as its own
 * file next to the model.
 */
export function parseGlb(buffer: ArrayBuffer): TexturedAssetMesh {
  const header = new DataView(buffer);

  assert(header.getUint32(0, true) === GLB_MAGIC, 'not a GLB file');

  const jsonLength = header.getUint32(HEADER_BYTES, true);

  assert(header.getUint32(HEADER_BYTES + 4, true) === JSON_CHUNK, 'first GLB chunk must be JSON');

  const jsonStart = HEADER_BYTES + CHUNK_HEADER_BYTES;
  const document = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, jsonStart, jsonLength))
  ) as GltfDocument;

  const binaryHeaderStart = jsonStart + jsonLength;

  assert(
    header.getUint32(binaryHeaderStart + 4, true) === BINARY_CHUNK,
    'second GLB chunk must be binary'
  );

  const binaryStart = binaryHeaderStart + CHUNK_HEADER_BYTES;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const dataView = new DataView(buffer);

  // Copied element by element through a DataView: buffer views may interleave
  // attributes with a stride, and their offsets owe the typed arrays no
  // alignment.
  const readFloats = (accessorIndex: number, componentCount: number): Float32Array => {
    const accessor = document.accessors[accessorIndex];

    assert(accessor.componentType === FLOAT32, 'expected float accessor');
    assert(COMPONENTS[accessor.type] === componentCount, 'unexpected accessor arity');

    const view = document.bufferViews[accessor.bufferView];
    const stride = view.byteStride ?? componentCount * BYTES_PER_FLOAT;
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = new Float32Array(accessor.count * componentCount);

    for (let element = 0; element < accessor.count; element += 1) {
      for (let component = 0; component < componentCount; component += 1) {
        values[element * componentCount + component] = dataView.getFloat32(
          start + element * stride + component * BYTES_PER_FLOAT,
          true
        );
      }
    }

    return values;
  };

  const readIndices = (accessorIndex: number): Uint32Array => {
    const accessor = document.accessors[accessorIndex];
    const view = document.bufferViews[accessor.bufferView];
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = new Uint32Array(accessor.count);

    if (accessor.componentType === UINT16) {
      for (let element = 0; element < accessor.count; element += 1) {
        values[element] = dataView.getUint16(start + element * 2, true);
      }
    } else {
      assert(accessor.componentType === UINT32, 'unsupported index component type');

      for (let element = 0; element < accessor.count; element += 1) {
        values[element] = dataView.getUint32(start + element * 4, true);
      }
    }

    return values;
  };

  const appendNode = (nodeIndex: number, parent: NodeTransform): void => {
    const node = document.nodes[nodeIndex];
    const transform = composeTransforms(parent, nodeTransformOf(node));

    if (!isNil(node.mesh)) {
      for (const primitive of document.meshes[node.mesh].primitives) {
        const vertexBase = positions.length / 3;
        const primitivePositions = readFloats(primitive.attributes.POSITION, 3);
        const primitiveNormals = readFloats(primitive.attributes.NORMAL, 3);
        const primitiveUvs = readFloats(primitive.attributes.TEXCOORD_0, 2);

        for (let vertex = 0; vertex < primitivePositions.length; vertex += 3) {
          const transformed = applyTransform(transform, [
            primitivePositions[vertex],
            primitivePositions[vertex + 1],
            primitivePositions[vertex + 2],
          ]);
          const rotatedNormal = rotateByQuaternion(transform.rotation, [
            primitiveNormals[vertex],
            primitiveNormals[vertex + 1],
            primitiveNormals[vertex + 2],
          ]);

          positions.push(transformed[0], transformed[1], transformed[2]);
          normals.push(rotatedNormal[0], rotatedNormal[1], rotatedNormal[2]);
        }

        for (const uv of primitiveUvs) {
          uvs.push(uv);
        }

        for (const index of readIndices(primitive.indices)) {
          indices.push(vertexBase + index);
        }
      }
    }

    for (const child of node.children ?? []) {
      appendNode(child, transform);
    }
  };

  const scene = document.scenes[document.scene ?? 0];

  for (const nodeIndex of scene.nodes) {
    appendNode(nodeIndex, IDENTITY_TRANSFORM);
  }

  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    uvs: Float32Array.from(uvs),
    indices: Uint32Array.from(indices),
  };
}

/** Translation · rotation · scale, composed parent-first the way glTF nests. */
interface NodeTransform {
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
}

const IDENTITY_TRANSFORM: NodeTransform = {
  translation: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function nodeTransformOf(node: GltfNode): NodeTransform {
  return {
    translation: node.translation ?? IDENTITY_TRANSFORM.translation,
    rotation: node.rotation ?? IDENTITY_TRANSFORM.rotation,
    scale: node.scale ?? IDENTITY_TRANSFORM.scale,
  };
}

function composeTransforms(parent: NodeTransform, child: NodeTransform): NodeTransform {
  const scaledChild: readonly [number, number, number] = [
    child.translation[0] * parent.scale[0],
    child.translation[1] * parent.scale[1],
    child.translation[2] * parent.scale[2],
  ];
  const rotatedChild = rotateByQuaternion(parent.rotation, scaledChild);

  return {
    translation: [
      parent.translation[0] + rotatedChild[0],
      parent.translation[1] + rotatedChild[1],
      parent.translation[2] + rotatedChild[2],
    ],
    rotation: multiplyQuaternions(parent.rotation, child.rotation),
    scale: [
      parent.scale[0] * child.scale[0],
      parent.scale[1] * child.scale[1],
      parent.scale[2] * child.scale[2],
    ],
  };
}

function applyTransform(
  transform: NodeTransform,
  point: readonly [number, number, number]
): readonly [number, number, number] {
  const scaled: readonly [number, number, number] = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2],
  ];
  const rotated = rotateByQuaternion(transform.rotation, scaled);

  return [
    rotated[0] + transform.translation[0],
    rotated[1] + transform.translation[1],
    rotated[2] + transform.translation[2],
  ];
}

function rotateByQuaternion(
  quaternion: readonly [number, number, number, number],
  vector: readonly [number, number, number]
): readonly [number, number, number] {
  const [qx, qy, qz, qw] = quaternion;
  const [vx, vy, vz] = vector;
  // v' = v + 2 · q×(q×v + w·v) — the standard quaternion sandwich, expanded.
  const cx = qy * vz - qz * vy + qw * vx;
  const cy = qz * vx - qx * vz + qw * vy;
  const cz = qx * vy - qy * vx + qw * vz;

  return [vx + 2 * (qy * cz - qz * cy), vy + 2 * (qz * cx - qx * cz), vz + 2 * (qx * cy - qy * cx)];
}

function multiplyQuaternions(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number]
): readonly [number, number, number, number] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;

  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
