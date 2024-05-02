import { Debugger } from "../lib/webglutils/Debugging.js";
import {
  CanvasAnimation,
  WebGLUtilities
} from "../lib/webglutils/CanvasAnimation.js";
import { GUI } from "./Gui.js";
import {
  blankCubeFSText,
  blankCubeVSText,
  blankTileFSText,
  blankTileVSText,
  ceilingFSText
} from "./Shaders.js";
import { Mat4, Vec4, Vec3, Vec2 } from "../lib/TSM.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { Camera } from "../lib/webglutils/Camera.js";
import { Cube } from "./Cube.js";
import { Tile } from "./Tile.js";
import { FloorChunk, FloorChunkLoader } from "./FloorChunk.js";
import { Sound } from "./Sound.js";

const TILE_SIZE: number = 8;
const JUMP_MAGNITUDE: number = 0.2
const GRAVITY: number = .0098 * .75
export const START_HEIGHT: number = 70

export class BackroomsAnimation extends CanvasAnimation {
  private gui: GUI;
  floorChunkLoader: FloorChunkLoader

  /*  Tile Rendering */
  private tileGeometry: Tile;
  private ceilingTileGeometry: Tile;

  private blankTileRenderPass: RenderPass;
  private ceilingRenderPass: RenderPass;


  private wallGeometry: Cube;
  private wallRenderPass: RenderPass;

  /* Global Rendering Info */
  private lightPosition: Vec4;
  private backgroundColor: Vec4;

  private canvas2d: HTMLCanvasElement;

  private sound: Sound;

  // Player's head position in world coordinate.
  // Player should extend two units down from this location, and 0.4 units radially.
  private playerPosition: Vec3;
  public upVelocity: number; // gravity/jumping
  public onFloor: boolean

  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);

    this.canvas2d = document.getElementById("textCanvas") as HTMLCanvasElement;

    this.ctx = Debugger.makeDebugContext(this.ctx);
    let gl = this.ctx;

    this.gui = new GUI(this.canvas2d, this);
    this.playerPosition = this.gui.getCamera().pos();
    this.upVelocity = 0
    this.onFloor = false

    // Generate initial landscape.
    // chunk size: 64, radius of chunks around player: 2, seed = 55, max height = 75
    const chunkSettings = {size: 64, tileSize: TILE_SIZE, seed: 0, y: START_HEIGHT}
    this.floorChunkLoader = new FloorChunkLoader(0, 0, chunkSettings)

    this.blankTileRenderPass = new RenderPass(gl, blankTileVSText, blankTileFSText);
    this.tileGeometry = new Tile(false);
    this.initBlankTile(this.blankTileRenderPass, this.tileGeometry);

    this.ceilingTileGeometry = new Tile(true);
    this.ceilingRenderPass = new RenderPass(gl, blankTileVSText, ceilingFSText);
    // we may need something differen this.initBlankTile();
    this.initBlankTile(this.ceilingRenderPass, this.ceilingTileGeometry);


    this.wallRenderPass = new RenderPass(gl, blankCubeVSText, blankCubeFSText);
    this.wallGeometry = new Cube();
    this.initWalls();

    this.lightPosition = new Vec4([-1000, 1000, -1000, 1]);
    this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);

    this.sound = new Sound(0.01);
  }

  /**
   * Setup the simulation. This can be called again to reset the program.
   */
  public reset(): void {
    this.gui.reset();
    this.playerPosition = this.gui.getCamera().pos();
  }

  private initBlankTile(renderPass: RenderPass, geometry: Tile): void {
    renderPass.setIndexBufferData(geometry.indicesFlat());
    renderPass.addAttribute("aVertPos",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      geometry.positionsFlat()
    );

    renderPass.addAttribute("aNorm",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      geometry.normalsFlat()
    );

    renderPass.addAttribute("aUV",
      2,
      this.ctx.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      geometry.uvFlat()
    );

    renderPass.addAttribute("time",
      1,
      this.ctx.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array([this.time])
    )

    renderPass.addInstancedAttribute("aOffset",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array(0)
    );

    renderPass.addInstancedAttribute("aRoomID",
      1,
      this.ctx.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array(0)
    )

    renderPass.addUniform("uLightPos",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.lightPosition.xyzw);
    });
    renderPass.addUniform("uProj",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
    });
    renderPass.addUniform("uView",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
    });
    renderPass.addUniform("tileSize",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        //gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
        gl.uniform1f(loc, TILE_SIZE)
    });

    renderPass.setDrawData(this.ctx.TRIANGLES, geometry.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
    renderPass.setup();
  }

  private initWalls(): void {
    this.wallRenderPass.setIndexBufferData(this.wallGeometry.indicesFlat());
    this.wallRenderPass.addAttribute("aVertPos",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.wallGeometry.positionsFlat()
    );

    this.wallRenderPass.addAttribute("aNorm",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.wallGeometry.normalsFlat()
    );

    this.wallRenderPass.addAttribute("aUV",
      2,
      this.ctx.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.wallGeometry.uvFlat()
    );

    this.wallRenderPass.addAttribute("time",
      1,
      this.ctx.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array([this.time])
    )

    this.wallRenderPass.addInstancedAttribute("aOffset",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array(0)
    );

    this.wallRenderPass.addInstancedAttribute("aScale",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array(0)
    );

    this.wallRenderPass.addInstancedAttribute("aBiome",
      1,
      this.ctx.FLOAT,
      false,
      Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array(0)
    )

    this.wallRenderPass.addUniform("uLightPos",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.lightPosition.xyzw);
    });
    this.wallRenderPass.addUniform("uProj",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
    });
    this.wallRenderPass.addUniform("uView",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
    });

    this.wallRenderPass.setDrawData(this.ctx.TRIANGLES, this.wallGeometry.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
    this.wallRenderPass.setup();
  }



  private updateXZ(walkDir: Vec3): void {
    if (this.floorChunkLoader.height() <= this.playerPosition.y - 2) {
      this.playerPosition.add(walkDir)
      //console.log(this.playerPosition.xyz)
    }
  }


  private updateY(): void {
    this.upVelocity -= GRAVITY
    let newPlayerPos = new Vec3([this.playerPosition.x, this.playerPosition.y + this.upVelocity, this.playerPosition.z])
    const floorY = this.floorChunkLoader.height()
    this.onFloor = newPlayerPos.y - 2 <= floorY
    if (this.onFloor) {
      newPlayerPos.y = floorY + 2
      this.upVelocity = 0
    }
    this.playerPosition = newPlayerPos
    //console.log(this.playerPosition.y)
  }

  /**
   * Draws a single frame
   *
   */
  public draw(): void {
    this.time += 1 / 60;
    //TODO: Logic for a rudimentary walking simulator. Check for collisions and reject attempts to walk into a cube. Handle gravity, jumping, and loading of new chunks when necessary.
    let walkDir = this.gui.walkDir()
    if (!this.onFloor) {
      //walkDir.scale(0.25)
    }
    this.updateXZ(walkDir); // scale (1/2)
    // scale for direction of head up/down, touching the ground
    this.updateY()
    this.gui.getCamera().setPos(this.playerPosition);
    this.floorChunkLoader.loadAfterMovement(this.playerPosition.x, this.playerPosition.z)
    //console.log(this.floorChunkLoader.getCurrentBiome(this.playerPosition.x, this.playerPosition.z))
    // Drawing
    const gl: WebGLRenderingContext = this.ctx;
    const bg: Vec4 = this.backgroundColor;
    gl.clearColor(bg.r, bg.g, bg.b, bg.a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // null is the default frame buffer
    this.drawScene(0, 0, 1280, 960);
    this.sound.update(this.floorChunkLoader.getCurrentBiome(this.playerPosition.x, this.playerPosition.z));
  }

  private drawScene(x: number, y: number, width: number, height: number): void {
    const gl: WebGLRenderingContext = this.ctx;
    gl.viewport(x, y, width, height);

    const time = new Float32Array(27); // random number
    for (let i = 0; i < time.byteLength; i++) {
      time[i] = this.time;
    }

    // this.blankTileRenderPass.updateAttributeBuffer("aOffset", this.floorChunk.tilePositions());
    // this.blankTileRenderPass.drawInstanced(this.floorChunk.numTiles());
    //TODO: Render multiple chunks around the player, using Perlin noise shaders
    this.floorChunkLoader.getChunks().forEach(chunk => {
      //chunk.rooms.forEach(room => {
      this.blankTileRenderPass.updateAttributeBuffer("time", time);
      this.blankTileRenderPass.updateAttributeBuffer("aOffset", chunk.tilePositionsF32);
      this.blankTileRenderPass.updateAttributeBuffer("aRoomID", chunk.tileBiomesF32);
      this.blankTileRenderPass.drawInstanced(chunk.tiles);
      this.ceilingRenderPass.updateAttributeBuffer("time", time);
      this.ceilingRenderPass.updateAttributeBuffer("aOffset", chunk.ceilingPositionsF32);
      this.ceilingRenderPass.updateAttributeBuffer("aRoomID", chunk.tileBiomesF32);
      this.ceilingRenderPass.drawInstanced(chunk.tiles);

      this.wallRenderPass.updateAttributeBuffer("time", time);
      this.wallRenderPass.updateAttributeBuffer("aOffset", chunk.wallPositions);
      this.wallRenderPass.updateAttributeBuffer("aScale", chunk.wallScales);
      this.wallRenderPass.updateAttributeBuffer("aBiome", chunk.wallBiomesF32);
      this.wallRenderPass.drawInstanced(chunk.wallPositions.length / 4);
      //})


    });
  }

  public getGUI(): GUI {
    return this.gui;
  }


  public jump() {
      //TODO: If the player is not already in the lair, launch them upwards at 10 units/sec.
    if (this.onFloor) {

      this.upVelocity += JUMP_MAGNITUDE
    }
  }
}

export function initializeCanvas(): void {
  const canvas = document.getElementById("glCanvas") as HTMLCanvasElement;
  /* Start drawing */
  const canvasAnimation: BackroomsAnimation = new BackroomsAnimation(canvas);
  canvasAnimation.start();
}
