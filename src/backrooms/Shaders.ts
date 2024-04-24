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
    attribute float blockType;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 blockOffset;
    varying float fBlockType;

    void main () {
        gl_Position = uProj * uView * (aVertPos * aScale + aOffset);
        wsPos = aVertPos * aScale + aOffset;
        normal = normalize(aNorm);
        uv = aUV;
        blockOffset = aOffset;
        fBlockType = blockType;
    }
`;

export const blankCubeFSText = `
    precision mediump float;

    uniform vec4 uLightPos;

    varying vec4 normal;
    varying vec4 wsPos;
    varying vec2 uv;
    varying vec4 blockOffset;
    varying float fBlockType;

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

    void main() {
        float seed = random(blockID(), 0.0);
        float perlinVal = perlinOctave(uv, seed);
        vec3 kd = vec3(0.9, 0.9, 0.9);
        if (fBlockType == 3.0) {
            kd = vec3(1.0, 1.0, 1.0);
        } else if (fBlockType == 1.0) {
            kd = vec3(0.0, 1.0, 0.0);
        } else if (fBlockType == 0.0) {
            kd = vec3(0.8368627451, 0.6980392156862745, 0.5521568627);
        }
        vec3 ka = vec3(0.1, 0.1, 0.1);
        vec3 noise = vec3(perlinVal, perlinVal, perlinVal);

        /* Compute light fall off */
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), normalize(normal));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);

        if (fBlockType == 3.0) {
            gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)*.88 + noise*.12, 1.0);
        } else if (fBlockType == 0.0) {
            gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)*.76 + noise*.24, 1.0);
        } else {
            gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)*noise, 1.0);
        }

        vec4 base = vec4(0.84, 0.84, 0.49, 1.0);
        vec4 stripes = vec4(0.75, 0.75, 0.44, 1.0);

        if (normal.z != 0.0) {
            gl_FragColor = (mod(wsPos.x, 0.1) < 0.025) ? stripes : base;
        } else if (normal.x != 0.0) {
            gl_FragColor = (mod(wsPos.z, 0.1) < 0.025) ? stripes : base;
        } else {
            gl_FragColor = base;
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

    void main() {
        //float seed = 0.0; // random(tileID(), 0.0);
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
        gl_FragColor = vec4(clamp(ka + dot_nl * kd, 0.0, 1.0)*(0.1 + noise*0.9), 1.0);

    }
`;
