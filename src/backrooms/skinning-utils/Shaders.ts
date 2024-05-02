export const floorVSText = `
    precision mediump float;

    uniform vec4 uLightPos;
    uniform mat4 uWorld;
    uniform mat4 uView;
    uniform mat4 uProj;

    attribute vec4 aVertPos;

    varying vec4 vClipPos;

    void main () {

        gl_Position = uProj * uView * uWorld * aVertPos;
        vClipPos = gl_Position;
    }
`;

export const floorFSText = `
    precision mediump float;

    uniform mat4 uViewInv;
    uniform mat4 uProjInv;
    uniform vec4 uLightPos;

    varying vec4 vClipPos;

    void main() {
        vec4 wsPos = uViewInv * uProjInv * vec4(vClipPos.xyz/vClipPos.w, 1.0);
        wsPos /= wsPos.w;
        /* Determine which color square the position is in */
        float checkerWidth = 5.0;
        float i = floor(wsPos.x / checkerWidth);
        float j = floor(wsPos.z / checkerWidth);
        vec3 color = mod(i + j, 2.0) * vec3(1.0, 1.0, 1.0);

        /* Compute light fall off */
        vec4 lightDirection = uLightPos - wsPos;
        float dot_nl = dot(normalize(lightDirection), vec4(0.0, 1.0, 0.0, 0.0));
	    dot_nl = clamp(dot_nl, 0.0, 1.0);

        gl_FragColor = vec4(clamp(dot_nl * color, 0.0, 1.0), 1.0);
    }
`;

export const sceneVSText = `
    precision mediump float;

	//Placeholder value for passing through undeformed verts
	//(should be discarded in final version of shader)
    attribute vec3 vertPosition;

    attribute vec2 aUV;
    attribute vec3 aNorm;
    attribute vec4 skinIndices;
    attribute vec4 skinWeights;

	//vertices used for bone weights (assumes up to four weights per vertex)
    attribute vec4 v0;
    attribute vec4 v1;
    attribute vec4 v2;
    attribute vec4 v3;

    varying vec4 lightDir;
    varying vec2 uv;
    varying vec4 normal;

    uniform vec4 lightPosition;
    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

	//Joint translations and rotations to determine weights (assumes up to 64 joints per rig)
    uniform vec3 jTrans[64];
    uniform vec4 jRots[64];

    vec3 qtrans(vec4 q, vec3 v) {
        return v + 2.0 * cross(cross(v, q.xyz) - q.w*v, q.xyz);
    }


    void main () {
        vec3 trans = vertPosition;

        // vi = Ui^-1 * worldPosition (we think)

        vec3 sum0 = skinWeights.x * (jTrans[int(skinIndices.x)] + qtrans(jRots[int(skinIndices.x)], v0.xyz));
        vec3 sum1 = skinWeights.y * (jTrans[int(skinIndices.y)] + qtrans(jRots[int(skinIndices.y)], v1.xyz));
        vec3 sum2 = skinWeights.z * (jTrans[int(skinIndices.z)] + qtrans(jRots[int(skinIndices.z)], v2.xyz));
        vec3 sum3 = skinWeights.w * (jTrans[int(skinIndices.w)] + qtrans(jRots[int(skinIndices.w)], v3.xyz));

        vec4 worldPosition = vec4(sum0 + sum1 + sum2 + sum3, 1.0);


        gl_Position = mProj * mView * worldPosition;

        //  Compute light direction and transform to camera coordinates
        lightDir = lightPosition - worldPosition;

        vec4 aNorm4 = vec4(aNorm, 0.0);
        normal = normalize(mWorld * vec4(aNorm, 0.0));

        uv = aUV;
    }

`;

export const sceneFSText = `
    precision mediump float;

    varying vec4 lightDir;
    varying vec2 uv;
    varying vec4 normal;

    void main () {
        gl_FragColor = vec4((normal.x + 1.0)/2.0, (normal.y + 1.0)/2.0, (normal.z + 1.0)/2.0,1.0);
    }
`;



export const skeletonVSText = `
    precision mediump float;

    attribute vec3 vertPosition;
    attribute float boneIndex;

    uniform mat4 mWorld;
    uniform mat4 mView;
    uniform mat4 mProj;

    uniform vec3 bTrans[64];
    uniform vec4 bRots[64];

    uniform int highlightedIndex;
    varying vec4 boneColor;

    vec3 qtrans(vec4 q, vec3 v) {
        return v + 2.0 * cross(cross(v, q.xyz) - q.w*v, q.xyz);
    }

    void main () {
        int index = int(boneIndex);
        if (highlightedIndex == index) {
            boneColor = vec4(0.0, 0.5, 1.0, 1.0);
        } else {
            boneColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
        gl_Position = mProj * mView * mWorld * vec4(bTrans[index] + qtrans(bRots[index], vertPosition), 1.0);
    }
`;

export const skeletonFSText = `
    precision mediump float;

    varying vec4 boneColor;

    void main () {
        gl_FragColor = boneColor;
    }
`;


export const sBackVSText = `
    precision mediump float;

    attribute vec2 vertPosition;

    varying vec2 uv;

    void main() {
        gl_Position = vec4(vertPosition, 0.0, 1.0);
        uv = vertPosition;
        uv.x = (1.0 + uv.x) / 2.0;
        uv.y = (1.0 + uv.y) / 2.0;
    }
`;

export const sBackFSText = `
    precision mediump float;

    varying vec2 uv;

    void main () {
        gl_FragColor = vec4(0.1, 0.1, 0.1, 1.0);
        if (abs(uv.y-.33) < .005 || abs(uv.y-.67) < .005) {
            gl_FragColor = vec4(1, 1, 1, 1);
        }
    }

`;

export const keyframeVSText = `
    precision mediump float;

    attribute vec2 vertPosition;
    attribute vec2 a_texcoord;

    varying vec2 v_texcoord;

    void main() {
        gl_Position = vec4(vertPosition, 0.0, 1.0);
        v_texcoord = a_texcoord;
    }
`;

export const keyframeFSText = `
    precision mediump float;

    varying vec2 v_texcoord;

    uniform sampler2D u_texture;

    void main () {
        gl_FragColor = texture2D(u_texture, v_texcoord);
    }
`;

export const highlightedKeyFrameFSText = `
    precision mediump float;

    varying vec2 v_texcoord;

    uniform sampler2D u_texture;

    void main () {
        if (v_texcoord.x < 0.025 || v_texcoord.x > 0.975 || v_texcoord.y < 0.0333 || v_texcoord.y > 0.9667) {
            gl_FragColor = vec4(1, 1, 0, 1);
        } else {
            gl_FragColor = texture2D(u_texture, v_texcoord);
        }
    }
`;