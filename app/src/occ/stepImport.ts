// STEP/IGES import via OpenCASCADE.js (OCCT compiled to WASM). This is the
// only file that touches the `oc` embind API directly for reading files and
// splitting an assembly into rigid parts; tessellate.ts turns the resulting
// shapes into plain triangle arrays.
import { loadOcc } from "./init";

/** A rigid (non-decomposable) piece of the assembly: a TopoDS_Shape handle. */
export interface OccBody {
  name: string;
  shape: any; // TopoDS_Shape
}

function readIntoVirtualFs(oc: any, buffer: ArrayBuffer, shortPath: string) {
  const bytes = new Uint8Array(buffer);
  oc.FS.writeFile(shortPath, bytes);
}

function isCompound(oc: any, shape: any): boolean {
  return shape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_COMPOUND;
}

/**
 * Walk down nested compounds (assembly -> subassembly -> ...) and stop at
 * the first level whose children are no longer compounds. That node -- even
 * if it still contains several solids/shells -- is treated as one rigid
 * part, matching how STEP assemblies are normally authored.
 */
function collectRigidBodies(
  oc: any,
  shape: any,
  namePrefix: string,
  out: OccBody[]
) {
  if (!isCompound(oc, shape)) {
    out.push({ name: namePrefix, shape });
    return;
  }

  const children: any[] = [];
  const it = new oc.TopoDS_Iterator_2(shape, true, true);
  while (it.More()) {
    children.push(it.Value());
    it.Next();
  }

  if (children.length === 0) return;

  const allChildrenAreCompounds = children.every((c) => isCompound(oc, c));
  if (!allChildrenAreCompounds) {
    // This compound's children are actual geometry (solids/shells/faces) --
    // treat the whole compound as a single rigid part.
    out.push({ name: namePrefix, shape });
    return;
  }

  children.forEach((child, i) => {
    collectRigidBodies(oc, child, `${namePrefix}_${i + 1}`, out);
  });
}

export async function importStepFile(
  file: File
): Promise<{ bodies: OccBody[]; oc: any }> {
  const oc = await loadOcc();
  const buffer = await file.arrayBuffer();

  // Short virtual path: long paths silently fail STEPControl_Reader.ReadFile
  // in this build.
  const ext = file.name.toLowerCase().endsWith(".igs") || file.name.toLowerCase().endsWith(".iges")
    ? "iges"
    : "step";
  const shortPath = ext === "iges" ? "/u.igs" : "/u.step";
  readIntoVirtualFs(oc, buffer, shortPath);

  const reader =
    ext === "iges" ? new oc.IGESControl_Reader_1() : new oc.STEPControl_Reader_1();

  const status = reader.ReadFile(shortPath);
  const doneStatus =
    ext === "iges" ? oc.IFSelect_ReturnStatus.IFSelect_RetDone : oc.IFSelect_ReturnStatus.IFSelect_RetDone;
  if (status !== doneStatus) {
    throw new Error(
      `No se pudo leer el archivo ${ext.toUpperCase()} (status=${status}). Verifica que el archivo no este dañado.`
    );
  }

  reader.TransferRoots();
  const shape = reader.OneShape();

  const bodies: OccBody[] = [];
  const baseName = file.name.replace(/\.[^.]+$/, "");
  collectRigidBodies(oc, shape, baseName, bodies);

  if (bodies.length === 0) {
    throw new Error("El archivo no contiene geometria reconocible.");
  }

  return { bodies, oc };
}
