import { Debugger } from "../lib/webglutils/Debugging.js";
import {
  CanvasAnimation,
  WebGLUtilities
} from "../lib/webglutils/CanvasAnimation.js";
import { GUI } from "./Gui.js";
import {
  blankTileFSText,
  blankTileVSText
} from "./Shaders.js";
import { Mat4, Vec4, Vec3, Vec2 } from "../lib/TSM.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { Camera } from "../lib/webglutils/Camera.js";
import { Cube } from "./Cube.js";
import { Tile } from "./Tile.js";
import { Chunk, ChunkLoader } from "./Chunk.js";
import { FloorChunk } from "./FloorChunk.js";

const CHUNK_RADIUS: number = 1; // vary as needed to see more chunks, I like 2 best. Significant performance implications

export class BackroomsAnimation extends CanvasAnimation {
  private gui: GUI;
  
  floorChunk : FloorChunk
  
  /*  Tile Rendering */
  private tileGeometry: Tile;
  private blankTileRenderPass: RenderPass;

  /* Global Rendering Info */
  private lightPosition: Vec4;
  private backgroundColor: Vec4;

  private canvas2d: HTMLCanvasElement;
  
  // Player's head position in world coordinate.
  // Player should extend two units down from this location, and 0.4 units radially.
  private playerPosition: Vec3;
  public upVelocity: number; // gravity/jumping
  public onFloor: boolean
  
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
    this.floorChunk = new FloorChunk(0, 0, 70, 64)
    
    this.blankTileRenderPass = new RenderPass(gl, blankTileVSText, blankTileFSText);
    this.tileGeometry = new Tile();
    this.initBlankTile();
    
    this.lightPosition = new Vec4([-1000, 1000, -1000, 1]);
    this.backgroundColor = new Vec4([0.0, 0.37254903, 0.37254903, 1.0]);    
  }

  /**
   * Setup the simulation. This can be called again to reset the program.
   */
  public reset(): void {    
    this.gui.reset();
    this.playerPosition = this.gui.getCamera().pos();
  }
  
  
  /**
   * Sets up the blank cube drawing
   */
  private initBlankTile(): void {
    this.blankTileRenderPass.setIndexBufferData(this.tileGeometry.indicesFlat());
    this.blankTileRenderPass.addAttribute("aVertPos",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.tileGeometry.positionsFlat()
    );
    
    this.blankTileRenderPass.addAttribute("aNorm",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.tileGeometry.normalsFlat()
    );
    
    this.blankTileRenderPass.addAttribute("aUV",
      2,
      this.ctx.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      this.tileGeometry.uvFlat()
    );
    
    this.blankTileRenderPass.addInstancedAttribute("aOffset",
      4,
      this.ctx.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0,
      undefined,
      new Float32Array(0)
    );

    this.blankTileRenderPass.addUniform("uLightPos",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniform4fv(loc, this.lightPosition.xyzw);
    });
    this.blankTileRenderPass.addUniform("uProj",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.projMatrix().all()));
    });
    this.blankTileRenderPass.addUniform("uView",
      (gl: WebGLRenderingContext, loc: WebGLUniformLocation) => {
        gl.uniformMatrix4fv(loc, false, new Float32Array(this.gui.viewMatrix().all()));
    });
    
    this.blankTileRenderPass.setDrawData(this.ctx.TRIANGLES, this.tileGeometry.indicesFlat().length, this.ctx.UNSIGNED_INT, 0);
    this.blankTileRenderPass.setup();    
  }


  private updateXZ(walkDir: Vec3): void {
    let newPos = this.playerPosition.copy().add(walkDir)
    if (this.floorChunk.height(new Vec2([newPos.x, newPos.z])) <= this.playerPosition.y - 2) {
      this.playerPosition.add(walkDir)
    } 
  }


  private updateY(): void {
    this.upVelocity -= .098/10
    let newPlayerPos = new Vec3([this.playerPosition.x, this.playerPosition.y + this.upVelocity, this.playerPosition.z])
    const floorY = this.floorChunk.height(new Vec2([this.playerPosition.x, this.playerPosition.z]))
    this.onFloor = newPlayerPos.y - 2 <= floorY
    if (this.onFloor) {
      newPlayerPos.y = floorY + 2
      this.upVelocity = 0
    }
    this.playerPosition = newPlayerPos
    console.log(this.playerPosition.y)
  }

  /**
   * Draws a single frame
   *
   */
  public draw(): void {
    //TODO: Logic for a rudimentary walking simulator. Check for collisions and reject attempts to walk into a cube. Handle gravity, jumping, and loading of new chunks when necessary.
    let walkDir = this.gui.walkDir()
    if (!this.onFloor) {
      //walkDir.scale(0.25)
    }
    this.updateXZ(walkDir); // scale (1/2)
    // scale for direction of head up/down, touching the ground
    this.updateY()
    this.gui.getCamera().setPos(this.playerPosition);
    //this.chunkLoader.loadAfterMovement(this.playerPosition.x, this.playerPosition.z)
    
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
  }

  private drawScene(x: number, y: number, width: number, height: number): void {
    const gl: WebGLRenderingContext = this.ctx;
    gl.viewport(x, y, width, height);

    this.blankTileRenderPass.updateAttributeBuffer("aOffset", this.floorChunk.tilePositions());
    this.blankTileRenderPass.drawInstanced(this.floorChunk.numTiles());    
    //TODO: Render multiple chunks around the player, using Perlin noise shaders
    /*this.chunkLoader.getChunks().forEach(chunk => {
      
      this.blankTileRenderPass.updateAttributeBuffer("aOffset", chunk.cubePositions());
      this.blankTileRenderPass.updateAttributeBuffer("blockType", chunk.getBlockTypes());
      this.blankTileRenderPass.drawInstanced(chunk.numTiles());    
    });*/

  }

  public getGUI(): GUI {
    return this.gui;
  }  
  
  
  public jump() {
      //TODO: If the player is not already in the lair, launch them upwards at 10 units/sec.
    if (this.onFloor) {
      
      this.upVelocity += .3
    }
  }
}

export function initializeCanvas(): void {
  const canvas = document.getElementById("glCanvas") as HTMLCanvasElement;
  /* Start drawing */
  const canvasAnimation: BackroomsAnimation = new BackroomsAnimation(canvas);
  canvasAnimation.start();  
}
