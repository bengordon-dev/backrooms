import { Mat3, Mat4, Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import Rand from "../lib/rand-seed/Rand.js"
import { RoomTree, Room } from "./Room.js";
export interface FloorChunkSettings {
    size: number;
    tileSize: number;
    seed: number;
    y: number;
}

export function negativeMod(x: number, n: number) : number {
    return ((x % n) + n) % n;
}

export function roundDown(x: number, n: number) : number {
    return x - negativeMod(x, n)
}

export function whiteNoise(tile: [number, number], seed: number) {
    return negativeMod((Math.sin(tile[0] * 12.9898 + tile[1] * 78.233 + seed) + 1) * 43758.5453, 1)
}

export function valueNoise(tile: [number, number], gridSize: number, seed: number): number {
    const topLeft: [number, number] = [
        roundDown(tile[0], gridSize),
        roundDown(tile[1], gridSize)
    ]
    const topRight: [number, number] = [topLeft[0] + gridSize, topLeft[1]]
    const bottomLeft: [number, number] = [topLeft[0], topLeft[1] + gridSize]
    const bottomRight: [number, number] = [topLeft[0] + gridSize, topLeft[1] + gridSize]

    let tlNoise = whiteNoise(topLeft, seed)
    let trNoise = whiteNoise(topRight, seed)
    let blNoise = whiteNoise(bottomLeft, seed)
    let brNoise = whiteNoise(bottomRight, seed)
    let xFrac = negativeMod(tile[0], gridSize) / (gridSize - 1)
    let yFrac = negativeMod(tile[1], gridSize) / (gridSize - 1)
    let t = tlNoise * (1 - xFrac) + trNoise * xFrac
    let b = blNoise * (1 - xFrac) + brNoise * xFrac
    return t * (1 - yFrac) + b * yFrac
}

export function mergeFloatArrays(arrs: Float32Array[]) {
    let length = arrs.map(e => e.length).reduce((prev, cur) => prev + cur, 0)
    let out = new Float32Array(length)
    let combinedLength = 0
    for (let i = 0; i < arrs.length; i++) {
        out.set(arrs[i], combinedLength)
        combinedLength += arrs[i].length
    }
    return out 
}

function valueExists<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== null && value !== undefined;
}

export class FloorChunkLoader {
    private settings: FloorChunkSettings
    
    // (-x, -z), (-z), (+x, -z), (-x), (current chunk), (+x), (-x, +z), (+z), (+x, +z)
    private chunks: (FloorChunk | null)[]


    constructor(x: number, z: number, settings: FloorChunkSettings) {
        this.settings = settings
        this.initializeMap(x, z)
    }

    public getNearestCenter(x: number, z: number): [number, number] {
        const spacing = this.settings.size * this.settings.tileSize
        let newX = x
        if (negativeMod(x, spacing) >= spacing / 2) {
            newX += spacing
        }
        let newZ = z
        if (negativeMod(z, spacing) >= spacing / 2) {
            newZ += spacing
        }
        return [roundDown(newX, spacing), roundDown(newZ, spacing)]
    }

    public initializeMap(x: number, z: number) {
        this.chunks = Array(9).map(_ => null)
        const [centerX, centerZ] = this.getNearestCenter(x, z)
        this.chunks[4] = new FloorChunk(centerX, centerZ, this.settings)
    }

    public loadAfterMovement(playerX: number, playerZ: number) {
        // are you in a new chunk?
        const centerChunk: FloorChunk = this.chunks[4]!
        const [xFrac, zFrac] = centerChunk.fractionalCoords(playerX, playerZ) 

        if (!centerChunk.inBounds(playerX, playerZ)) {
            this.initializeMap(playerX, playerZ)
            return
        }
        
        // deload or load: top left corner
        if (xFrac > .2 || zFrac > .2) {
            this.chunks[0] = null
        } else if (this.chunks[0] === null) {
            this.chunks[0] = centerChunk.newNeighbor(-1, -1)
        }
        // deload or load: top edge
        if (zFrac > .2) {
            this.chunks[1] = null
        } else if (this.chunks[1] === null) {
            this.chunks[1] = centerChunk.newNeighbor(0, -1)
        }
        // deload or load: top right corner
        if (xFrac < .8 || zFrac > .2) {
            this.chunks[2] = null 
        } else if (this.chunks[2] === null) {
            this.chunks[2] = centerChunk.newNeighbor(1, -1)
        }
        // deload or load: left edge
        if (xFrac > .2) {
            this.chunks[3] = null
        } else if (this.chunks[3] === null) {
            this.chunks[3] = centerChunk.newNeighbor(-1, 0)
        }
        // deload or load: right edge
        if (xFrac < .8) {
            this.chunks[5] = null
        } else if (this.chunks[5] === null) {
            this.chunks[5] = centerChunk.newNeighbor(1, 0)
        }
        // deload or load: bottom left corner
        if (xFrac > .2 || zFrac < .8) {
            this.chunks[6] = null 
        } else if (this.chunks[6] === null) {
            this.chunks[6] = centerChunk.newNeighbor(-1, 1)
        }
        // deload or load: bottom edge
        if (zFrac < .8) {
            this.chunks[7] = null
        } else if (this.chunks[7] === null) {
            this.chunks[7] = centerChunk.newNeighbor(0, 1)
        }
        // deload or load: bottom right corner
        if (xFrac < .8 || zFrac < .8) {
            this.chunks[8] = null
        } else if (this.chunks[8] === null) {
            this.chunks[8] = centerChunk.newNeighbor(1, 1)
        }
    }

    public height(): number {
        return this.settings.y
    }

    public getChunks(): FloorChunk[] {
        let out = this.chunks.filter(valueExists)
        return out
    }
}

export class FloorChunk {
    public tiles: number = 0; // Number of tiles that should be *drawn* each frame
    public tilePositionsF32: Float32Array; // (4 x tiles) array of cube translations, in homogeneous coordinates
    public ceilingPositionsF32: Float32Array;
    public centerX : number; // Center of the chunk
    public centerZ : number;
    private settings: FloorChunkSettings;
    private length: number;
    public tileBiomesF32: Float32Array; 
    public rooms: Room[] = []
    public wallPositions: Float32Array;
    public wallScales: Float32Array;

    constructor(x : number, z : number, settings: FloorChunkSettings) {
        this.centerX = x;
        this.centerZ = z;
        this.settings = settings
        this.tiles = this.settings.size*this.settings.size;
        this.length = this.settings.size * this.settings.tileSize
        this.generateRoomsAndWalls()
    }

    public maxX = () => this.centerX + this.length / 2
    public minX = () => this.centerX - this.length / 2
    public maxZ = () => this.centerZ + this.length / 2
    public minZ = () => this.centerZ - this.length / 2

    public fractionalCoords = (x: number, z: number) : [number, number] => [
        (x - this.minX()) / this.length,
        (z - this.minZ()) / this.length
    ]

    public newNeighbor(xOffset: number, zOffset: number): FloorChunk {
        return new FloorChunk(
            this.centerX + xOffset * this.length,
            this.centerZ + zOffset * this.length,
            this.settings
        )
    }

    public inBounds(x: number, z: number): boolean {
        return x >= this.minX() && x < this.maxX()
        && z >= this.minZ() && z < this.maxZ()
    }

    public height(xz: Vec2): number {
        return this.settings.y
    }

    private generateRoomsAndWalls() {
        const tree = new RoomTree(this, this.settings, Math.ceil(Math.sqrt(this.length)) * 2)
        this.tilePositionsF32 = mergeFloatArrays(tree.rooms.map(e => e.tilePositionsF32))
        this.ceilingPositionsF32 = mergeFloatArrays(tree.rooms.map(e => e.ceilingPositionsF32))
        console.log(this.ceilingPositionsF32)
        this.wallPositions = mergeFloatArrays(tree.rooms.map(e => e.wallPositions))
        this.wallScales = mergeFloatArrays(tree.rooms.map(e => e.wallScales))
        this.tileBiomesF32 = mergeFloatArrays(tree.rooms.map(e => e.tileBiomesF32))
        this.rooms = tree.rooms
    }
}
