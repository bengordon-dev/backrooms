import { Mat3, Mat4, Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import Rand from "../lib/rand-seed/Rand.js"

interface FloorChunkSettings {
    size: number;
    tileSize: number;
    seed: number;
    y: number;
}

function negativeMod(x: number, n: number) : number {
    return ((x % n) + n) % n;
}

function roundDown(x: number, n: number) : number {
    return x - negativeMod(x, n)
}

function whiteNoise(tile: [number, number], seed: number) {
    return negativeMod((Math.sin(tile[0] * 12.9898 + tile[1] * 78.233 + seed) + 1) * 43758.5453, 1)
}


export class FloorChunkLoader {
    private settings: FloorChunkSettings
    private chunks: FloorChunk[][] 
    private radius: number


    constructor(x: number, z: number, radius: number, settings: FloorChunkSettings) {
        this.settings = settings 
        this.radius = radius
        this.initializeMap(x, z)
    }

    public initializeMap(x: number, z: number) {
        const diameter = 2 * this.radius + 1
        const spacing = this.settings.size * this.settings.tileSize
        const centerX = roundDown(x, spacing) 
        const centerZ = roundDown(z, spacing)    
        this.chunks = Array.from(Array(diameter), () => [])
        for (let i = -this.radius; i <= this.radius; i++) {
            for (let j = -this.radius; j <= this.radius; j++) {
                this.chunks[i + this.radius].push(new FloorChunk(centerX + j*spacing, centerZ + i*spacing, this.settings));
            }
        }
      
        // const boundaries = Array.from(Array(diameter - 1).keys(), (e) => (e - this.radius + 0.5) * this.settings.size)
        // this.xBoundaries = [...boundaries]
        // this.zBoundaries = [...boundaries]
    }

    public height(): number {
        return this.settings.y
    }

    public getChunks(): FloorChunk[] {
        return this.chunks.flat()
    }
}

export class FloorChunk {
    private tiles: number; // Number of tiles that should be *drawn* each frame
    private tilePositionsF32: Float32Array; // (4 x tiles) array of cube translations, in homogeneous coordinates
    public centerX : number; // Center of the chunk
    public centerZ : number;
    private settings: FloorChunkSettings;
    private length: number;
    private tileRoomIDs: Float32Array; // array of enums (0, 1, 2) for grass, stone, snow

    
    
    constructor(x : number, z : number, settings: FloorChunkSettings) {
        this.centerX = x;
        this.centerZ = z;
        this.settings = settings 
        this.tiles = this.settings.size*this.settings.size;  
        this.length = this.settings.size * this.settings.tileSize 
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


    public maxX = () => this.centerX + this.length / 2
    public minX = () => this.centerX - this.length / 2
    public maxZ = () => this.centerZ + this.length / 2
    public minZ = () => this.centerZ - this.length / 2
    
    
    public inBounds(x: number, z: number): boolean {
        return x >= this.minX() && x <= this.maxX()
        && z >= this.minZ() && z <= this.maxZ()
    }

    public height(xz: Vec2): number {
        return this.settings.y
    }

    private valueNoise(tile: [number, number], gridSize: number): number {
        const topLeft: [number, number] = [
            roundDown(tile[0], gridSize),
            roundDown(tile[1], gridSize) 
        ]
        const topRight: [number, number] = [topLeft[0] + gridSize, topLeft[1]]
        const bottomLeft: [number, number] = [topLeft[0], topLeft[1] + gridSize]
        const bottomRight: [number, number] = [topLeft[0] + gridSize, topLeft[1] + gridSize]
        
        let tlNoise = whiteNoise(topLeft, this.settings.seed)
        let trNoise = whiteNoise(topRight, this.settings.seed)
        let blNoise = whiteNoise(bottomLeft, this.settings.seed)
        let brNoise = whiteNoise(bottomRight, this.settings.seed)
        let xFrac = (tile[0] % gridSize) / (gridSize - 1)
        let yFrac = (tile[1] % gridSize) / (gridSize - 1)
        let t = tlNoise * (1 - xFrac) + trNoise * xFrac
        let b = blNoise * (1 - xFrac) + brNoise * xFrac
        return t * (1 - yFrac) + b * yFrac
    }


    private generateTiles() {
        const topleftx = this.minX()
        const toplefty = this.minZ()
        this.tilePositionsF32 = new Float32Array(this.tiles * 4);
        this.tileRoomIDs = new Float32Array(this.tiles)
        for (let i = 0; i < this.settings.size; i++) {     
            for (let j = 0; j < this.settings.size; j++) {
                const idx = this.settings.size * i + j;
                const x = topleftx + j * this.settings.tileSize;
                const z = toplefty + i * this.settings.tileSize;
                this.tilePositionsF32[4*idx + 0] = x
                this.tilePositionsF32[4*idx + 1] = this.settings.y
                this.tilePositionsF32[4*idx + 2] = z
                this.tilePositionsF32[4*idx + 3] = 0;
                this.tileRoomIDs[idx] = Math.floor(this.valueNoise([x, z], this.settings.tileSize * 16) * 4)
            }
        }
    }

    public tilePositions(): Float32Array {
        return this.tilePositionsF32
    }
    
    public numTiles(): number {
        return this.tiles;
    }

    public getRoomIDs(): Float32Array {
        return this.tileRoomIDs
    }
}
