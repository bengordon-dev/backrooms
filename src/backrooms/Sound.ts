/**
 * Class for procedural sound synthesis.
 *
 * Noise functions taken from https://noisehack.com/generate-noise-web-audio-api/
 */
export class Sound {
    private audioContext = new AudioContext();
    private masterVolume: number;

    private disconnect: () => void;
    private gain: GainNode;
    private lowPass: BiquadFilterNode;
    private currentBiome = -1;

    constructor(masterVolume: number) {
        this.masterVolume = masterVolume;
    }

    update(biome: number) {
        if (this.currentBiome !== biome) {
            if (this.disconnect) {
                this.disconnect();
            }
            if (biome === 0) {
                this.disconnect = this.office();
            } else if (biome === 1) {
                this.disconnect = this.pool();
            } else if (biome === 2) {
                this.disconnect = this.garage();
            } else if (biome === 3) {
                this.disconnect = this.school();
            }
            this.currentBiome = biome;
        }
        if (biome === 1) {
            this.gain.gain.value = Math.sin(performance.now() / 1000) * 0.25 + 0.75;
        } else if (biome === 2) {
            const maxQ = 40;
            this.lowPass.Q.value = maxQ / 2 * Math.sin(performance.now() / 10 * 1000) + maxQ / 2 + 1;
            this.lowPass.Q.value = 20;
            this.lowPass.frequency.value = 200 * Math.sin(performance.now() / (30 * 1000)) + 300;
        }
    }

    /**
     * Generates a tone with the given frequency, type, and volume.
     */
    tone(frequency: number, type: OscillatorType, volume: number) {
        const oscillator = new OscillatorNode(this.audioContext, { frequency, type });
        const gain = new GainNode(this.audioContext, { gain: volume });
        oscillator.start();
        return oscillator.connect(gain);
    }

    /**
     * Generates white noise with the given volume.
     */
    whiteNoise(volume: number) {
        const bufferSize = 2 * this.audioContext.sampleRate,
        noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate),
        output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.audioContext.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;
        whiteNoise.start(0);
        const gain = new GainNode(this.audioContext, { gain: volume });
        return whiteNoise.connect(gain);
    }

    /**
     * Generates pink noise with the given volume.
     */
    pinkNoise(volume: number) {
        const bufferSize = 4096;
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        const pinkNoise = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        pinkNoise.onaudioprocess = function(e) {
            var output = e.outputBuffer.getChannelData(0);
            for (var i = 0; i < bufferSize; i++) {
                var white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.11; // (roughly) compensate for gain
                b6 = white * 0.115926;
            }
        }
        const gain = new GainNode(this.audioContext, { gain: volume });
        return pinkNoise.connect(gain);
    }

    /**
     * Generates brown noise with the given volume.
     */
    brownNoise(volume: number) {
        const bufferSize = 4096;
        let lastOut = 0.0;
        const brownNoise = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        brownNoise.onaudioprocess = function(e) {
            var output = e.outputBuffer.getChannelData(0);
            for (var i = 0; i < bufferSize; i++) {
                var white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5; // (roughly) compensate for gain
            }
        }
        const gain = new GainNode(this.audioContext, { gain: volume });
        return brownNoise.connect(gain);
    }

    office() {
        const fundamental = this.tone(120, 'sawtooth', this.masterVolume);
        const harmonic = this.tone(7680, 'sawtooth', this.masterVolume / 4);
        const noise = this.whiteNoise(this.masterVolume / 4);
        fundamental.connect(this.audioContext.destination);
        harmonic.connect(this.audioContext.destination);
        noise.connect(this.audioContext.destination);
        return () => {
            fundamental.disconnect();
            harmonic.disconnect();
            noise.disconnect();
        };
    }

    pool() {
        const noise = this.pinkNoise(this.masterVolume * 4);
        this.gain = new GainNode(this.audioContext);
        noise.connect(this.gain).connect(this.audioContext.destination);
        return () => this.gain.disconnect();
    }

    garage() {
        this.lowPass = new BiquadFilterNode(this.audioContext, { type: 'lowpass' });
        this.brownNoise(this.masterVolume * 4).connect(this.lowPass).connect(this.audioContext.destination);
        return () => this.lowPass.disconnect();
    }

    school() {
        const fundamental = this.tone(120, 'sawtooth', this.masterVolume / 2);
        const harmonic = this.tone(7680, 'sawtooth', this.masterVolume / 8);
        const noise = this.whiteNoise(this.masterVolume / 8);
        fundamental.connect(this.audioContext.destination);
        harmonic.connect(this.audioContext.destination);
        noise.connect(this.audioContext.destination);
        return () => {
            fundamental.disconnect();
            harmonic.disconnect();
            noise.disconnect();
        };
    }
}
