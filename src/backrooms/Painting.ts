import { Mat3, Mat4, Vec3, Vec4 } from "../lib/TSM.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { CLoader } from "./skinning-utils/AnimationFileLoader.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";

export class PaintingGeometry {
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

  constructor(zWall: boolean, positive: boolean) {
    this.positionsRay = [
      /* Top */
      new Vec4([zWall ? -0.5 : 0, -0.5, zWall ? 0 : -0.5, 1.0]),
      new Vec4([zWall ? -0.5 : 0, 0.5, zWall ? 0 : -0.5, 1.0]),
      new Vec4([zWall ? 0.5 : 0, 0.5, zWall ? 0 : 0.5, 1.0]),
      new Vec4([zWall ? 0.5 : 0, -0.5, zWall ? 0 : 0.5, 1.0]),
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
      new Vec3(positive ? [0, 2, 1] : [0, 1, 2]),
      new Vec3(positive ? [0, 3, 2] : [0, 2, 3]),
    ];
    console.assert(this.indicesRay != null);
    console.assert(this.indicesRay.length === 2);
    this.indicesU32 = new Uint32Array(this.indicesRay.length * 3);
    this.indicesRay.forEach((v: Vec3, i: number) => {
      this.indicesU32.set(v.xyz, i * 3);
    });
    console.assert(this.indicesU32 != null);
    console.assert(this.indicesU32.length === 2 * 3);

    const normalDir = positive ? -1.0 : 1.0
    const xNormal = zWall ? normalDir : 0
    const zNormal = zWall ? 0 : normalDir
    this.normalsRay = [
      /* Top */
      new Vec4([xNormal, 0.0, zNormal, 0.0]),
      new Vec4([xNormal, 0.0, zNormal, 0.0]),
      new Vec4([xNormal, 0.0, zNormal, 0.0]),
      new Vec4([xNormal, 0.0, zNormal, 0.0]),
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


export class PaintingManager  {

  /* Scene rendering info */
  private scene: CLoader;
  private sceneRenderPass: RenderPass;

  public drawScene(gl: WebGLRenderingContext, width: number, height: number): void {
    gl.viewport(0, 0, width, height);
  
    //this.floorRenderPass.draw();
  
    /* Draw Scene */
    if (this.scene.meshes.length > 0) {
      this.sceneRenderPass.draw();
      // gl.disable(gl.DEPTH_TEST);
      // //TODO: Add functionality for drawing the highlighted bone when necessary
      // gl.enable(gl.DEPTH_TEST);
    }
  }

}




export function renderToPainting(gl: WebGLRenderingContext, bg: Vec4): WebGLTexture {
  //this.initKeyframePreview(index);
  //gl.useProgram(this.keyframeRenderPasses[this.keyframeRenderPasses.length - 1].shaderProgram)

  const targetTextureWidth = 320;
  const targetTextureHeight = targetTextureWidth * (600 / 800);
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  {
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  targetTextureWidth, targetTextureHeight, border,
                  format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);
  gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);
  gl.clearColor(bg.r, bg.g, bg.b, bg.a);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const depthBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, targetTextureWidth, targetTextureHeight);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
  //drawScene(gl, targetTextureWidth, targetTextureHeight);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //gl.viewport(800, 800 - this.gui.keyFrames.length * targetTextureHeight, targetTextureWidth, targetTextureHeight);
  return targetTexture!
  // this.keyframeRenderPass.draw();
}