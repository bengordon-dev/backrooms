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

function valueNoise(tile: [number, number], gridSize: number, seed: number): number {
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

    public wallPositions: Float32Array;
    public wallScales: Float32Array;

    constructor(x : number, z : number, settings: FloorChunkSettings) {
        this.centerX = x;
        this.centerZ = z;
        this.settings = settings
        this.tiles = this.settings.size*this.settings.size;
        this.length = this.settings.size * this.settings.tileSize
        this.generateRoomsAndWalls()
        //this.generateTiles();
    }
    
    // source: https://www.youtube.com/watch?v=KllOFoUnKhU
    

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

    private generateRoomsAndWalls() {
        const tree = new RoomTree(this, this.settings, Math.ceil(Math.sqrt(this.length)))
        this.tilePositionsF32 = tree.tilePositions()
        this.wallPositions = tree.wallOffsets
        this.wallScales = tree.wallScales
        this.tileRoomIDs = tree.tileBiomes()
    }

    /*private generateTiles() {
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
                this.tileRoomIDs[idx] = Math.floor(valueNoise([x, z], this.settings.tileSize * 8, this.settings.seed) * 4)
            }
        }

        const rand = new Rand(`${topleftx},${toplefty}`);
        const wallPositions: number[] = [];
        const wallScales: number[] = [];
        for (let i = 0; i < 2000; i++) {
            const x = rand.next() * this.length + topleftx;
            const z = rand.next() * this.length + toplefty;
            wallPositions.push(x, this.settings.y, z, 0);
            wallScales.push(rand.next() * 10, 3, rand.next() * 10, 1);
        }
        this.wallPositions = new Float32Array(wallPositions);
        this.wallScales = new Float32Array(wallScales);
    }*/

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

enum DivisionDimension {
    X,
    Z,
}

class RoomTreeNode {
    public settings: FloorChunkSettings
    public minCorner: [number, number]
    public maxCorner: [number, number]
    public dimension: DivisionDimension
    public threshold: number | null = null
    public left: RoomTreeNode | null = null
    public right: RoomTreeNode | null = null
    public point: [number, number] | null = null

    constructor(settings: FloorChunkSettings, dimension: DivisionDimension,
        minCorner: [number, number], maxCorner: [number, number]) {
        this.minCorner = minCorner
        this.maxCorner = maxCorner
        this.settings = settings
        this.dimension = dimension
    }

    public isLeaf(): boolean {
        return this.threshold === null
    }

    private sectors(): number {
        return (this.maxCorner[this.dimension] - this.minCorner[this.dimension]) / this.settings.tileSize
    }

    private sector(point: [number, number]): number {
        let roundedCoord = roundDown(point[this.dimension], this.settings.tileSize)
        return (roundedCoord - this.minCorner[this.dimension]) / this.settings.tileSize
    }

    private sectorToWorld(sector: number) : number {
        return sector * this.settings.tileSize + this.minCorner[this.dimension]
    }

    public divisible(): boolean {
        return this.sectors() >= 6
    }

    private addPointNonLeaf(newPoint: [number, number]) {
        if (newPoint[this.dimension] >= this.threshold!) {
            this.right!.addPoint(newPoint)
        } else {
            this.left!.addPoint(newPoint)
        }
    }
    
    public addPoint(newPoint: [number, number]) {
        if (this.point === null) {
            this.point = newPoint 
            return 
        } 

        if (this.isLeaf()) {
            // divide if divisible
            if (!this.divisible()) return 

            const oldPointSector = this.sector(this.point)
            const newPointSector = this.sector(newPoint)
            if (oldPointSector === newPointSector) return

            const minSector = Math.min(oldPointSector, newPointSector) + 1
            const maxSector = Math.max(oldPointSector, newPointSector)
            if (maxSector < 3 || this.sectors() - minSector < 3) return 

            if (minSector === maxSector) {
                this.threshold = this.sectorToWorld(minSector)
            } else {
                const index = Math.floor(whiteNoise(this.minCorner, this.settings.seed) * (maxSector - minSector))
                    + minSector
                this.threshold = this.sectorToWorld(index)
            }

            if (this.dimension === DivisionDimension.X) { // splitting by X (left to right)
                this.left = new RoomTreeNode(this.settings, DivisionDimension.Z, 
                    this.minCorner, [this.threshold, this.maxCorner[1]])
                this.right = new RoomTreeNode(this.settings, DivisionDimension.Z, 
                    [this.threshold, this.minCorner[1]], this.maxCorner)
            } else { // splitting by Z (top to bottom)
                this.left = new RoomTreeNode(this.settings, DivisionDimension.X, 
                    this.minCorner, [this.maxCorner[0], this.threshold])
                this.right = new RoomTreeNode(this.settings, DivisionDimension.X, 
                    [this.minCorner[0], this.threshold], this.maxCorner)
            }
            this.addPointNonLeaf(newPoint)
            this.addPointNonLeaf(this.point)
            this.point = null

        } else {
            this.addPointNonLeaf(newPoint)
        }
    }

    private traverseHelper(rooms: Room[], wallOffsets: number[], wallScales: number[]) {
        if (this.isLeaf()) {
            rooms.push(new Room(this.minCorner, this.maxCorner, this.settings))
        } else {
            const adj = this.settings.tileSize / 2
            if (this.dimension === DivisionDimension.X) { // left and right, vertical bar
                const length = this.maxCorner[1] - this.minCorner[1]
                wallOffsets.push(this.threshold! - this.settings.tileSize/2, this.settings.y + 1.5, this.minCorner[1] + length / 2 - adj, 0)
                wallScales.push(1, 3, length, 1)
            } else { // top and bottom, horizontal bar
                const length = this.maxCorner[0] - this.minCorner[0]
                wallOffsets.push(this.minCorner[0] + length / 2 - adj, this.settings.y + 1.5, this.threshold! - this.settings.tileSize/2, 0)
                wallScales.push(length, 3, 1, 1)
            }
            this.left?.traverseHelper(rooms, wallOffsets, wallScales)
            this.right?.traverseHelper(rooms, wallOffsets, wallScales)
        }
    }

    public traverse(): [Room[], number[], number[]] {
        let rooms: Room[] = []
        let wallOffsets: number[] = []
        let wallScales: number[] = []
        this.traverseHelper(rooms, wallOffsets, wallScales)
        return [rooms, wallScales, wallOffsets]
    }


}

class RoomTree {
    private chunk: FloorChunk
    private settings: FloorChunkSettings
    private rand: Rand
    private root: RoomTreeNode
    private rooms: Room[] = []
    public wallOffsets: Float32Array
    public wallScales: Float32Array

    private generatePoint() : [number, number] {
        const length = this.settings.size * this.settings.tileSize
        const x = this.rand.next() * length + this.chunk.minX()
        const z = this.rand.next() * length + this.chunk.minZ()
        return [x, z]
    }

    constructor(chunk: FloorChunk, chunkSettings: FloorChunkSettings, points: number) {
        this.chunk = chunk
        this.settings = chunkSettings
        this.rand = new Rand(`${this.settings.seed}${chunk.minX()},${chunk.minZ()}`);
        this.root = new RoomTreeNode(this.settings, DivisionDimension.X, [chunk.minX(), chunk.minZ()], 
            [chunk.maxX(), chunk.maxZ()])
        for (let i = 0; i < points; i++) {
            this.root.addPoint(this.generatePoint())
        }
        let [rooms, wallScales, wallOffsets] = this.root.traverse()
        this.rooms = rooms
        this.wallOffsets = new Float32Array(wallOffsets)
        this.wallScales = new Float32Array(wallScales)
        // console.log("offsets")
        // console.log(this.wallOffsets)
        // console.log("scales")
        // console.log(this.wallScales)
    }

    public tilePositions(): Float32Array {
        let length = this.rooms.map(e => e.tilePositionsF32.length).reduce((prev, cur) => prev + cur, 0)
        let out = new Float32Array(length)
        let combinedLength = 0
        for (let i = 0; i < this.rooms.length; i++) {
            let tileArr = this.rooms[i].tilePositionsF32
            out.set(tileArr, combinedLength)
            combinedLength += tileArr.length
        }
        return out 
    }

    public tileBiomes(): Float32Array {
        let length = this.rooms.map(e => e.tileBiomesF32.length).reduce((prev, cur) => prev + cur, 0)
        let out = new Float32Array(length)
        let combinedLength = 0
        for (let i = 0; i < this.rooms.length; i++) {
            let tileArr = this.rooms[i].tileBiomesF32
            out.set(tileArr, combinedLength)
            combinedLength += tileArr.length
        }
        return out 
    }
}

class Room {
    //public perimeter: number[][]
    public minCorner: [number, number]
    public maxCorner: [number, number]
    public tilePositionsF32: Float32Array
    public tileBiomesF32: Float32Array 
    private settings: FloorChunkSettings

    constructor(minCorner: [number, number], maxCorner: [number, number], settings: FloorChunkSettings) {
        this.minCorner = minCorner
        this.maxCorner = maxCorner
        this.settings = settings 
        this.generateTiles()
    }

    private generateTiles() {
        const topleftx = this.minCorner[0]
        const toplefty = this.minCorner[1]
        const width = (this.maxCorner[0] - this.minCorner[0])/this.settings.tileSize
        const height = (this.maxCorner[1] - this.minCorner[1])/this.settings.tileSize
        console.log(width)
        console.log(height)
        const tiles = width * height
        this.tilePositionsF32 = new Float32Array(tiles * 4);
        this.tileBiomesF32 = new Float32Array(tiles)
        const median: [number, number] = [(this.minCorner[0] + this.maxCorner[0])/2, (this.minCorner[1] + this.maxCorner[1])/2]
        const biome = Math.floor(valueNoise(median, this.settings.tileSize, this.settings.seed) * 4)
        //console.log(`median ${median} width ${width} height ${height} biome ${biome}`)
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const idx = width * i + j;
                const x = topleftx + j * this.settings.tileSize;
                const z = toplefty + i * this.settings.tileSize;
                this.tilePositionsF32[4*idx + 0] = x
                this.tilePositionsF32[4*idx + 1] = this.settings.y
                this.tilePositionsF32[4*idx + 2] = z
                this.tilePositionsF32[4*idx + 3] = 0;
                this.tileBiomesF32[idx] = biome
            }
        }
    }
}