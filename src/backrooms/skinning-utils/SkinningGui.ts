import { Camera } from "../../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./SkinningApp.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../../lib/TSM.js";
import { Bone, KeyFrame } from "./Mesh.js";
import { RenderPass } from "../../lib/webglutils/RenderPass.js";
//import { rayBoneIntersect } from "./Cylinder";

/**
 * Might be useful for designing any animation GUI
 */
interface IGUI {
  viewMatrix(): Mat4;
  projMatrix(): Mat4;
  dragStart(me: MouseEvent): void;
  drag(me: MouseEvent): void;
  dragEnd(me: MouseEvent): void;
  onKeydown(ke: KeyboardEvent): void;
}

export enum Mode {
  playback,
  edit
}


/**
 * Handles Mouse and Button events along with
 * the the camera.
 */

export class GUI implements IGUI {
  private static readonly rotationSpeed: number = 0.05;
  private static readonly zoomSpeed: number = 0.1;
  private static readonly rollSpeed: number = 0.1;
  private static readonly panSpeed: number = 0.1;
  public keyFrames: KeyFrame[] = [];
  private camera: Camera;
  private dragging: boolean;
  private fps: boolean;
  private prevX: number;
  private prevY: number;
  private prevRotation: Quat;

  private height: number;
  private viewPortHeight: number;
  private width: number;

  private animation: SkinningAnimation;

  private selectedBone: number;
  private boneDragging: boolean;

  public time: number;
  public mode: Mode;

  public hoverX: number = 0;
  public hoverY: number = 0;


  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   * @param sponge required for some of the controls
   */
  constructor(canvas: HTMLCanvasElement, animation: SkinningAnimation) {
    this.height = canvas.height;
    this.viewPortHeight = this.height - 200;
    this.width = canvas.width - 320;
    this.prevX = 0;
    this.prevY = 0;

    this.animation = animation;

    this.reset();
    this.registerEventListeners(canvas);
  }

  public getNumKeyFrames(): number {
    //TODO: Fix for the status bar in the GUI
    return this.keyFrames.length;
  }

  public getTime(): number {
  	return this.time;
  }

  public getMaxTime(): number {
    //TODO: The animation should stop after the last keyframe
    return Math.max(0, this.keyFrames.length - 1);
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.fps = false;
    this.dragging = false;
    this.time = 0;
	this.mode = Mode.edit;

    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.width / this.viewPortHeight,
      0.1,
      1000.0
    );
  }

  /**
   * Sets the GUI's camera to the given camera
   * @param cam a new camera
   */
  public setCamera(
    pos: Vec3,
    target: Vec3,
    upDir: Vec3,
    fov: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
  }

  /**
   * Returns the view matrix of the camera
   */
  public viewMatrix(): Mat4 {
    return this.camera.viewMatrix();
  }

  /**
   * Returns the projection matrix of the camera
   */
  public projMatrix(): Mat4 {
    return this.camera.projMatrix();
  }

  /**
   * Callback function for the start of a drag event.
   * @param mouse
   */
  public dragStart(mouse: MouseEvent): void {
    if (mouse.offsetY > 600) {
      // outside the main panel
      return;
    }

    // TODO: Add logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
    const boneIndex = this.animation.getScene().meshes[0].highlightedBone
    if (boneIndex != -1) {
      this.prevRotation = this.animation.getScene().meshes[0].bones[boneIndex].rotation.copy()
    }

    this.dragging = true;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
  }

  public incrementTime(dT: number): void {
    if (this.mode === Mode.playback) {
      this.time += dT;
      if (this.time >= this.getMaxTime()) {
        this.time = 0;
        this.mode = Mode.edit;
      } else {
        let startIndex = Math.floor(this.time)
        let fraction = this.time - startIndex
        let frame = KeyFrame.slerp(
          this.keyFrames[startIndex], this.keyFrames[startIndex + 1], fraction
        )
        this.animation.getScene().meshes[0].importKeyFrame(frame)
        this.camera.setKeyFrame(frame.cameraPos, frame.cameraOrientation, frame.cameraDist)
      }
    }
  }

  private worldToNDC(world: Vec3): Vec4 {
    let out = new Vec4([...world.xyz, 1]).multiplyMat4(this.viewMatrix()).multiplyMat4(this.projMatrix());
    out.scale(1 / out.w);
    return out
  }

  private worldToScreen(world: Vec3): Vec2 {
    let NDC = this.worldToNDC(world)
    return new Vec2([(NDC.x + 1) / 2 * this.width, (-NDC.y + 1) / 2 * this.viewPortHeight]);
  }


  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    let x = mouse.offsetX;
    let y = mouse.offsetY;
    if (x > 800) return;
    if (this.dragging) {
      const dx = mouse.screenX - this.prevX;
      const dy = mouse.screenY - this.prevY;
      this.prevX = mouse.screenX;
      this.prevY = mouse.screenY;

      if (dx === 0 && dy === 0) {
        return;
      }


      /* Left button, or primary button */
      const mouseDir: Vec3 = this.camera.right();
      mouseDir.scale(-dx);
      mouseDir.add(this.camera.up().scale(dy));
      mouseDir.normalize();

      const boneIndex = this.animation.getScene().meshes[0].highlightedBone
      if (boneIndex == -1) {
        switch (mouse.buttons) {
          case 1: {
            let rotAxis: Vec3 = Vec3.cross(this.camera.forward(), mouseDir);
            rotAxis = rotAxis.normalize();

            if (this.fps) {
              this.camera.rotate(rotAxis, GUI.rotationSpeed);
            } else {
              this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
            }
            break;
          }
          case 2: {
            /* Right button, or secondary button */
            this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
            break;
          }
          default: {
            break;
          }
        }
      } else {
        let oldBone = this.animation.getScene().meshes[0].bones[boneIndex]
        let bonePositionScreen = this.worldToScreen(oldBone.position)
        let boneEndpointScreen = this.worldToScreen(oldBone.endpoint)
        const angle = Math.atan2(bonePositionScreen.y - y, x - bonePositionScreen.x)
          - Math.atan2(bonePositionScreen.y - boneEndpointScreen.y, boneEndpointScreen.x - bonePositionScreen.x)
        const axis = this.camera.forward()
        const rotation = Quat.fromAxisAngle(axis, angle)
        this.animation.getScene().meshes[0].rotateBone(boneIndex, this.prevRotation.copy().multiply(rotation))
      }
    }
    else {
      let xNDC = 2 * x / this.width - 1;
      let yNDC = -(2 * y / this.viewPortHeight - 1);
      let mouseNDC = new Vec2([xNDC, yNDC]);

      let closestDistance = Infinity;
      let closestIndex = -1;

      const boneList = this.animation.getScene().meshes[0].bones;
      for (let i = 0; i < boneList.length; i++) {
        const bone = boneList[i]
        let bonePositionNDC = this.worldToNDC(bone.position)
        let boneEndpointNDC = this.worldToNDC(bone.endpoint)
        const distance = this.pointToLineSegmentDistance(mouseNDC, bonePositionNDC, boneEndpointNDC);
        if (distance < 0.1 && distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
        }
      }
      this.animation.getScene().meshes[0].highlightedBone = closestIndex
    }
  }

  // from https://stackoverflow.com/a/6853926/16458492
  private pointToLineSegmentDistance(point: Vec2, a: Vec4, b: Vec4) {
    const [x, y] = point.xy;
    const [x1, y1] = a.xy;
    const [x2, y2] = b.xy;

    var A = x - x1;
    var B = y - y1;
    var C = x2 - x1;
    var D = y2 - y1;

    var dot = A * C + B * D;
    var len_sq = C * C + D * D;
    var param = -1;
    if (len_sq != 0) //in case of 0 length line
        param = dot / len_sq;

    var xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    }
    else if (param > 1) {
      xx = x2;
      yy = y2;
    }
    else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    var dx = x - xx;
    var dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public getModeString(): string {
    switch (this.mode) {
      case Mode.edit: { return "edit: " + this.getNumKeyFrames() + " keyframes"; }
      case Mode.playback: { return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2); }
    }
  }

  /**
   * Callback function for the end of a drag event
   * @param mouse
   */
  public dragEnd(mouse: MouseEvent): void {
    this.dragging = false;
    this.prevX = 0;
    this.prevY = 0;

    if (mouse.offsetX > 800) {
      const keyFrameIndex = Math.floor(mouse.offsetY / 240)
      if (keyFrameIndex < this.keyFrames.length) {
        this.animation.selectKeyFrame(keyFrameIndex)
      }
    }

    // TODO: Handle ending highlight/dragging logic as needed

    const boneIndex = this.animation.getScene().meshes[0].highlightedBone
    if (boneIndex != -1) {
      const selectedBone = this.animation.getScene().meshes[0].bones[boneIndex]
      selectedBone.endpoint = selectedBone.position.copy().add(selectedBone.totalRotation.copy().multiplyVec3(selectedBone.endpointTranslation))

    }


  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    if (key.code.startsWith("Digit")) {
      this.keyFrames = []
      this.animation.keyframeRenderPasses = []
      this.animation.textures = []
    }

    switch (key.code) {
      // case "Digit1": {
      //   this.animation.setScene("./static/assets/skinning/split_cube.dae");
      //   break;
      // }
      // case "Digit2": {
      //   this.animation.setScene("./static/assets/skinning/long_cubes.dae");
      //   break;
      // }
      // case "Digit3": {
      //   this.animation.setScene("./static/assets/skinning/simple_art.dae");
      //   break;
      // }
      // case "Digit4": {
      //   this.animation.setScene("./static/assets/skinning/mapped_cube.dae");
      //   break;
      // }
      // case "Digit5": {
      //   this.animation.setScene("./static/assets/skinning/robot.dae");
      //   break;
      // }
      // case "Digit6": {
      //   this.animation.setScene("./static/assets/skinning/head.dae");
      //   break;
      // }
      // case "Digit7": {
      //   this.animation.setScene("./static/assets/skinning/wolf.dae");
      //   break;
      // }
      case "KeyC": {
        navigator.clipboard.writeText(JSON.stringify(this.keyFrames)).then(function() {
          alert('Copied keyframes to clipboard!');
        }, function(err) {
          alert('Failed to copy keyframes to clipboard: ' + err);
        });
        break;
      }
      case "KeyV": {
        let text = window.prompt("Paste saved keyframes from clipboard (this will overwrite your current keyframes!):");
        if (text) {
          this.keyFrames = []
          this.animation.keyframeRenderPasses = []
          this.animation.textures = []
          const parsed = JSON.parse(text);
          for (let i = 0; i < parsed.length; i++) {
            this.keyFrames.push(new KeyFrame(
              parsed[i].rotations.map(quat => new Quat([quat.values[0], quat.values[1], quat.values[2], quat.values[3]])),
              new Vec3([parsed[i].cameraPos.values[0], parsed[i].cameraPos.values[1], parsed[i].cameraPos.values[2]]),
              new Quat([parsed[i].cameraOrientation.values[0], parsed[i].cameraOrientation.values[1], parsed[i].cameraOrientation.values[2], parsed[i].cameraOrientation.values[3]]),
              parsed[i].cameraDist
            ));
            this.animation.getScene().meshes[0].importKeyFrame(this.keyFrames[this.keyFrames.length - 1])
            this.animation.saveKeyframePreview();
          }
        }
        break;
      }
      case "KeyW": {
        this.camera.offset(
            this.camera.forward().negate(),
            GUI.zoomSpeed,
            true
          );
        break;
      }
      case "KeyA": {
        this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyS": {
        this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyD": {
        this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyR": {
        this.animation.reset();
        this.keyFrames = []
        this.animation.keyframeRenderPasses = []
        this.animation.textures = []
        break;
      }
      case "ArrowLeft": {
		//TODO: Handle bone rolls when a bone is selected
        const mesh = this.animation.getScene().meshes[0]
        const boneIndex = mesh.highlightedBone
        if (boneIndex === -1) {
          this.camera.roll(GUI.rollSpeed, false);
        } else {
          const rotation = Quat.fromAxisAngle(this.camera.forward(), GUI.rollSpeed)
          mesh.rotateBone(boneIndex, mesh.bones[boneIndex].rotation.copy().multiply(rotation))
        }
        break;
      }
      case "ArrowRight": {
		//TODO: Handle bone rolls when a bone is selected
        const mesh = this.animation.getScene().meshes[0]
        const boneIndex = mesh.highlightedBone
        if (boneIndex === -1) {
          this.camera.roll(GUI.rollSpeed, true);
        } else {
          const rotation = Quat.fromAxisAngle(this.camera.forward(), -GUI.rollSpeed)
          mesh.rotateBone(boneIndex, mesh.bones[boneIndex].rotation.copy().multiply(rotation))
        }
        break;
        break;
      }
      case "ArrowUp": {
        this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
        break;
      }
      case "ArrowDown": {
        this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyK": {
        if (this.mode === Mode.edit) {
		//TODO: Add keyframes if required by project spec
          this.keyFrames.push(KeyFrame.fromMesh(this.animation.getScene().meshes[0], this.camera))
          this.animation.saveKeyframePreview();
        }
        break;
      }
      case "KeyU": {
        if (this.mode === Mode.edit) {
        //TODO: Add keyframes if required by project spec
          if (this.animation.selectedKeyFrame !== -1) {
            this.keyFrames[this.animation.selectedKeyFrame] = KeyFrame.fromMesh(this.animation.getScene().meshes[0], this.camera)
            this.animation.saveKeyframePreview(this.animation.selectedKeyFrame);
          }
        }
        break;
      }
      case "KeyP": {
        if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
        {
          this.mode = Mode.playback;
          this.time = 0;
          this.animation.getScene().meshes[0].importKeyFrame(this.keyFrames[this.keyFrames.length - 1])
        } else if (this.mode === Mode.playback) {
          this.mode = Mode.edit;
        }
        break;
      }
      case "Equal": {
        if (this.animation.selectedKeyFrame !== -1 && this.keyFrames.length > 0) {
          const frame = this.keyFrames[this.animation.selectedKeyFrame]
          this.animation.getScene().meshes[0].importKeyFrame(frame)
          this.camera.setKeyFrame(frame.cameraPos, frame.cameraOrientation, frame.cameraDist)
        }
        break;
      }

      case "Backspace": {
        if (this.animation.selectedKeyFrame !== -1) {
          this.keyFrames.splice(this.animation.selectedKeyFrame, 1)
          this.animation.keyframeRenderPasses.splice(this.animation.selectedKeyFrame, 1)
          this.animation.textures.splice(this.animation.selectedKeyFrame, 1)
          this.animation.selectedKeyFrame = -1
        }
        break;
      }

      default: {
        console.log("Key : '", key.code, "' was pressed.");
        break;
      }
    }
  }

  /**
   * Registers all event listeners for the GUI
   * @param canvas The canvas being used
   */
  private registerEventListeners(canvas: HTMLCanvasElement): void {
    /* Event listener for key controls */
    window.addEventListener("keydown", (key: KeyboardEvent) =>
      this.onKeydown(key)
    );

    /* Event listener for mouse controls */
    canvas.addEventListener("mousedown", (mouse: MouseEvent) =>
      this.dragStart(mouse)
    );

    canvas.addEventListener("mousemove", (mouse: MouseEvent) =>
      this.drag(mouse)
    );

    canvas.addEventListener("mouseup", (mouse: MouseEvent) =>
      this.dragEnd(mouse)
    );

    /* Event listener to stop the right click menu */
    canvas.addEventListener("contextmenu", (event: any) =>
      event.preventDefault()
    );
  }
}
