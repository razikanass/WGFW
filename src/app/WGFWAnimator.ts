import { ContextStore } from './store/context.store';
import { Shape } from './models/shape';
import { Shader } from './Shader';
import { GUI } from 'dat.gui';
import ShaderUtils from './ShaderUtils';
import { Uniform } from './models/uniform';
import { WGFWTimeliner } from './WGFWTimeliner';

export class WGFWAnimator {

    start: number;
    fps: number;
    fpstime: number;
    gl: WebGL2RenderingContext;
    shader: Shader;
    copyShader: Shader;
    textureCopyShader: WebGLUniformLocation;
    fbo: WebGLFramebuffer;
    depthBuffer: WebGLRenderbuffer;
    renderTexture: WebGLTexture;
    sphereTracingQuad: Shape;
    fullScreenQuad: Shape;
    canvas: HTMLCanvasElement;
    timeliner: WGFWTimeliner;

    guiData: any;
    textureData: any;
    texControls: GUI;
    guiControls: GUI;
    cameraFolder: GUI;
    sphereFolder: GUI;
    fogFolder: GUI;
    aoFolder: GUI;
    aoData: any;

    constructor(gl: WebGL2RenderingContext, shader: Shader, fbo: WebGLFramebuffer, depthBuffer: WebGLRenderbuffer,
                renderTexture: WebGLTexture, sphereTracingQuad: Shape, fullScreenQuad: Shape, canvas: HTMLCanvasElement) {
        this.start = 0.0;
        this.fps = 0;
        this.fpstime = 0.0;
        this.gl = gl;
        this.shader = shader;
        this.copyShader = new Shader('../assets/shaders/vertexTexCoordVs.glsl', '../assets/shaders/copyFs.glsl', true);
        this.copyShader.compileShaders(this.gl);
        this.copyShader.initProgramShader(this.gl);
        this.textureCopyShader = this.gl.getUniformLocation(this.copyShader.programShader, 'textures');
        this.fbo = fbo;
        this.depthBuffer = depthBuffer;
        this.renderTexture = renderTexture;
        this.sphereTracingQuad = sphereTracingQuad;
        this.fullScreenQuad = fullScreenQuad;
        this.canvas = canvas;

        this.timeliner = new WGFWTimeliner(this.gl, this.shader);

        this.initGuiData();

        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));

        this.texControls = new GUI({name: 'Texture Data', autoPlace: false});
        const customContainer = document.getElementById('texgui');
        customContainer.appendChild(this.texControls.domElement);

        this.texControls.add(this.textureData, 'thickness', 0.01, 3.0, 0.01);
        this.texControls.add(this.textureData, 'frequency', 0.01, 5.0, 0.01);
        this.texControls.add(this.textureData, 'amplitude', 0.01, 5.0, 0.01);

        this.guiControls = new GUI({name: 'Animation Data'});
        this.guiControls.add(this.guiData, 'fps');
        this.guiControls.add(this.guiData, 'speed', -5.0, 5.0, 0.001);

        this.cameraFolder = this.guiControls.addFolder('Camera');
        this.cameraFolder.add(this.guiData.camera, 'x', -5.0, 5.0, 0.01);
        this.cameraFolder.add(this.guiData.camera, 'y', 1.0, 5.0, 0.01);
        this.cameraFolder.add(this.guiData.camera, 'z', -5.0, 5.0, 0.01);

        this.sphereFolder = this.guiControls.addFolder('Sphere PBR');
        this.sphereFolder.add(this.guiData.sphere, 'metalic', 0.0, 1.0, 0.001);
        this.sphereFolder.add(this.guiData.sphere, 'roughness', 0.0, 1.0, 0.001);
        this.sphereFolder.add(this.guiData.sphere, 'reflectionOpacity', 0.0, 1.0, 0.001);

        this.fogFolder = this.guiControls.addFolder('Fog');
        this.fogFolder.add(this.guiData, 'fogAmount', 0.0, 2.5, 0.0001);
        this.fogFolder.addColor(this.guiData, 'fogColor').onChange(this.onChangeFogColor.bind(this));

        this.fogFolder = this.guiControls.addFolder('Scene');
        this.fogFolder.add(this.guiData, 'gamma', 0.8, 5.0, 0.0001);
        this.fogFolder.add(this.guiData, 'overRelaxation');
        this.fogFolder.add(this.guiData, 'showDisplacements');
        this.fogFolder.add(this.guiData, 'phongShading');
        this.fogFolder.add(this.guiData, 'pbrShading');
        this.fogFolder.add(this.guiData, 'bloom');

        this.aoFolder = this.fogFolder.addFolder('Ambient Occlusion');
        this.aoFolder.add(this.aoData, 'active');
        this.aoFolder.add(this.aoData, 'depth', 1, 6, 1);

        this.guiControls.add(this.guiData, 'pause').onChange(this.onChangePauseFlag.bind(this));
        this.guiControls.add(this.guiData, 'save');
        this.guiControls.add(this.guiData, 'record');
    }

    private initGuiData(): void {
        this.guiData = {
            fps: '0',
            speed: 0.1,
            fogAmount: 0.0,
            fogColor: [0.1, 0, 0],
            mouse: [0.0, 0.0, 0.0],
            gamma: 1.5,
            sphere: {metalic: 0.5, roughness: 0.5, reflectionOpacity: 1.0},
            overRelaxation: false,
            showDisplacements: false,
            phongShading: true,
            pbrShading: false,
            bloom: false,
            pause: false,
            camera: {x: 4.0, y: 2.0, z: 4.0},
            save: this.saveCanvasFile.bind(this),
            record: this.getRecordedAnimation.bind(this)
        };

        this.textureData = {
            thickness: 0.1,
            frequency: 0.3,
            amplitude: 0.3
        };

        this.aoData = {
            active: false,
            depth: 1,
        };
    }

    private onChangePauseFlag(): void {
        if (!this.guiData.pause) {
            this.render();
        }
    }

    private getRecordedAnimation(): void {
        /*if(this.recorder.mediaRecorder.state === "inactive"){
            this.recorder.mediaRecorder.start();
        }
        else{
            this.recorder.mediaRecorder.stop();
        }*/
        console.log('RecordedAnimationMethod !');
    }

    private onMouseMove(event): void {
        const uniform: Uniform = this.shader.shaderUniforms.mouse;
        this.guiData.mouse = [event.clientX, event.clientY];
        uniform.value = [...this.mappingMouseCoords(this.guiData.mouse)];
        this.gl.uniform2fv(uniform.location, <number[]> uniform.value);
    }

    private onChangeFogColor(): void {
        const uniform: Uniform = this.shader.shaderUniforms.fogColor;
        uniform.value = [...this.mappingColor(this.guiData.fogColor)];
        this.gl.uniform3fv(uniform.location, <number[]> uniform.value);
    }

    private onChangeValue(e): void {
        console.log(e);
    }

    private saveCanvasFile(): void {

    }
    private mapRange(from: number[], to: number[], valueToMap: number): number {
        return to[0] + (valueToMap - from[0]) * (to[1] - to[0]) / (from[1] - from[0]);
    }

    private mappingColor(color: number[]): number[] {
        const newRangeColor: number[] = [];
        for (let i = 0; i < color.length; i++) {
            newRangeColor[i] = this.mapRange([0, 255], [0, 1], color[i]);
        }
        return newRangeColor;
    }

    private mappingMouseCoords(mouse: number[]): number[] {
        const newRangeMouse: number[] = [];
        for (let i = 0; i < mouse.length; i++) {
            newRangeMouse[i] = this.mapRange([this.canvas.width, this.canvas.height], [-1, 1], mouse[i]);
        }
        return newRangeMouse;
    }

    private lerp(oldValue: number, newValue: number, lerpFactor: number): number {
        return (1 - lerpFactor) * oldValue + lerpFactor * newValue;
    }

    private nlerp(oldValue: number[], newValue: number[], lerpFactor: number): number[] {
        const res: number[] = [];
        for (let i = 0; i < oldValue.length; i++) {
            res[i] = this.lerp(oldValue[i], newValue[i], lerpFactor);
        }
        return res;
    }

    public initRenderingLoop(): void {
        window['requestAnimFrame'] = (() => {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window['mozRequestAnimationFrame'] ||
                window['oRequestAnimationFrame'] ||
                window['msRequestAnimationFrame'] || ((callback, element) => window.setTimeout(callback, 1000 / 60));
        })();
        window['cancelRequestAnimFrame'] = (() => {
            return window.cancelAnimationFrame ||
                window.webkitCancelAnimationFrame ||
                window['mozCancelRequestAnimationFrame'] ||
                window['oCancelRequestAnimationFrame'] ||
                window['msCancelRequestAnimationFrame'] ||
                window.clearTimeout;
        })();
    }

    private updateUniformsValues(elapsedTime: number): void {
        console.log(elapsedTime);
        this.shader.shaderUniforms.time.value = <number>this.shader.shaderUniforms.time.value + 0.01;
        this.shader.shaderUniforms.speed.value = this.lerp(<number> this.shader.shaderUniforms.speed.value, this.guiData.speed, 0.9);
        this.shader.shaderUniforms.fogAmount.value = this.lerp(<number> this.shader.shaderUniforms.fogAmount.value, this.guiData.fogAmount, 1.0);
        this.shader.shaderUniforms.gamma.value = this.lerp(<number> this.shader.shaderUniforms.gamma.value, this.guiData.gamma, 0.5);
        this.shader.shaderUniforms.overRelaxation.value = +this.guiData.overRelaxation;
        this.shader.shaderUniforms.showDisplacements.value = +this.guiData.showDisplacements;
        this.shader.shaderUniforms.phongShading.value = +this.guiData.phongShading;
        this.shader.shaderUniforms.pbrShading.value = +this.guiData.pbrShading;
        this.shader.shaderUniforms.camera.value = this.nlerp(<number[]> this.shader.shaderUniforms.camera.value, Object.values(this.guiData.camera), 0.01);
        this.shader.shaderUniforms.sphere.value = this.nlerp(<number[]> this.shader.shaderUniforms.sphere.value, Object.values(this.guiData.sphere), 0.5);

        const texdata: number[] = Object.values(this.textureData);
        for (let i = 0; i < (<number[]> this.shader.shaderUniforms.textureData.value).length; i++) {
            this.shader.shaderUniforms.textureData.value[i] = this.lerp(this.shader.shaderUniforms.textureData.value[i], texdata[i], this.shader.shaderUniforms.textureData.lerp[i]);
        }

        const aodata: number[] = Object.values(this.aoData);
        for (let i = 0; i < (<number[]> this.shader.shaderUniforms.uao.value).length; i++) {
            if (this.shader.shaderUniforms.uao.types[i] === ShaderUtils.UNIFORM_TYPES.BOOL) {
                this.shader.shaderUniforms.uao.value[i] = +aodata[i];
            } else if (this.shader.shaderUniforms.uao.types[i] === ShaderUtils.UNIFORM_TYPES.INT) {
                this.shader.shaderUniforms.uao.value[i] = aodata[i];
            }
        }

        this.timeliner.pause = this.guiData.pause;
    }

    private drawFullScreenQuad(gl: WebGL2RenderingContext, program: WebGLProgram): void {
        const shape: Shape = this.fullScreenQuad;

        gl.bindBuffer(gl.ARRAY_BUFFER, shape.vertexBuffer);
        const vertPosition = gl.getAttribLocation(program, 'vert_position');
        gl.enableVertexAttribArray(vertPosition);
        gl.vertexAttribPointer(vertPosition, 3, gl.FLOAT, false, 4 * 5, 0);
        const vertTexCoord = gl.getAttribLocation(program, 'vert_texCoord');
        gl.enableVertexAttribArray(vertTexCoord);
        gl.vertexAttribPointer(vertTexCoord, 2, gl.FLOAT, false, 4 * 5, 4 * 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape.indexBuffer);
        gl.drawElements(gl.TRIANGLES, shape.size, gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    public render(): void {
        if (!this.guiData.pause) {
            const elapsedtime: number = (performance.now() - this.start) / 1000.0;
            this.fps = this.lerp(this.fps, 1 / elapsedtime, 0.1);
            this.guiData.fps = this.fps;

            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.renderTexture, 0);

            {
                this.shader.draw(this.gl, this.sphereTracingQuad);
                this.updateUniformsValues(elapsedtime);

                Object.values(this.shader.shaderUniforms).forEach(uniform => {
                    switch (uniform.type) {
                        case ShaderUtils.UNIFORM_TYPES.FLOAT:
                            this.gl.uniform1f(uniform.location, <number> uniform.value);
                            break;
                        case ShaderUtils.UNIFORM_TYPES.VEC2:
                            this.gl.uniform2fv(uniform.location, <number[]> uniform.value);
                            break;
                        case ShaderUtils.UNIFORM_TYPES.VEC3:
                            this.gl.uniform3fv(uniform.location, <number[]> uniform.value);
                            break;
                        case ShaderUtils.UNIFORM_TYPES.STRUCT:
                            for (let i = 0; i < (<number[]> uniform.value).length; i++) {
                                if (uniform.types[i] === ShaderUtils.UNIFORM_TYPES.INT) {
                                    this.gl.uniform1i(uniform.location[i], uniform.value[i]);
                                } else if (uniform.types[i] === ShaderUtils.UNIFORM_TYPES.FLOAT) {
                                    this.gl.uniform1f(uniform.location[i], uniform.value[i]);
                                } else if (uniform.types[i] === ShaderUtils.UNIFORM_TYPES.BOOL) {
                                    this.gl.uniform1f(uniform.location[i], uniform.value[i]);
                                }
                            }
                            break;
                        case ShaderUtils.UNIFORM_TYPES.BOOL:
                            this.gl.uniform1f(uniform.location, +uniform.value);
                            break;
                    }
                });

                this.gl.useProgram(null);

                this.gl.flush();
            }

            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, null, 0);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

            this.gl.useProgram(this.copyShader.programShader);
            if (this.textureCopyShader != null) {
                this.gl.activeTexture(this.gl.TEXTURE1);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.renderTexture);
                this.gl.uniform1i(this.textureCopyShader, 1);
                this.gl.uniform1f(this.gl.getUniformLocation(this.copyShader.programShader, 'bloom'), +this.guiData.bloom);
            }
            this.drawFullScreenQuad(this.gl, this.copyShader.programShader);
            this.gl.useProgram(null);

            this.start = performance.now();

            window.requestAnimationFrame(this.render.bind(this));
        }
    }

}
