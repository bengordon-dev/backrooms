import { Mat3, Mat4, Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import Rand from "../lib/rand-seed/Rand.js"

interface ChunkSettings {
    size: number;
    seed: number;
    maxHeight: number;
}


export class FloorChunk {
    private tiles: number; // Number of tiles that should be *drawn* each frame
    private tilePositionsF32: Float32Array; // (4 x tiles) array of cube translations, in homogeneous coordinates
    public centerX : number; // Center of the chunk
    public centerZ : number;
    public y: number;
    private size: number; // Number of cubes along each side of the chunk
    private seed: number;
    
    
    constructor(x : number, z : number, y: number, size: number) {
        this.centerX = x;
        this.centerZ = z;
        this.y = y;
        this.size = size;
        this.tiles = this.size*this.size;  
        this.seed = 0
        this.generateTiles();
    }
    // source: https://www.youtube.com/watch?v=KllOFoUnKhU
    private static whiteNoise(block: [number, number], seed: number) {
        return this.negativeMod((Math.sin(block[0] * 12.9898 + block[1] * 78.233 + seed) + 1) * 43758.5453, 1)
    }

    private static negativeMod(x: number, n: number) : number {
        return ((x % n) + n) % n;
    }

    private static roundDown(x: number, n: number) : number {
        return x - FloorChunk.negativeMod(x, n)
    }


    public maxX = () => this.centerX + this.size / 2
    public minX = () => this.centerX - this.size / 2
    public maxZ = () => this.centerZ + this.size / 2
    public minZ = () => this.centerZ - this.size / 2
    
    
    public inBounds(x: number, z: number): boolean {
        return x >= this.minX() && x <= this.maxX()
        && z >= this.minZ() && z <= this.maxZ()
    }

    public height(xz: Vec2): number {
        return this.y
    }

    private generateTiles() {
        const topleftx = this.centerX - this.size / 2;
        const toplefty = this.centerZ - this.size / 2;
        this.tilePositionsF32 = new Float32Array(this.tiles * 4);

        for (let i=0; i<this.size; i++) {     
            for (let j=0; j<this.size; j++) {
                const idx = this.size * i + j;
                this.tilePositionsF32[4*idx + 0] = topleftx + j;
                this.tilePositionsF32[4*idx + 1] = this.y
                this.tilePositionsF32[4*idx + 2] = toplefty + i;
                this.tilePositionsF32[4*idx + 3] = 0;
            }
        }
    }

    
    
    public tilePositions(): Float32Array {
        return this.tilePositionsF32
    }
    
    public numTiles(): number {
        return this.tiles;
    }
}
