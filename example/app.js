import {MediaStreamOscilloscope, getUserMedia} from "../dist/index";
import {fabric} from "fabric";

let stats = document.querySelector(".status");
let cvs   = document.querySelector(".cvs");

class AutoScale{
    // initial candidate values purposefully large so that they’re
    // immediately corrected
    offsetCandidate = 1000;
    offsetWeight = 0;
    factorCandidate = 0.1;
    factorWeight = 0;
    maxFactor = 0.1;
    minWeight = 5;
    finalMinWeight = 500;
    minWeightIncBase = 2;
    // minWeight is increased by this factor every time it’s reached
    // until it reaches finalMinWeight

    constructor(initOffset = 0, initFactor = 1){
        this.offset = initOffset;
        this.factor = initFactor;
    }

    update_and_scale(value){
        if(value < this.offsetCandidate){
            const diffOut = this.offsetCandidate - value;
            this.offsetCandidate = value;
            this.offsetWeight += 1;
            this.factorCandidate /= 1+(this.factorCandidate*diffOut)
            if(value < this.offset){
                // it’s always offset < offsetCandidate
                this.factor /= 1+(this.factor*(this.offset - value))
                this.offset = this.offsetCandidate;
            }
        }else if(this.minWeight <= this.offsetWeight){
            this.factor /= 1-(
                this.factor*(this.offsetCandidate - this.offset)
            );
            this.offset = this.offsetCandidate;
            const diffIn = value - this.offsetCandidate;
            this.offsetCandidate = value;
            this.offsetWeight = 1;
            this.factorCandidate /= 1-(this.factorCandidate*diffIn);
        }else{
            this.offsetWeight += 1;
        }
        const candidateScaledValue = this.factorCandidate*(
            value - this.offset
        );
        if(1 < candidateScaledValue){
            this.factorCandidate /= candidateScaledValue;
            if(1 < this.scale(value)){
                // it’s always factor < factorCandidate
                this.factor = this.factorCandidate;
            }
        }
        if(this.minWeight <= this.factorWeight){
            this.factor = this.factorCandidate;
            this.factorCandidate = 1/(value - this.offset);
            this.factorWeight = 1;
            this.minWeight = Math.min(
                this.finalMinWeight, this.minWeight*this.minWeightIncBase
            );
        }else{
            this.factorWeight += 1;
        }
        if(!this.factorCandidate || this.maxFactor < this.factorCandidate){
            this.factorCandidate = this.maxFactor;
        }
        if(!this.factor || this.maxFactor < this.factor){
            this.factor = (this.factor === 0) ? 1 : this.maxFactor;
        }
        return this.scale(value);
    }

    scale(value){
        return this.factor*(value - this.offset);
    }
}
class DuckRenderer{
    ducks = undefined;
    background = undefined;
    oscDataAutoScale = undefined;
    ducksCount = 5;
    constructor(canvasElement){
        let {width = 300, height = 150} = canvasElement;
        this.width = width;
        this.height = height;
        this.cvsFabric = new fabric.Canvas(canvasElement);
        this.oscDataAutoScale = new AutoScale(0, 1/64);
        this.background = new fabric.Rect({
            top: 0,
            left: 0,
            width: this.width,
            height: this.height,
            fill: "#afa"
        });
        this.ducks = Array(this.ducksCount).fill(undefined);
        this.setDucks("🦆");
    }
    init(){
        this.cvsFabric.add(this.background);
    }
    osc(data){
        // I don’t know why but the unit is different (apparently not anymore)
        const heightPx = this.height;//*8/21;
        const widthPx = this.width;
        let nextDuckIndex = 0;
        for(let i=0; i < data.length; i++){
            let x = i * (widthPx/data.length);
            const shiftX = widthPx/this.ducksCount;
            const duckIndex = Math.floor(x / shiftX);
            if(nextDuckIndex <= duckIndex){
                const normalized = Math.pow(data[i] - 128, 2);
                const v = this.oscDataAutoScale.update_and_scale(normalized);
                const duckText = this.ducks[duckIndex];
                const fontSize = 72*v;
                duckText.set({
                    left: x,
                    top: (1-v)*heightPx,
                    fontSize: fontSize,
                });
                duckText.setCoords();
                duckText.bringToFront();
                nextDuckIndex += 1;
            }
        }
    }
    primer(){
    }
    reset(){
        // this.cvsFabric.clear();
    }
    setDucks(text){
        this.ducks.forEach((prevDuck, i) => {
            prevDuck && this.cvsFabric.remove(prevDuck);
            const duckText = new fabric.Text(text);
            this.ducks[i] = duckText;
            this.cvsFabric.add(duckText);
        });
    }
}
function startOsc(){
    const renderer = new DuckRenderer(cvs);
    const fft = 32;  // the minimum; sufficient for the “ducks” rendering
    getUserMedia({audio: true})
        .then(stream=>{
            if(!stream) {
                stats.classList.add("err");
                stats.classList.remove("success");
                stats.innerHTML = "Could not Access microphone";
                return false;
            }
            stats.classList.add("success");
            stats.classList.remove("error");
            stats.innerHTML = "Listening to your microphone, Try saying something";
            let osc = new MediaStreamOscilloscope(stream, renderer, null, fft);
            osc.start();
            document.querySelector(".btn.pause").addEventListener("click",()=>{
                stats.innerHTML = "Oscilloscope Paused";
                osc.pause();
            });
            document.querySelector(".btn.reset").addEventListener("click",()=>{
                stats.innerHTML = "Oscilloscope Reset";
                osc.reset();
            });
            document.querySelector(".btn.duck").addEventListener("click",()=>{
                stats.innerHTML = "Oscilloscope switch to duck";
                renderer.setDucks("🦆");
            });
            document.querySelector(".btn.swan").addEventListener("click",()=>{
                stats.innerHTML = "Oscilloscope switch to swan";
                renderer.setDucks("🦢");
            });
            document.querySelector(".btn.bird").addEventListener("click",()=>{
                stats.innerHTML = "Oscilloscope switch to bird";
                renderer.setDucks("🐦");
            });
        });
}
document.querySelector(".start").addEventListener("click",startOsc);