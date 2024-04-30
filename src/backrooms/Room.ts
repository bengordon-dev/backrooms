import { Mat3, Mat4, Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import Rand from "../lib/rand-seed/Rand.js"
import { FloorChunk, FloorChunkSettings, roundDown, whiteNoise, valueNoise, negativeMod } from "./FloorChunk.js";

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

    private traverseHelper(rooms: Room[]) {
        if (this.isLeaf()) {
            rooms.push(new Room(this.minCorner, this.maxCorner, this.settings))
        } else {
            this.left?.traverseHelper(rooms)
            this.right?.traverseHelper(rooms)
        }
    }

    public traverse(): Room[] { //[Room[], number[], number[]] {
        let rooms: Room[] = []
        this.traverseHelper(rooms)
        return rooms
    }
}

export class RoomTree {
    private chunk: FloorChunk
    private settings: FloorChunkSettings
    private rand: Rand
    private root: RoomTreeNode
    public rooms: Room[] = []

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
        let rooms = this.root.traverse()
        this.rooms = rooms
    }

    
}

export class Room {
    //public perimeter: number[][]
    public minCorner: [number, number]
    public maxCorner: [number, number]
    public tilePositionsF32: Float32Array
    public tileBiomesF32: Float32Array 
    public wallPositions: Float32Array;
    public wallScales: Float32Array;
    private settings: FloorChunkSettings

    constructor(minCorner: [number, number], maxCorner: [number, number], settings: FloorChunkSettings) {
        this.minCorner = minCorner
        this.maxCorner = maxCorner
        this.settings = settings 
        this.generateTiles()
        this.generateWalls()
    }

    private generateTiles() {
        const topleftx = this.minCorner[0]
        const toplefty = this.minCorner[1]
        const width = (this.maxCorner[0] - this.minCorner[0])/this.settings.tileSize
        const height = (this.maxCorner[1] - this.minCorner[1])/this.settings.tileSize
        // console.log(width)
        // console.log(height)
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

    private makeWallSide(start: number, stop: number, constCoord: number, constDimension: DivisionDimension,
        height: number, wallOffsets: number[], wallScales: number[]) {
        const length = stop - start
        const adj = this.settings.tileSize / 2
        const yOffset = this.settings.y + height / 2

        // const doorFraction = whiteNoise([start, constCoord], this.settings.seed + stop)
    
        const doorLengthFraction = this.settings.tileSize / length 
        const dlfRange = Math.max(0, 1 - 3 * doorLengthFraction)
        // min = DLF, max = 1 - DLF - DLF 
        // range = Max(0, 1 - 3 * DLF)
        const wn = whiteNoise([start, stop], this.settings.seed + constCoord)
        const doorFraction = doorLengthFraction + dlfRange * wn
        const doorStart = start + doorFraction * length 
        const doorEnd = start + (doorFraction + doorLengthFraction) * length

        if (doorEnd > stop || doorStart < start || doorEnd <= doorStart) {
            console.log(`dlf ${doorLengthFraction} df ${doorFraction} ${start} ${doorStart} ${doorEnd} ${stop} const ${constCoord}`)
            console.log(`wn ${wn}`)
        }


        const firstLength = doorStart - start
        const firstMainOffset = start + firstLength / 2
        const secondLength = stop - doorEnd
        const secondMainOffset = doorEnd + secondLength / 2

        if (constDimension === DivisionDimension.X) { // along the Z dimension, vertical bar
            wallOffsets.push(constCoord - adj, yOffset, firstMainOffset - adj, 0)
            wallScales.push(1, height, firstLength, 1)
            wallOffsets.push(constCoord - adj, yOffset, secondMainOffset - adj, 0)
            wallScales.push(1, height, secondLength, 1)
        } else { // along the X dimension, horizontal bar
            wallOffsets.push(firstMainOffset - adj, yOffset, constCoord - adj, 0)
            wallScales.push(firstLength, height, 1, 1)

            wallOffsets.push(secondMainOffset - adj, yOffset, constCoord - adj, 0)
            wallScales.push(secondLength, height, 1, 1)
        }
       
    }

    private generateWalls() {
        //if (this.dimension === DivisionDimension.X) { // left and right, vertical bar
        let wallOffsets: number[] = []
        let wallScales: number[] = []

        this.makeWallSide(this.minCorner[1], this.maxCorner[1], this.minCorner[0], DivisionDimension.X,
            3, wallOffsets, wallScales)
        this.makeWallSide(this.minCorner[1], this.maxCorner[1], this.maxCorner[0], DivisionDimension.X,
            3, wallOffsets, wallScales)
        this.makeWallSide(this.minCorner[0], this.maxCorner[0], this.minCorner[1], DivisionDimension.Z,
            3, wallOffsets, wallScales)
        this.makeWallSide(this.minCorner[0], this.maxCorner[0], this.maxCorner[1], DivisionDimension.Z,
            3, wallOffsets, wallScales)
        this.wallPositions = new Float32Array(wallOffsets)
        this.wallScales = new Float32Array(wallScales)

    }

    public tilePositions(): Float32Array {
        return this.tilePositionsF32
    }

    public numTiles(): number {
        return this.tilePositionsF32.length / 4;
    }

    public getTileBiomes(): Float32Array {
        return this.tileBiomesF32
    }
}