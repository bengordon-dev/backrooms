import { Mat4, Quat, Vec3 } from "../../lib/TSM.js";
import { Camera } from "../../lib/webglutils/Camera.js";
import { MaterialObject } from "../../lib/webglutils/Objects.js";
import {
  AttributeLoader,
  MeshGeometryLoader,
  BoneLoader,
  MeshLoader,
} from "./AnimationFileLoader.js";

//TODO: Generate cylinder geometry for highlighting bones

//General class for handling GLSL attributes
export class Attribute {
  values: Float32Array;
  count: number;
  itemSize: number;

  constructor(attr: AttributeLoader) {
    this.values = attr.values;
    this.count = attr.count;
    this.itemSize = attr.itemSize;
  }
}

//Class for handling mesh vertices and skin weights
export class MeshGeometry {
  position: Attribute;
  normal: Attribute;
  uv: Attribute | null;
  skinIndex: Attribute; // bones indices that affect each vertex
  skinWeight: Attribute; // weight of associated bone
  v0: Attribute; // position of each vertex of the mesh *in the coordinate system of bone skinIndex[0]'s joint*. Perhaps useful for LBS.
  v1: Attribute;
  v2: Attribute;
  v3: Attribute;

  constructor(mesh: MeshGeometryLoader) {
    this.position = new Attribute(mesh.position);
    this.normal = new Attribute(mesh.normal);
    if (mesh.uv) {
      this.uv = new Attribute(mesh.uv);
    }
    this.skinIndex = new Attribute(mesh.skinIndex);
    this.skinWeight = new Attribute(mesh.skinWeight);
    this.v0 = new Attribute(mesh.v0);
    this.v1 = new Attribute(mesh.v1);
    this.v2 = new Attribute(mesh.v2);
    this.v3 = new Attribute(mesh.v3);
  }
}

//Class for handling bones in the skeleton rig
export class Bone {
  public parent: number;
  public children: number[];
  public position: Vec3; // current position of the bone's joint *in world coordinates*. Used by the provided skeleton shader, so you need to keep this up to date.
  public endpoint: Vec3; // current position of the bone's second (non-joint) endpoint, in world coordinates
  public rotation: Quat; // current orientation of the joint *with respect to world coordinates*
  public totalRotation: Quat; // oritetation of the bone relative to its undeformed state, including all parent rotations
  public relativeTranslation: Vec3; // initial translation from parent
  public endpointTranslation: Vec3; // innitial translation from position to endpoint

  constructor(bone: BoneLoader) {
    this.parent = bone.parent;
    this.children = Array.from(bone.children);
    this.position = bone.position.copy();
    this.endpoint = bone.endpoint.copy();
    this.endpointTranslation = Vec3.difference(this.endpoint, this.position);
    this.totalRotation = bone.rotation.copy();
    this.rotation = bone.rotation.copy();
    this.relativeTranslation = new Vec3([0, 0, 0])
  }

  // called at the start
  public setRelativeTranslation(parentBone: Bone) {
    if (parentBone) {
      this.relativeTranslation = this.position.copy().subtract(parentBone.position)
    }
  }

  public parentChanged(parentBone: Bone) {
    this.totalRotation = parentBone.totalRotation.copy().multiply(this.rotation)
    this.position = parentBone.position.copy().add(parentBone.totalRotation.copy().multiplyVec3(this.relativeTranslation))
    // TODO: update endpoint
    this.endpoint = this.position.copy().add(this.totalRotation.copy().multiplyVec3(this.endpointTranslation))
  }
}

//Class for handling the overall mesh and rig
export class Mesh {
  public geometry: MeshGeometry;
  public worldMatrix: Mat4; // in this project all meshes and rigs have been transformed into world coordinates for you
  public rotation: Vec3;
  public bones: Bone[];
  public materialName: string;
  public imgSrc: String | null;
  public highlightedBone: number = -1;

  private boneIndices: number[];
  private bonePositions: Float32Array;
  private boneIndexAttribute: Float32Array;

  constructor(mesh: MeshLoader) {
    this.geometry = new MeshGeometry(mesh.geometry);
    this.worldMatrix = mesh.worldMatrix.copy();
    this.rotation = mesh.rotation.copy();
    this.bones = [];
    mesh.bones.forEach((bone) => {
      let newBone = new Bone(bone)
      this.bones.push(newBone);
    });
    for (let i = 0; i < this.bones.length; i++) {
      let parentBone = this.bones[this.bones[i].parent]
      this.bones[i].setRelativeTranslation(parentBone)
    }
    this.materialName = mesh.materialName;
    this.imgSrc = null;
    this.boneIndices = Array.from(mesh.boneIndices);
    this.bonePositions = new Float32Array(mesh.bonePositions);
    this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);
  }


  //TODO: Create functionality for bone manipulation/key-framing

  public getBoneIndices(): Uint32Array {
    return new Uint32Array(this.boneIndices);
  }

  public getBonePositions(): Float32Array {
    return this.bonePositions;
  }

  public getBoneIndexAttribute(): Float32Array {
    return this.boneIndexAttribute;
  }

  private rotateChildren(selectedBone: Bone) {
    for (const childIndex of selectedBone.children) {
      this.bones[childIndex].parentChanged(selectedBone)
      this.rotateChildren(this.bones[childIndex])
    }
  }

  public rotateBone(boneIndex: number, newOrientation: Quat) {
    let selectedBone = this.bones[boneIndex]
    let oldRotation = selectedBone.rotation.copy()
    selectedBone.rotation = newOrientation;
    selectedBone.totalRotation.multiply(oldRotation.inverse()).multiply(newOrientation)
    this.rotateChildren(selectedBone)
  }


  public getBoneTranslations(): Float32Array {
    let trans = new Float32Array(3 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.position.xyz;
      for (let i = 0; i < res.length; i++) {
        trans[3 * index + i] = res[i];
      }
    });
    return trans;
  }

  public getBoneRotations(): Float32Array {
    let trans = new Float32Array(4 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.totalRotation.xyzw;
      for (let i = 0; i < res.length; i++) {
        trans[4 * index + i] = res[i];
      }
    });
    return trans;
  }

  public importKeyFrame(frame: KeyFrame) {
    frame.rotations.forEach((e, i) => this.rotateBone(i, e))
  }

}

export class KeyFrame {
  public rotations: Quat[];
  public cameraPos: Vec3;
  public cameraOrientation: Quat;
  public cameraDist: number;

  constructor(rotations: Quat[], cameraPos: Vec3, cameraOrientation: Quat, cameraDist: number) {
    // TODO render to a texture
    this.rotations = rotations
    this.cameraPos = cameraPos
    this.cameraOrientation = cameraOrientation
    this.cameraDist = cameraDist
  }

  public static fromMesh(scene: Mesh, camera: Camera): KeyFrame {
    return new KeyFrame(scene.bones.map(e => e.rotation.copy()), camera.pos(), camera.orientation(), camera.distance())
  }

  public static slerp(start: KeyFrame, stop: KeyFrame, time: number): KeyFrame {
    return new KeyFrame(
      start.rotations.map((e, i) => Quat.slerpShort(e, stop.rotations[i], time)),
      Vec3.lerp(start.cameraPos, stop.cameraPos, time),
      Quat.slerpShort(start.cameraOrientation, stop.cameraOrientation, time),
      (start.cameraDist * (1 - time)) + (stop.cameraDist * time)
    )
  }
}
