import { Mat3, Mat4, Vec3, Vec4 } from "../lib/TSM.js";

export class Tile {
  public center: Vec3;
  public scalar: GLfloat;

  private positionsRay: Vec4[];
  private indicesRay: Vec3[];
  private normalsRay: Vec4[];
  private uvRay: Vec3[];

  private positionsF32: Float32Array;
  private indicesU32: Uint32Array;
  private normalsF32: Float32Array;
  private uvF32: Float32Array;

  constructor(above: boolean) {
    this.positionsRay = [
      /* Top */
      new Vec4([-0.5, 0, -0.5, 1.0]),
      new Vec4([-0.5, 0, 0.5, 1.0]),
      new Vec4([0.5, 0, 0.5, 1.0]),
      new Vec4([0.5, 0, -0.5, 1.0]),
      /* Left */
    ];
    console.assert(this.positionsRay != null);
    console.assert(this.positionsRay.length === 4);
    this.positionsF32 = new Float32Array(this.positionsRay.length * 4);
    this.positionsRay.forEach((v: Vec4, i: number) => {
      this.positionsF32.set(v.xyzw, i * 4);
    });
    console.assert(this.positionsF32 != null);
    console.assert(this.positionsF32.length === 4 * 4);

    this.indicesRay = [
      new Vec3(above ? [0, 2, 1] : [0, 1, 2]),
      new Vec3(above ? [0, 3, 2] : [0, 2, 3]),
    ];
    console.assert(this.indicesRay != null);
    console.assert(this.indicesRay.length === 2);
    this.indicesU32 = new Uint32Array(this.indicesRay.length * 3);
    this.indicesRay.forEach((v: Vec3, i: number) => {
      this.indicesU32.set(v.xyz, i * 3);
    });
    console.assert(this.indicesU32 != null);
    console.assert(this.indicesU32.length === 2 * 3);

    const normalDir = above ? -1.0 : 1.0
    this.normalsRay = [
      /* Top */
      new Vec4([0.0, normalDir, 0.0, 0.0]),
      new Vec4([0.0, normalDir, 0.0, 0.0]),
      new Vec4([0.0, normalDir, 0.0, 0.0]),
      new Vec4([0.0, normalDir, 0.0, 0.0]),
    ];
    console.assert(this.normalsRay != null);
    console.assert(this.normalsRay.length === 4);
    this.normalsF32 = new Float32Array(this.normalsRay.length * 4);
    this.normalsRay.forEach((v: Vec4, i: number) => {
      this.normalsF32.set(v.xyzw, i * 4);
    });
    console.assert(this.normalsF32 != null);
    console.assert(this.normalsF32.length === 4 * 4);

    this.uvRay = [
      /* Top */
      new Vec3([0.0, 0.0, 0.0]),
      new Vec3([0.0, 1.0, 0.0]),
      new Vec3([1.0, 1.0, 0.0]),
      new Vec3([1.0, 0.0, 0.0]),
    ];
    console.assert(this.uvRay != null);
    console.assert(this.uvRay.length === 4);
    this.uvF32 = new Float32Array(this.uvRay.length * 2);
    this.uvRay.forEach((v: Vec3, i: number) => {
      this.uvF32.set(v.xy, i * 2);
    });
    console.assert(this.uvF32 != null);
    console.assert(this.uvF32.length === 4 * 2);
  }


  public positionsFlat(): Float32Array {
    console.assert(this.positionsF32.length === 4 * 4);
    return this.positionsF32;
  }

  public indices(): Vec3[] {
    console.assert(this.indicesRay.length === 2);
    return this.indicesRay;
  }

  public indicesFlat(): Uint32Array {
    console.assert(this.indicesU32.length === 2 * 3);
    return this.indicesU32;
  }

  public normals(): Vec4[] {
    return this.normalsRay;
  }

  public normalsFlat(): Float32Array {
    return this.normalsF32;
  }
  
  public uvFlat() : Float32Array {
    return this.uvF32;
  }
}