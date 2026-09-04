// Splits a single Part's triangle soup into its connected components --
// same technique the reference project uses to separate a STEP compound
// that got tessellated as one "rigid" piece but is actually several loose
// bodies. Works purely on the already-tessellated geometry (no OCCT needed
// here), so it applies equally to STEP/STL/OBJ/glTF imports.
import type { Part, PartGeometry } from "../types/domain";
import { nextId } from "../assembly/store";

const WELD_EPS = 1e-4;

class UnionFind {
  parent: Int32Array;
  constructor(n: number) {
    this.parent = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

function weldKey(x: number, y: number, z: number): string {
  const inv = 1 / WELD_EPS;
  return `${Math.round(x * inv)}_${Math.round(y * inv)}_${Math.round(z * inv)}`;
}

interface MeshComponent {
  geometry: PartGeometry;
  centroid: [number, number, number];
}

export function splitByConnectivity(geom: PartGeometry): MeshComponent[] {
  const positions = geom.positions;
  const indices = geom.indices;
  const vertexCount = positions.length / 3;

  // weld vertices sharing (almost) the same position into groups
  const weldGroup = new Int32Array(vertexCount);
  const keyToGroup = new Map<string, number>();
  let groupCount = 0;
  for (let i = 0; i < vertexCount; i++) {
    const key = weldKey(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    let g = keyToGroup.get(key);
    if (g === undefined) {
      g = groupCount++;
      keyToGroup.set(key, g);
    }
    weldGroup[i] = g;
  }

  const uf = new UnionFind(groupCount);
  const triCount = indices.length / 3;
  for (let t = 0; t < triCount; t++) {
    const a = weldGroup[indices[t * 3]];
    const b = weldGroup[indices[t * 3 + 1]];
    const c = weldGroup[indices[t * 3 + 2]];
    uf.union(a, b);
    uf.union(b, c);
  }

  // assign each triangle to a component (root of its first vertex's weld group)
  const triComponent = new Int32Array(triCount);
  const componentRootToIndex = new Map<number, number>();
  let componentCount = 0;
  for (let t = 0; t < triCount; t++) {
    const root = uf.find(weldGroup[indices[t * 3]]);
    let ci = componentRootToIndex.get(root);
    if (ci === undefined) {
      ci = componentCount++;
      componentRootToIndex.set(root, ci);
    }
    triComponent[t] = ci;
  }

  if (componentCount <= 1) {
    return [{ geometry: geom, centroid: [0, 0, 0] }];
  }

  const components: MeshComponent[] = [];
  for (let ci = 0; ci < componentCount; ci++) {
    const localIndexOf = new Map<number, number>();
    const outPositions: number[] = [];
    const outNormals: number[] = [];
    const outIndices: number[] = [];

    for (let t = 0; t < triCount; t++) {
      if (triComponent[t] !== ci) continue;
      for (let k = 0; k < 3; k++) {
        const srcIdx = indices[t * 3 + k];
        let localIdx = localIndexOf.get(srcIdx);
        if (localIdx === undefined) {
          localIdx = outPositions.length / 3;
          outPositions.push(
            positions[srcIdx * 3],
            positions[srcIdx * 3 + 1],
            positions[srcIdx * 3 + 2]
          );
          outNormals.push(
            geom.normals[srcIdx * 3],
            geom.normals[srcIdx * 3 + 1],
            geom.normals[srcIdx * 3 + 2]
          );
          localIndexOf.set(srcIdx, localIdx);
        }
        outIndices.push(localIdx);
      }
    }

    let cx = 0,
      cy = 0,
      cz = 0;
    const n = outPositions.length / 3;
    for (let i = 0; i < n; i++) {
      cx += outPositions[i * 3];
      cy += outPositions[i * 3 + 1];
      cz += outPositions[i * 3 + 2];
    }
    cx /= n;
    cy /= n;
    cz /= n;

    for (let i = 0; i < n; i++) {
      outPositions[i * 3] -= cx;
      outPositions[i * 3 + 1] -= cy;
      outPositions[i * 3 + 2] -= cz;
    }

    components.push({
      geometry: {
        positions: new Float32Array(outPositions),
        normals: new Float32Array(outNormals),
        indices:
          n > 65535
            ? new Uint32Array(outIndices)
            : new Uint16Array(outIndices),
      },
      centroid: [cx, cy, cz],
    });
  }

  return components;
}

/** True if this part's mesh is more than one connected component. */
export function isMultiBody(part: Part): boolean {
  return splitByConnectivity(part.geometry).length > 1;
}

function quatRotate(
  q: [number, number, number, number],
  v: [number, number, number]
): [number, number, number] {
  // v' = q * v * q^-1, standard quaternion-vector rotation
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

/** Splits `part` (currently posed at `pose`) into its connected components,
 * returning new Parts positioned so the overall assembly looks unchanged. */
export function splitPartIntoParts(
  part: Part,
  pose: { position: [number, number, number]; quaternion: [number, number, number, number]; scale: [number, number, number] }
): Part[] {
  const components = splitByConnectivity(part.geometry);
  if (components.length <= 1) return [part];

  return components.map((comp, i) => {
    const worldOffset = quatRotate(pose.quaternion, [
      comp.centroid[0] * pose.scale[0],
      comp.centroid[1] * pose.scale[1],
      comp.centroid[2] * pose.scale[2],
    ]);
    const position: [number, number, number] = [
      pose.position[0] + worldOffset[0],
      pose.position[1] + worldOffset[1],
      pose.position[2] + worldOffset[2],
    ];
    return {
      id: nextId("part"),
      name: `${part.name} (${i + 1})`,
      geometry: comp.geometry,
      basePose: { position, quaternion: pose.quaternion, scale: pose.scale },
      color: part.color,
      visible: true,
    };
  });
}
