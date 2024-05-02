import { Mat3, Mat4, Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import Rand from "../lib/rand-seed/Rand.js"
import { FloorChunk, FloorChunkSettings, roundDown, whiteNoise, valueNoise, negativeMod } from "./FloorChunk.js";

enum DivisionDimension {
    X,
    Z,
}

const NUM_BIOMES = 4
const biomeRoomHeights = [6, 18, 24, 9] // maybe scale this by some factor
// yellow, pool, garage, school

class RoomTreeNode {
    public settings: FloorChunkSettings
    public minCorner: [number, number]
    public maxCorner: [number, number]
    public dimension: DivisionDimension
    public threshold: number | null = null
    public left: RoomTreeNode | null = null
    public right: RoomTreeNode | null = null
    public point: [number, number] | null = null
    public room: Room | null = null

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
            this.room = new Room(this.minCorner, this.maxCorner, this.settings) 
            rooms.push(this.room)
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

    public getBiome(xz: [number, number]): number {
        if (xz[0] < this.minCorner[0] || xz[0] >= this.maxCorner[0] 
            || xz[1] < this.minCorner[1] && xz[1] >= this.maxCorner[1]) {
            return -1
        }
        if (this.isLeaf()) {
            return this.room!.biome
        }
        if (xz[this.dimension] >= this.threshold!) {
            return this.right!.getBiome(xz)
        }
        return this.left!.getBiome(xz)
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

    public getBiome(x: number, z: number): number {
        return this.root.getBiome([x, z])
    }

    
}

export class Room {
    //public perimeter: number[][]
    public minCorner: [number, number]
    public maxCorner: [number, number]
    public tilePositionsF32: Float32Array
    public ceilingPositionsF32: Float32Array;
    public biome: number
    public tileBiomesF32: Float32Array 
    public wallPositions: Float32Array;
    public wallScales: Float32Array;
    private settings: FloorChunkSettings

    constructor(minCorner: [number, number], maxCorner: [number, number], settings: FloorChunkSettings) {
        this.minCorner = minCorner
        this.maxCorner = maxCorner
        this.settings = settings 
        const median: [number, number] = [(this.minCorner[0] + this.maxCorner[0])/2, (this.minCorner[1] + this.maxCorner[1])/2]
        this.biome = Math.floor(valueNoise(median, this.settings.tileSize, this.settings.seed) * NUM_BIOMES)
        this.generateTiles()
        this.generateWalls()
    }

    private generateTiles() {
        const topleftx = this.minCorner[0]
        const toplefty = this.minCorner[1]
        const width = (this.maxCorner[0] - this.minCorner[0])/this.settings.tileSize
        const height = (this.maxCorner[1] - this.minCorner[1])/this.settings.tileSize
        const tiles = width * height
        this.tilePositionsF32 = new Float32Array(tiles * 4);
        this.ceilingPositionsF32 = new Float32Array(tiles * 4);
        this.tileBiomesF32 = new Float32Array(tiles)
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const idx = width * i + j;
                const x = topleftx + j * this.settings.tileSize;
                const z = toplefty + i * this.settings.tileSize;
                this.tilePositionsF32[4*idx + 0] = x
                this.tilePositionsF32[4*idx + 1] = this.settings.y
                this.tilePositionsF32[4*idx + 2] = z
                this.tilePositionsF32[4*idx + 3] = 0;
                this.ceilingPositionsF32[4*idx + 0] = x
                this.ceilingPositionsF32[4*idx + 1] = this.settings.y + biomeRoomHeights[this.biome]
                this.ceilingPositionsF32[4*idx + 2] = z
                this.ceilingPositionsF32[4*idx + 3] = 0;
                this.tileBiomesF32[idx] = this.biome
            }
        }
    }

    private makeWallSide(start: number, stop: number, constCoord: number, constDimension: DivisionDimension,
        isMin: boolean, height: number, wallOffsets: number[], wallScales: number[]) {
        const length = stop - start
        const doorPanels = length / this.settings.tileSize
        const adj = this.settings.tileSize / 2
        const topYOffset = this.settings.y + 6 + (height - 6) / 2
        const bottomYOffset = this.settings.y + 3
        const constAdj = isMin ? 0.5 : -0.5

        const topOffset = start + length / 2
        const bottomOffset = (i: number) : number => start + (i + 0.5) * this.settings.tileSize   
        const wn = (i: number) : boolean => whiteNoise([bottomOffset(i), constCoord], this.settings.seed) > 0.1

        if (constDimension === DivisionDimension.X) { // along the Z dimension, vertical bar
            if (height > 6) {
                wallOffsets.push(constCoord - adj + constAdj, topYOffset, topOffset - adj, 0)
                wallScales.push(1, height - 6, length, 1)
            }
            for (let i = 0; i < doorPanels; i++) {
                if (wn(i)) {
                    wallOffsets.push(constCoord - adj + constAdj, bottomYOffset, bottomOffset(i) - adj, 0)
                    wallScales.push(1, 6, this.settings.tileSize, 1)
                }
            }
        } else { // along the X dimension, horizontal bar
            if (height > 6) {
                wallOffsets.push(topOffset - adj, topYOffset, constCoord - adj + constAdj, 0)
                wallScales.push(length, height - 6, 1, 1)
            }
            for (let i = 0; i < doorPanels; i++) {
                if (wn(i)) {
                    wallOffsets.push(bottomOffset(i) - adj, bottomYOffset, constCoord - adj + constAdj, 0)
                    wallScales.push(this.settings.tileSize, 6, 1, 1)
                }
            }
        }
    }

    private generateWalls() {
        //if (this.dimension === DivisionDimension.X) { // left and right, vertical bar
        let wallOffsets: number[] = []
        let wallScales: number[] = []

        this.makeWallSide(this.minCorner[1], this.maxCorner[1], this.minCorner[0], DivisionDimension.X,
            true, biomeRoomHeights[this.biome], wallOffsets, wallScales)
        this.makeWallSide(this.minCorner[1], this.maxCorner[1], this.maxCorner[0], DivisionDimension.X,
            false, biomeRoomHeights[this.biome], wallOffsets, wallScales)
        this.makeWallSide(this.minCorner[0], this.maxCorner[0], this.minCorner[1], DivisionDimension.Z,
            true, biomeRoomHeights[this.biome], wallOffsets, wallScales)
        this.makeWallSide(this.minCorner[0], this.maxCorner[0], this.maxCorner[1], DivisionDimension.Z,
            false, biomeRoomHeights[this.biome], wallOffsets, wallScales)
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

    public getWallBiomes(): Float32Array {
        return new Float32Array([...Array(this.wallPositions.length / 4).keys()].map(e => this.biome))
    }
}