class Animation {
    constructor(gl, shader, canvas) {
        this.start = 0.0;
        this.fps = 0;
        this.fpstime = 0.0;
        this.gl = gl;
        this.shader = shader;
        this.canvas = canvas;

        this.guiData = {
            speed: 0.1,
            fogAmount: 0.016, 
            fogColor: [0.1,0,0], 
            gamma: 0.8,
            pause: false,
            camera: {x:2.0, y:3.0, z:4.0},
            save:this.saveCanvasFile.bind(this)
        };

        this.guiControls = new dat.GUI({name:'Animation Data'});
        this.guiControls.add(this.guiData, 'speed', 0.0, 5.0, 0.01).onChange(this.onChangeValue.bind(this));
        
        this.cameraFolder = this.guiControls.addFolder('Camera');
        this.cameraFolder.add(this.guiData.camera,'x',-5.0,5.0,0.01);
        this.cameraFolder.add(this.guiData.camera,'y',1.0,5.0,0.01);
        this.cameraFolder.add(this.guiData.camera,'z',-5.0,5.0,0.01);
        
        this.fogFolder = this.guiControls.addFolder('Fog');
        this.fogFolder.add(this.guiData, 'fogAmount', 0.0, 2.5, 0.0001).onChange(this.onChangeValue.bind(this));
        this.fogFolder.addColor(this.guiData, 'fogColor').onChange(this.onChangeFogColor.bind(this));

        this.fogFolder = this.guiControls.addFolder('Scene');
        this.fogFolder.add(this.guiData, 'gamma', 0.8, 2.0, 0.0001).onChange(this.onChangeValue.bind(this));

        this.guiControls.add(this.guiData, 'pause').onChange(this.onChangePauseFlag.bind(this));
        this.guiControls.add(this.guiData, 'save');
    }

    onChangePauseFlag(){
        if(!this.guiData.pause){
            this.render();
        }
    }

    onChangeFogColor(){
        this.shader.uniforms.fogColor.value = this.mappingColor(this.guiData.fogColor);
        this.gl.uniform3fv(this.shader.uniforms.fogColor.location, this.shader.uniforms.fogColor.value);
    }

    onChangeValue(e){
        console.log(e);
    }

    saveCanvasFile(){

    }

    mappingColor(color){
        var mapRange = function(from, to, s) {
            return to[0] + (s - from[0]) * (to[1] - to[0]) / (from[1] - from[0]);
        };
        var newRangeColor = [];
        for(var i = 0; i < color.length; i++){
            newRangeColor[i] = mapRange([0,255], [0,1], color[i]);
        }
        return newRangeColor;
    }

    lerp(oldValue, newValue, lerpFactor){
        return (1 - lerpFactor) * oldValue + lerpFactor * newValue;
    }

    nlerp(oldValue, newValue, lerpFactor){
        var res = [];
        for(var i = 0; i < oldValue.length; i++){
            res[i] = this.lerp(oldValue[i], newValue[i], lerpFactor);
        }
        return res;
    }

    initRenderingLoop() {
        window.requestAnimFrame = (function() {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function(callback, element) {
                    return window.setTimeout(callback, 1000 / 60);
                };
        })();

        window.cancelRequestAnimFrame = (function() {
            return window.cancelCancelRequestAnimationFrame ||
                window.webkitCancelRequestAnimationFrame ||
                window.mozCancelRequestAnimationFrame ||
                window.oCancelRequestAnimationFrame ||
                window.msCancelRequestAnimationFrame ||
                window.clearTimeout;
        })();
    }

    render() {
        if(!this.guiData.pause){
            var elapsedtime = (Date.now() - this.start) / 1000.0;
            var framespeed = 1.0;
            this.shader.uniforms.time.value += 0.01;
            this.gl.uniform1f(this.shader.uniforms.time.location, this.shader.uniforms.time.value);

            this.shader.uniforms.speed.value = this.lerp(this.shader.uniforms.speed.value, this.guiData.speed, 0.03);
            this.gl.uniform1f(this.shader.uniforms.speed.location, this.shader.uniforms.speed.value);

            this.shader.uniforms.fogAmount.value = this.lerp(this.shader.uniforms.fogAmount.value, this.guiData.fogAmount, 0.03);
            this.gl.uniform1f(this.shader.uniforms.fogAmount.location, this.shader.uniforms.fogAmount.value);

            this.shader.uniforms.gamma.value = this.lerp(this.shader.uniforms.gamma.value, this.guiData.gamma, 0.03);
            this.gl.uniform1f(this.shader.uniforms.gamma.location, this.shader.uniforms.gamma.value);

            this.shader.uniforms.camera.value = this.nlerp(this.shader.uniforms.camera.value, Object.values(this.guiData.camera), 0.03);
            this.gl.uniform3fv(this.shader.uniforms.camera.location, this.shader.uniforms.camera.value);

            this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

            this.fps++;
            this.fpstime += elapsedtime;
            if (this.fpstime >= 1.0) {
                this.fpstime -= 1.0;
                this.fps = 0;
            }

            this.start = Date.now();

            /*
            var img_b64 = this.canvas.toDataURL('image/png');

            fetch(img_b64).then(res => res.blob()).then(blob => {
                blob.lastModifiedDate = new Date();
                blob.name = "fileName"+this.shader.uniforms.time.value;
                console.log(blob);
            });
            */

            window.requestAnimationFrame(this.render.bind(this));
        }
    }
}