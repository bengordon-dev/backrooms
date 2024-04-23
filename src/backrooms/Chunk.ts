import { Mat3, Mat4, Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import Rand from "../lib/rand-seed/Rand.js"

interface ChunkSettings {
    size: number;
    seed: number;
    maxHeight: number;
}

export class ChunkLoader {
    private xBoundaries: number[] 
    private zBoundaries: number[]
    private chunks: Chunk[][]
    private radius: number
    private settings: ChunkSettings  

    constructor(size: number, radius: number, seed: number, maxHeight: number) {
        this.radius = radius
        this.settings = {size, seed, maxHeight}
        this.initializeMap()
    }

    public initializeMap() {
        const diameter = 2 * this.radius + 1
        this.chunks = Array.from(Array(diameter), () => [])
        for (let z = -this.radius; z <= this.radius; z++) {
            for (let x = -this.radius; x <= this.radius; x++) {
              this.chunks[z + this.radius].push(new Chunk(x*this.settings.size, z*this.settings.size, this.settings));
            }
        }
        const boundaries = Array.from(Array(diameter - 1).keys(), (e) => (e - this.radius + 0.5) * this.settings.size)
        this.xBoundaries = [...boundaries]
        this.zBoundaries = [...boundaries]
    }


    private addNegativeXChunks(needed: number) {
        const refX = this.xBoundaries[0]
        for (let i = 0; i < needed; i++) {
            const newXBoundary = refX - this.settings.size * (i + 1)
            const newXCenter = refX - this.settings.size * (i + 1.5)
            this.xBoundaries.unshift(newXBoundary)
            this.chunks.forEach(e => e.unshift(new Chunk(newXCenter, e[0].y, this.settings)))
        }
    }

    private addPositiveXChunks(needed: number) {
        const refX = this.xBoundaries[this.xBoundaries.length - 1]
        for (let i = 0; i < needed; i++) {
            const newXBoundary = refX + this.settings.size * (i + 1)
            const newXCenter = refX + this.settings.size * (i + 1.5)
            this.xBoundaries.push(newXBoundary)
            this.chunks.forEach(e => e.push(new Chunk(newXCenter, e[0].y, this.settings)))
        }
    }

    private addNegativeZChunks(needed: number) {
        const refZ = this.zBoundaries[0]
        for (let i = 0; i < needed; i++) {
            const newZBoundary = refZ - this.settings.size * (i + 1)
            const newZCenter = refZ - this.settings.size * (i + 1.5)
            this.zBoundaries.unshift(newZBoundary)
            let newChunks = this.chunks[0] && this.chunks[0].map(e => new Chunk(e.x, newZCenter, this.settings))
            this.chunks.unshift(newChunks)
        }
    }

    private addPositiveZChunks(needed: number) {
        const refZ = this.zBoundaries[this.zBoundaries.length - 1]
        let oldLast = this.chunks.length - 1
        for (let i = 0; i < needed; i++) {
            const newZBoundary = refZ + this.settings.size * (i + 1)
            const newZCenter = refZ + this.settings.size * (i + 1.5)
            this.zBoundaries.push(newZBoundary)
            let newChunks = this.chunks[oldLast] && this.chunks[oldLast].map(e => new Chunk(e.x, newZCenter, this.settings))
            this.chunks.push(newChunks)
        }
    }

    private removeNegativeXChunks(needed: number) {
        for (let i = 0; i < needed; i++) {
            this.xBoundaries.shift()
            this.chunks.forEach(e => e.shift())
        }
    }

    private removeNegativeZChunks(needed: number) {
        for (let i = 0; i < needed; i++) {
            this.zBoundaries.shift()
            this.chunks.shift()
        }
    }

    private removePositiveXChunks(needed: number) {
        for (let i = 0; i < needed; i++) {
            this.xBoundaries.pop()
            this.chunks.forEach(e => e.pop())
        }
    }

    private removePositiveZChunks(needed: number) {
        for (let i = 0; i < needed; i++) {
            this.zBoundaries.pop()
            this.chunks.pop()
        }
    }

    public loadAfterMovement(playerX: number, playerZ: number) {
        let [smallXIndex, smallZIndex] = this.chunkIndex(playerX - 8, playerZ - 8)
        let [extraSmallXIndex, extraSmallZIndex] = this.chunkIndex(playerX - 32, playerZ - 32)
        let [bigXIndex, bigZIndex] = this.chunkIndex(playerX + 8, playerZ + 8)
        let [extraBigXIndex, extraBigZIndex] = this.chunkIndex(playerX + 32, playerZ + 32)
        let [oldXChunks, oldZChunks] = [this.chunks[0].length, this.chunks.length]
        
        // do not remove and add from the same direction

        if (smallXIndex < this.radius) {
            this.addNegativeXChunks(this.radius - smallXIndex)
        } else if (extraSmallXIndex > this.radius) {
            this.removeNegativeXChunks(smallXIndex - this.radius)
        }

        if (smallZIndex < this.radius) {
            this.addNegativeZChunks(this.radius - smallZIndex)
        } else if (extraSmallZIndex > this.radius) {
            this.removeNegativeZChunks(smallZIndex - this.radius)
        }
        
        const targetXMargin = oldXChunks - 1 - this.radius
        if (bigXIndex > targetXMargin) {
            this.addPositiveXChunks(bigXIndex - targetXMargin)
        } else if (extraBigXIndex < targetXMargin) {
            this.removePositiveXChunks(targetXMargin - bigXIndex)
        }

        const targetZMargin = oldZChunks - 1 - this.radius
        if (bigZIndex > targetZMargin) {
            this.addPositiveZChunks(bigZIndex - targetZMargin)
        } else if (extraBigZIndex < targetZMargin) {
            this.removePositiveZChunks(targetZMargin - bigZIndex)
        } 
    }

    public getChunks() {
        return this.chunks.flat()
    }

    //Source: https://stackoverflow.com/a/402010
    private intersectsBlockStack(playerPos: Vec3, blockMinCorner: Vec2) {
        const circleR = 0.4
        const rectSize = 1.0 
        let boxCenter = new Vec2([blockMinCorner.x + 0.5, blockMinCorner.y + 0.5])
        let circleDistance = new Vec2([Math.abs(playerPos.x - boxCenter.x), Math.abs(playerPos.z - boxCenter.y)])

        if (circleDistance.x > rectSize/2 + circleR || circleDistance.y > rectSize/2 + circleR) {
            return false
        }
        if (circleDistance.x <= rectSize/2 || circleDistance.y <= rectSize/2) { 
            return true 
        } 
        let cornerDistance_sq = Math.pow(circleDistance.x - rectSize/2, 2) +
                                Math.pow(circleDistance.y - rectSize/2, 2);
        return cornerDistance_sq <= Math.pow(circleR, 2);
    }

    public chunkIndex(x: number, z: number): [number, number] {
        let zIndex = 0; let xIndex = 0
        for (; xIndex < this.xBoundaries.length && x >= this.xBoundaries[xIndex]; xIndex++);
        for (; zIndex < this.zBoundaries.length && z >= this.zBoundaries[zIndex]; zIndex++);
        return [xIndex, zIndex]
    }

    public blockFloorY(xz: Vec2) : number {
        let [xIndex, zIndex] = this.chunkIndex(xz.x, xz.y)
        let chunk = this.chunks[zIndex][xIndex]
        return chunk.height(xz)
    }

    public floorY(playerPos: Vec3) : number {
        let block = new Vec2([Math.floor(playerPos.x), Math.floor(playerPos.z)])
        let consideredHeights = [this.blockFloorY(block)]
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx !== 0 || dz !== 0) {
                    let neighbor = new Vec2([block.x + dx, block.y + dz])
                    if (this.intersectsBlockStack(playerPos, neighbor)) {
                        let newEntry = this.blockFloorY(neighbor)
                        consideredHeights.push(newEntry)
                    }
                }
            }
        }       
        return Math.max(...consideredHeights)
    }
}


export class Chunk {
    private cubes: number; // Number of cubes that should be *drawn* each frame
    private cubePositionsF32: Float32Array; // (4 x cubes) array of cube translations, in homogeneous coordinates
    private blockTypes: Float32Array; // array of enums (0, 1, 2) for grass, stone, snow
    private heights: Float32Array;
    public x : number; // Center of the chunk
    public y : number;
    private size: number; // Number of cubes along each side of the chunk
    private seed: number;
    private maxHeight: number;
    
    
    constructor(centerX : number, centerY : number, settings: ChunkSettings) {
        this.x = centerX;
        this.y = centerY;
        this.size = settings.size;
        this.cubes = this.size*this.size;  
        this.seed = settings.seed
        this.maxHeight = settings.maxHeight
        this.generateCubes();
        this.generateBiomeOffsets();
    }
    // source: https://www.youtube.com/watch?v=KllOFoUnKhU
    private static whiteNoise(block: [number, number], seed: number) {
        return this.negativeMod((Math.sin(block[0] * 12.9898 + block[1] * 78.233 + seed) + 1) * 43758.5453, 1)
    }

    private static negativeMod(x: number, n: number) : number {
        return ((x % n) + n) % n;
    }

    private static roundDown(x: number, n: number) : number {
        return x - Chunk.negativeMod(x, n)
    }


    public maxX = () => this.x + this.size / 2
    public minX = () => this.x - this.size / 2
    public maxZ = () => this.y + this.size / 2
    public minZ = () => this.y - this.size / 2
    
    
    public inBounds(x: number, z: number): boolean {
        return x >= this.minX() && x <= this.maxX()
        && z >= this.minZ() && z <= this.maxZ()
    }

    public height(xz: Vec2): number {
        if (!this.inBounds(xz.x, xz.y)) {
            return -1
        }
        let idx = (xz.x - this.minX()) + (xz.y - this.minZ()) * this.size
        return this.heights[idx]
    }

    private valueNoise(block: [number, number], gridSize: number): number {
        const topleftx = this.x - this.size / 2
        const toplefty = this.y - this.size / 2
        const topLeft: [number, number] = [
            Chunk.roundDown(block[0], gridSize) + topleftx,
            Chunk.roundDown(block[1], gridSize) + toplefty
        ]
        const topRight: [number, number] = [topLeft[0] + gridSize, topLeft[1]]
        const bottomLeft: [number, number] = [topLeft[0], topLeft[1] + gridSize]
        const bottomRight: [number, number] = [topLeft[0] + gridSize, topLeft[1] + gridSize]
        
        let tlNoise = Chunk.whiteNoise(topLeft, this.seed)
        let trNoise = Chunk.whiteNoise(topRight, this.seed)
        let blNoise = Chunk.whiteNoise(bottomLeft, this.seed)
        let brNoise = Chunk.whiteNoise(bottomRight, this.seed)
        let xFrac = (block[0] % gridSize) / (gridSize - 1)
        let yFrac = (block[1] % gridSize) / (gridSize - 1)
        let t = tlNoise * (1 - xFrac) + trNoise * xFrac
        let b = blNoise * (1 - xFrac) + brNoise * xFrac
        return t * (1 - yFrac) + b * yFrac
    }

    private octaveValueNoise(block: [number, number], octaves: number): number {
        let out = 0
        for (let i = 0; i < octaves; i++) {
            let fraction = 1 / (1 << i)
            out += 0.5 * fraction * this.valueNoise(block, this.size * fraction) 
        }
        let twoExp = 1 << octaves
        return out * twoExp / (twoExp - 1)
    }

    private considerationIndicies(idx: number): number[] {
        let out = [idx]
        if (idx % this.size < this.size - 1) {
            out.push(idx + 1)
        }
        if (idx % this.size > 0) {
            out.push(idx - 1)
        }
        if (Math.floor(idx / this.size) < this.size - 1) {
            out.push(idx + this.size)
        }
        if (Math.floor(idx / this.size) > 0) {
            out.push(idx - this.size)
        }
        return out
    }

    private generateCubes() {
        const topleftx = this.x - this.size / 2;
        const toplefty = this.y - this.size / 2;
        
        let firstCubePositions = new Float32Array(this.size * this.size * 4);
        this.heights = new Float32Array(this.size * this.size)

        
        for (let i=0; i<this.size; i++) {     
            for (let j=0; j<this.size; j++) {
                const idx = this.size * i + j;
                firstCubePositions[4*idx + 0] = topleftx + j;
                firstCubePositions[4*idx + 1] = Math.floor(this.maxHeight * this.octaveValueNoise([j, i], 4));
                this.heights[idx] = firstCubePositions[4*idx + 1] 
                firstCubePositions[4*idx + 2] = toplefty + i;
                firstCubePositions[4*idx + 3] = 0;
            }
        }
      
        let out: number[] = []

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const idx = this.size * i + j;
                let consideredBlocks = this.considerationIndicies(idx)
                let minHeight = consideredBlocks.length === 5 ? 
                    Math.min(...this.considerationIndicies(idx).map(i => this.heights[i])) : 0
                for (let y = minHeight; y <= this.heights[idx]; y++) {
                    out.push(
                        firstCubePositions[4*idx + 0],
                        y,
                        firstCubePositions[4*idx + 2],
                        0
                    )
                }
            }
        }

        this.cubePositionsF32 = new Float32Array(out)
        this.cubes = this.cubePositionsF32.length / 4
    }

    private generateBiomeOffsets() {
        let oldSeed = this.seed
        this.blockTypes = new Float32Array(this.cubes)
        for (let idx = 0; idx < this.cubes; idx++) {
            let j = this.cubePositionsF32[idx * 4] - this.minX()
            let i = this.cubePositionsF32[idx * 4 + 2] - this.minZ()
            let y = this.cubePositionsF32[idx * 4 + 1]
            this.seed *= 2.2347829342897
            let sandMax = Math.floor(18*this.octaveValueNoise([j, i], 4))
            this.seed *= 2.2347829342897
            let grassMax = 20 + Math.floor(25 * this.octaveValueNoise([j, i], 4));
            this.seed *= 2.2347829342897
            let stoneMax = 50 + Math.floor(20 * this.octaveValueNoise([j, i], 4));
            this.blockTypes[idx] = y < sandMax ? 0 : y < grassMax ? 1 : y < stoneMax ? 2 : 3
            this.seed = oldSeed
        }
    }

    public getBlockTypes(): Float32Array {
        return this.blockTypes
    }
    
    public cubePositions(): Float32Array {
        return this.cubePositionsF32
    }
    
    public numCubes(): number {
        return this.cubes;
    }
}
