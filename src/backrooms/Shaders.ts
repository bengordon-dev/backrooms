export const blankCubeVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uView;
    uniform mat4 uProj;

    attribute vec4 aNorm;
    attribute vec4 aVertPos;
    attribute vec4 aOffset;
    attribute vec4 aScale;
    attribute vec2 aUV;
    attribute float aBiome;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 blockOffset;
    varying float biome;

    void main () {
        gl_Position = uProj * uView * (aVertPos * aScale + aOffset);
        wsPos = aVertPos * aScale + aOffset;
        normal = normalize(aNorm);
        uv = aUV;
        blockOffset = aOffset;
        biome = aBiome;
    }
`;

export const blankCubeFSText = `
    precision mediump float;

    uniform vec4 uLightPos;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 blockOffset;
    varying float biome;

    float random (in vec2 pt, in float seed) {
        return fract(sin(seed + dot(pt.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    vec2 unit_vec(in vec2 xy, in float seed) {
        float theta = 6.28318530718 * random(xy, seed);
        return vec2(cos(theta), sin(theta));
    }

    float smoothmix(float a0, float a1, float w) {
        return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
    }

    float perlin(vec2 uvCoords, float gridSize, in float seed) {
        vec2 offset = mod(uvCoords, gridSize);
        vec2 fraction = offset/gridSize;

        vec2 bottomLeft = uvCoords - offset;
        vec2 bottomRight = vec2(bottomLeft.x + gridSize, bottomLeft.y);
        vec2 topLeft = vec2(bottomLeft.x, bottomLeft.y + gridSize);
        vec2 topRight = vec2(bottomLeft.x + gridSize, bottomLeft.y + gridSize);

        vec2 tlVec = unit_vec(topLeft, seed);
        vec2 trVec = unit_vec(topRight, seed);
        vec2 blVec = unit_vec(bottomLeft, seed);
        vec2 brVec = unit_vec(bottomRight, seed);

        float aDot = dot(uvCoords - bottomLeft, blVec);
        float bDot = dot(uvCoords - bottomRight, brVec);
        float cDot = dot(uvCoords - topRight, trVec);
        float dDot = dot(uvCoords - topLeft, tlVec);

        float bottom = smoothmix(aDot, bDot, mod(uvCoords.x, gridSize)/gridSize);
        float top = smoothmix(dDot, cDot, mod(uvCoords.x, gridSize)/gridSize);
        return smoothmix(bottom, top, mod(uvCoords.y, gridSize)/gridSize)*0.5 + 0.5;
    }

    float perlinOctave(vec2 uvCoords, in float seed) {
        return (0.5 * perlin(uvCoords, 1.0, seed)
            + 0.25 * perlin(uvCoords, 0.5, seed)
            + 0.25 * perlin(uvCoords, 0.25, seed));

    }

    vec2 blockID() {
        return vec2(blockOffset.x, blockOffset.z);
    }

    vec4 yellowRoom() {
        vec4 base = vec4(0.71, 0.71, 0.40, 1.0);
        vec4 stripes = vec4(0.64, 0.60, 0.31, 1.0);
        vec4 triangle = vec4(0.59, 0.56, 0.25, 1.0);

        if (normal.z != 0.0) {
            if (mod(wsPos.x, 0.5) > 0.2 && mod(wsPos.x, 0.5) < 0.3) {
                return stripes;
            } else if (mod(wsPos.y + (floor(wsPos.x / 0.5 + 0.5) * 0.5) / 2.0, 0.5) + abs(wsPos.x - floor(wsPos.x / 0.5 + 0.5) * 0.5) < 0.18) {
                return triangle;
            } else {
                return base;
            }
        } else if (normal.x != 0.0) {
            if (mod(wsPos.z, 0.5) > 0.2 && mod(wsPos.z, 0.5) < 0.3) {
                return stripes;
            } else if (mod(wsPos.y + (floor(wsPos.z / 0.5 + 0.5) * 0.5) / 2.0, 0.5) + abs(wsPos.z - floor(wsPos.z / 0.5 + 0.5) * 0.5) < 0.18) {
                return triangle;
            } else {
                return base;
            }
        } else {
            return base;
        }
    }

    vec4 poolRoom() {
        vec2 xy = vec2(wsPos.z, wsPos.y);
        if (normal.z != 0.0) {
            xy = vec2(wsPos.x, wsPos.y);
        } else if (normal.y != 0.0) {
            xy = vec2(wsPos.x, wsPos.z);
        }
        float xFrac = fract(xy.x);
        float yFrac = fract(xy.y);
        if (xFrac < 0.05 || yFrac < 0.05) {
            // Stripes
            return vec4(0.5, 0.5, 0.5, 1.0);
        }
        if (xFrac < 0.075 || yFrac < 0.075 || xFrac > 0.975 || yFrac > 0.975) {
            return vec4(0.6, 0.6, 0.6, 1.0);
        }
        if (xFrac < 0.1 || yFrac < 0.1 || xFrac > 0.95 || yFrac > 0.95) {
            return vec4(0.7, 0.7, 0.7, 1.0);
        }

        // Base color
        vec3 color = vec3(0.8, 0.8, 0.8);
        color += perlin(xy, 0.5, 0.0) * 0.2;
        return vec4(color, 1.0);
    }

    vec4 schoolHallway() {
        float x = wsPos.z;
        if (normal.z != 0.0) {
            x = wsPos.x;
        }
        vec2 xy = vec2(x, wsPos.y);
        vec3 kd = vec3(1.0, 1.0, 1.0);
        float perlinVal = perlinOctave(xy, 0.0);
        vec3 noise = vec3(perlinVal, perlinVal, perlinVal);
        if (mod(x, 16.0) < 2.0) {
            kd = vec3(0.0, 0.39, 0.9);
            return vec4(kd*(0.6 + noise*0.4), 1.0);
        }
        return vec4(kd*(0.75 + noise*0.1), 1.0);
    }

    vec4 garage() {
        vec4 base = vec4(0.6, 0.6, 0.6, 1.0);
        if (normal.z != 0.0) {
            base *= pow(perlinOctave(vec2(wsPos.x, wsPos.y), 0.0), 0.04);
        } else if (normal.x != 0.0) {
            base *= pow(perlinOctave(vec2(wsPos.z, wsPos.y), 0.0), 0.04);
        }
        base.a = 1.0;
        return base;
    }

    void main() {
        // vec3 ka = vec3(0.1, 0.1, 0.1);
        // vec3 noise = vec3(perlinVal, perlinVal, perlinVal);

        /* Compute light fall off */
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), normalize(normal));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);

        if (biome == 3.0) {
            gl_FragColor = schoolHallway();
        } else if (biome == 2.0) {
            gl_FragColor = garage();
        } else if (biome == 1.0) {
            gl_FragColor = poolRoom();
        } else {
            gl_FragColor = yellowRoom();
        }
    }
`;


export const blankTileVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uView;
    uniform mat4 uProj;
    uniform float tileSize;

    attribute vec4 aNorm;
    attribute vec4 aVertPos;
    attribute vec4 aOffset;
    attribute vec2 aUV;
    attribute float aRoomID;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 tileOffset;
    varying float roomID;

    void main () {
        vec4 scaledVertPos = vec4(aVertPos.x * tileSize, aVertPos.y, aVertPos.z * tileSize, aVertPos.w);
        gl_Position = uProj * uView * (scaledVertPos + aOffset);
        wsPos = scaledVertPos + aOffset;
        normal = normalize(aNorm);
        uv = aUV;
        tileOffset = aOffset;
        roomID = aRoomID;
    }
`;

export const blankTileFSText = `
    precision mediump float;

    uniform vec4 uLightPos;


    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 tileOffset;
    varying float roomID;

    float random (in vec2 pt, in float seed) {
        return fract(sin(seed + dot(pt.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    vec2 unit_vec(in vec2 xy, in float seed) {
        float theta = 6.28318530718 * random(xy, seed);
        return vec2(cos(theta), sin(theta));
    }

    float smoothmix(float a0, float a1, float w) {
        return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
    }

    float perlin(vec2 xzCoords, float gridSize) {
        vec2 offset = mod(mod(xzCoords, gridSize) + gridSize, gridSize);
        vec2 fraction = offset/gridSize;

        vec2 topLeft = xzCoords - offset;
        vec2 topRight = vec2(topLeft.x + gridSize, topLeft.y);
        vec2 bottomLeft = vec2(topLeft.x, topLeft.y + gridSize);
        vec2 bottomRight = vec2(topLeft.x + gridSize, topLeft.y + gridSize);

        vec2 tlVec = unit_vec(topLeft, 0.0);
        vec2 trVec = unit_vec(topRight, 0.0);
        vec2 blVec = unit_vec(bottomLeft, 0.0);
        vec2 brVec = unit_vec(bottomRight, 0.0);

        float aDot = dot(xzCoords - bottomLeft, blVec);
        float bDot = dot(xzCoords - bottomRight, brVec);
        float cDot = dot(xzCoords - topRight, trVec);
        float dDot = dot(xzCoords - topLeft, tlVec);

        float bottom = aDot * (1.0 - fraction.x) + bDot * fraction.x; //smoothmix(aDot, bDot, mod(fraction.x, gridSize)/gridSize);
        float top = dDot * (1.0 - fraction.x) + cDot * fraction.x; //smoothmix(dDot, cDot, mod(fraction.x, gridSize)/gridSize);
        float mix = top * (1.0 - fraction.y) + bottom * fraction.y;        //smoothmix(bottom, top, mod(fraction.y, gridSize)/gridSize)*0.5 + 0.5;
        return mix * 0.5 + 0.5;
    }

    float perlinOctave(vec2 xzCoords) {
        return (0.5 * perlin(xzCoords, 1.0)
            + 0.25 * perlin(xzCoords, 0.5)
            + 0.125 * perlin(xzCoords, 0.25)
            + 0.0625 * perlin(xzCoords, 0.125));

    }

    vec2 tileID() {
        return vec2(tileOffset.x, tileOffset.z);
    }

    vec4 perlinRoom() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        float perlinVal = perlinOctave(xz);
        vec3 kd = vec3(0.7, 0.7, 0.0);
        if (roomID == 3.0) {
            kd = vec3(0.7, 0.0, 0.7);
        } else if (roomID == 2.0) {
            kd = vec3(0.0, 0.7, 0.7);
        } else if (roomID == 1.0) {
            kd = vec3(0.7, 0.0, 0.0);
        }
        vec3 ka = vec3(0.1, 0.1, 0.1);
        vec3 noise = vec3(perlinVal, perlinVal, perlinVal);
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), normalize(normal));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);
        return vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)*(0.1 + noise*0.9), 1.0);
    }

    vec4 poolRoom() {
        vec2 xy = vec2(wsPos.x, wsPos.z);
        float xFrac = fract(xy.x);
        float yFrac = fract(xy.y);
        vec3 color = vec3(0.8, 0.8, 0.8) + perlin(xy, 0.5) * 0.2;
        if (xFrac < 0.05 || yFrac < 0.05) {
            // Stripes
            color = vec3(0.5, 0.5, 0.5);
        } else if (xFrac < 0.075 || yFrac < 0.075 || xFrac > 0.975 || yFrac > 0.975) {
            color = vec3(0.6, 0.6, 0.6);
        } else if (xFrac < 0.1 || yFrac < 0.1 || xFrac > 0.95 || yFrac > 0.95) {
            color = vec3(0.7, 0.7, 0.7);
        }

        // Base color
        return vec4(color * vec3(0.7, 0.95, 0.95), 1.0);
    }

    vec4 yellowRoom() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        vec4 color = vec4(0.91, 0.91, 0.40, 1.0);
        color *= pow(perlin(xz, 0.0625), 0.75);
        color.a = 1.0;
        return color;
    }

    vec4 garage() {
        vec4 base = vec4(0.6, 0.6, 0.6, 1.0);
        if (normal.z != 0.0) {
            base *= pow(perlinOctave(vec2(wsPos.x, wsPos.y)), 0.04);
        } else if (normal.x != 0.0) {
            base *= pow(perlinOctave(vec2(wsPos.z, wsPos.y)), 0.04);
        }
        base.a = 1.0;
        if (mod(wsPos.x, 20.0) < 0.1) {
            return vec4(1.0, 1.0, 0.0, 1.0);
        }
        if (mod(wsPos.z, 3.0) < 0.1 && mod(wsPos.x + 5.0, 20.0) < 10.0) {
            return vec4(1.0, 1.0, 0.0, 1.0);
        }
        return base;
    }

    vec4 schoolHallway() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        float xFrac = abs(1.0 - mod(xz.x, 2.0));
        float yFrac = abs(1.0 - mod(xz.y, 2.0));

        float xTileIndex = floor(mod(xz.x, 16.0) / 2.0);
        float zTileIndex = floor(mod(xz.y, 16.0) / 2.0);
        float xi = abs(xTileIndex - 4.0);
        float zi = abs(zTileIndex - 4.0);
        float xDiamondIndex = floor(mod(xz.x + 8.0, 32.0) / 16.0);
        float zDiamondIndex = floor(mod(xz.y + 8.0, 32.0) / 16.0);

        float noise = random(xz, 0.0);
        float rand = 0.5 + 0.2 * noise;
        vec3 kd = vec3(rand, rand, rand);

        if ((xi + zi == 5.0) && (xDiamondIndex != zDiamondIndex)) {
            kd = vec3(0.0, 0.39, 0.9);
            kd *= (0.75 + 0.25 * noise);
        } 
        
        if (xFrac > 0.9 || yFrac > 0.9) {
            vec3 stripe = vec3(0.5, 0.5, 0.5);
            if (xFrac > 0.95 || yFrac > 0.95) {
                return vec4(stripe, 1.0);
            } else if (xFrac > 0.925 || yFrac > 0.925) {
                return vec4((stripe * 0.5) + (kd * 0.5), 1.0);
            } else {
                return vec4((stripe * 0.33) + (kd * 0.67), 1.0);
            }
        } else {
            return vec4(kd, 1.0); 
        }  
    }

    void main() {
        if (roomID == 3.0) {
            gl_FragColor = schoolHallway();
        } else if (roomID == 2.0) {
            gl_FragColor = garage();
        } else if (roomID == 1.0) {
            gl_FragColor = poolRoom();
        } else {
            gl_FragColor = yellowRoom();
        }
    }
`;

export const ceilingFSText = `
    precision mediump float;

    uniform vec4 uLightPos;


    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 tileOffset;
    varying float roomID;

    float random (in vec2 pt, in float seed) {
        return fract(sin(seed + dot(pt.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    vec2 unit_vec(in vec2 xy, in float seed) {
        float theta = 6.28318530718 * random(xy, seed);
        return vec2(cos(theta), sin(theta));
    }

    float smoothmix(float a0, float a1, float w) {
        return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
    }

    float perlin(vec2 xzCoords, float gridSize) {
        vec2 offset = mod(mod(xzCoords, gridSize) + gridSize, gridSize);
        vec2 fraction = offset/gridSize;

        vec2 topLeft = xzCoords - offset;
        vec2 topRight = vec2(topLeft.x + gridSize, topLeft.y);
        vec2 bottomLeft = vec2(topLeft.x, topLeft.y + gridSize);
        vec2 bottomRight = vec2(topLeft.x + gridSize, topLeft.y + gridSize);

        vec2 tlVec = unit_vec(topLeft, 0.0);
        vec2 trVec = unit_vec(topRight, 0.0);
        vec2 blVec = unit_vec(bottomLeft, 0.0);
        vec2 brVec = unit_vec(bottomRight, 0.0);

        float aDot = dot(xzCoords - bottomLeft, blVec);
        float bDot = dot(xzCoords - bottomRight, brVec);
        float cDot = dot(xzCoords - topRight, trVec);
        float dDot = dot(xzCoords - topLeft, tlVec);

        float bottom = aDot * (1.0 - fraction.x) + bDot * fraction.x; //smoothmix(aDot, bDot, mod(fraction.x, gridSize)/gridSize);
        float top = dDot * (1.0 - fraction.x) + cDot * fraction.x; //smoothmix(dDot, cDot, mod(fraction.x, gridSize)/gridSize);
        float mix = top * (1.0 - fraction.y) + bottom * fraction.y;        //smoothmix(bottom, top, mod(fraction.y, gridSize)/gridSize)*0.5 + 0.5;
        return mix * 0.5 + 0.5;
    }

    float perlinOctave(vec2 xzCoords) {
        return (0.5 * perlin(xzCoords, 1.0)
            + 0.25 * perlin(xzCoords, 0.5)
            + 0.125 * perlin(xzCoords, 0.25)
            + 0.0625 * perlin(xzCoords, 0.125));

    }

    vec2 tileID() {
        return vec2(tileOffset.x, tileOffset.z);
    }

    vec4 yellowRoom() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        if (mod(wsPos.x, 2.0) < 0.1 || mod(wsPos.z, 2.0) < 0.1) {
            // Stripes
            return vec4(0.59, 0.56, 0.25, 1.0);
        } else if (mod(wsPos.x, 8.0) < 2.0 && mod(wsPos.z, 8.0) < 2.0) {
            // Lights
            return vec4(1.0, 1.0, 1.0, 1.0);
        } else {
            // Base color
            vec4 color = vec4(0.84, 0.84, 0.49, 1.0);
            color *= pow(perlin(xz, 0.0625), 0.5);
            color.a = 1.0;
            return color;
        }
    }

    vec4 garage() {
        if (mod(wsPos.x, 0.5) < 0.1 && mod(wsPos.z, 0.5) < 0.1) {
            return vec4(1.0, 1.0, 1.0, 1.0);
        }
        return vec4(0.6, 0.6, 0.6, 1.0);
    }

    vec4 perlinRoom() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        float perlinVal = perlinOctave(xz);
        vec3 kd = vec3(0.7, 0.7, 0.0);
        if (roomID == 3.0) {
            kd = vec3(0.7, 0.0, 0.7);
        } else if (roomID == 2.0) {
            kd = vec3(0.0, 0.7, 0.7);
        } else if (roomID == 1.0) {
            kd = vec3(0.7, 0.0, 0.0);
        }
        vec3 ka = vec3(0.1, 0.1, 0.1);
        vec3 noise = vec3(perlinVal, perlinVal, perlinVal);
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = 1.0;//dot(normalize(lightDirection), normalize(normal));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);
        return vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)*(0.1 + noise*0.9), 1.0);
    }

    vec4 schoolHallway() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        if (abs(1.0 - mod(wsPos.x, 2.0)) > 0.95 || abs(2.0 - mod(wsPos.z, 4.0)) > 1.95) {
            // Stripes
            return vec4(0.46, 0.46, 0.46, 1.0);
        } else if (mod(wsPos.x, 8.0) < 2.0 && mod(wsPos.z, 8.0) < 4.0) {
            // Lights
            float atten = 0.5 + 0.5 * sqrt(1.0 - abs(1.0 - mod(wsPos.x, 8.0)));
            return vec4(atten, atten, atten, 1.0);
        } else {
            // Base color
            vec4 color = vec4(0.84, 0.84, 0.84, 1.0);
            color *= pow(perlin(xz, 0.0625), 0.5);
            color.a = 1.0;
            return color;
        }
    }

    vec4 poolRoom() {
        vec2 xz = vec2(wsPos.x, wsPos.z);
        float perlinVal = perlinOctave(xz);
        vec3 kd = vec3(1.0, 1.0, 1.0);
        vec3 noise = vec3(perlinVal, perlinVal, perlinVal);
        return vec4(kd*(0.7 + noise*0.15), 1.0);
    }

    void main() {
        if (roomID == 3.0) {
            gl_FragColor = schoolHallway();
        } else if (roomID == 2.0) {
            gl_FragColor = garage();
        } else if (roomID == 1.0) {
            gl_FragColor = poolRoom();
        } else {
            gl_FragColor = yellowRoom();
        }
    }
`;

export const paintingVSText = `
    precision mediump float;

    attribute vec4 vertPosition;
    attribute vec2 a_texcoord;

    varying vec2 v_texcoord;

    void main() {
        gl_Position = vertPosition;
        v_texcoord = a_texcoord;
    }
`;

export const paintingFSText = `
    precision mediump float;

    varying vec2 v_texcoord;

    uniform sampler2D u_texture;

    void main () {
        gl_FragColor = texture2D(u_texture, v_texcoord);
    }
`;
