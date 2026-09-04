// Turns an OCCT TopoDS_Shape into the same plain Float32Array triangle soup
// that importers/loadModel.ts produces for STL/OBJ/glTF, so the rest of the
// app (Viewport, store) never has to know a part came from a B-Rep.
import type { Part, PartGeometry } from "../types/domain";
import { nextId } from "../assembly/store";
import type { OccBody } from "./stepImport";

const LINEAR_DEFLECTION = 0.15; // mm
const ANGULAR_DEFLECTION = 0.4; // rad

function transformPoint(oc: any, pnt: any, trsf: any): [number, number, number] {
  const p = pnt.Transformed(trsf);
  const x = p.X();
  const y = p.Y();
  const z = p.Z();
  p.delete?.();
  void oc;
  return [x, y, z];
}

function tessellateBody(oc: any, shape: any): PartGeometry | null {
  new oc.BRepMesh_IncrementalMesh_2(
    shape,
    LINEAR_DEFLECTION,
    false,
    ANGULAR_DEFLECTION,
    false
  );

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triHandle = oc.BRep_Tool.Triangulation(face, location);
    const tri = triHandle?.get ? triHandle.get() : triHandle;

    if (tri && !tri.IsNull?.()) {
      const trsf = location.Transformation();
      const reversed =
        face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;

      const nbNodes = tri.NbNodes();
      const nodeStart = positions.length / 3;
      const nodePositions: [number, number, number][] = [];
      for (let i = 1; i <= nbNodes; i++) {
        const pnt = tri.Node(i);
        nodePositions.push(transformPoint(oc, pnt, trsf));
      }

      const nbTriangles = tri.NbTriangles();
      const faceVerts: number[] = [];
      const faceNormals: number[] = [];
      const faceIndices: number[] = [];
      const vertMap = new Map<number, number>();

      function localIndex(n: number): number {
        let li = vertMap.get(n);
        if (li === undefined) {
          li = faceVerts.length / 3;
          const p = nodePositions[n - 1];
          faceVerts.push(p[0], p[1], p[2]);
          faceNormals.push(0, 0, 0);
          vertMap.set(n, li);
        }
        return li;
      }

      for (let i = 1; i <= nbTriangles; i++) {
        const t = tri.Triangle(i);
        let n1 = t.Value(1);
        let n2 = t.Value(2);
        let n3 = t.Value(3);
        if (reversed) [n2, n3] = [n3, n2];

        const a = localIndex(n1);
        const b = localIndex(n2);
        const c = localIndex(n3);

        const pa = [
          faceVerts[a * 3],
          faceVerts[a * 3 + 1],
          faceVerts[a * 3 + 2],
        ];
        const pb = [
          faceVerts[b * 3],
          faceVerts[b * 3 + 1],
          faceVerts[b * 3 + 2],
        ];
        const pc = [
          faceVerts[c * 3],
          faceVerts[c * 3 + 1],
          faceVerts[c * 3 + 2],
        ];
        const ux = pb[0] - pa[0],
          uy = pb[1] - pa[1],
          uz = pb[2] - pa[2];
        const vx = pc[0] - pa[0],
          vy = pc[1] - pa[1],
          vz = pc[2] - pa[2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;

        faceNormals[a * 3] += nx;
        faceNormals[a * 3 + 1] += ny;
        faceNormals[a * 3 + 2] += nz;
        faceNormals[b * 3] += nx;
        faceNormals[b * 3 + 1] += ny;
        faceNormals[b * 3 + 2] += nz;
        faceNormals[c * 3] += nx;
        faceNormals[c * 3 + 1] += ny;
        faceNormals[c * 3 + 2] += nz;

        faceIndices.push(nodeStart + a, nodeStart + b, nodeStart + c);
      }

      // normalize accumulated face-local normals (per-face, not shared
      // across adjacent faces, so hard edges stay crisp)
      for (let i = 0; i < faceNormals.length; i += 3) {
        const nx = faceNormals[i],
          ny = faceNormals[i + 1],
          nz = faceNormals[i + 2];
        const len = Math.hypot(nx, ny, nz) || 1;
        faceNormals[i] = nx / len;
        faceNormals[i + 1] = ny / len;
        faceNormals[i + 2] = nz / len;
      }

      positions.push(...faceVerts);
      normals.push(...faceNormals);
      indices.push(...faceIndices);

      trsf.delete?.();
    }

    location.delete?.();
    explorer.Next();
  }
  explorer.delete?.();

  if (positions.length === 0) return null;

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices:
      positions.length / 3 > 65535
        ? new Uint32Array(indices)
        : new Uint16Array(indices),
  };
}

function boundingBoxCenter(oc: any, shape: any): [number, number, number] {
  const box = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, box, true);
  if (box.IsVoid()) return [0, 0, 0];
  const xMin = { current: 0 };
  const out = box.CornerMin();
  const min = [out.X(), out.Y(), out.Z()];
  const outMax = box.CornerMax();
  const max = [outMax.X(), outMax.Y(), outMax.Z()];
  void xMin;
  return [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
}

function recenter(geom: PartGeometry, center: [number, number, number]) {
  for (let i = 0; i < geom.positions.length; i += 3) {
    geom.positions[i] -= center[0];
    geom.positions[i + 1] -= center[1];
    geom.positions[i + 2] -= center[2];
  }
}

export function tessellateBodies(oc: any, bodies: OccBody[]): Part[] {
  const parts: Part[] = [];
  for (const body of bodies) {
    const geom = tessellateBody(oc, body.shape);
    if (!geom) continue;
    const center = boundingBoxCenter(oc, body.shape);
    recenter(geom, center);
    parts.push({
      id: nextId("part"),
      name: body.name,
      geometry: geom,
      basePose: {
        position: center,
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      color: "#b0b8c1",
      visible: true,
    });
  }
  return parts;
}
