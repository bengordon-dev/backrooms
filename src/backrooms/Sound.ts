/**
 * Class for procedural sound synthesis.
 */
export class Sound {
    private audioContext = new AudioContext();

    constructor(masterVolume: number) {
        this.tone(120, 'sawtooth', masterVolume);
        this.tone(7680, 'sawtooth', masterVolume / 4);
        this.whiteNoise(masterVolume / 4);
    }

    /**
     * Generates a tone with the given frequency, type, and volume.
     */
    tone(frequency: number, type: OscillatorType, volume: number) {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = type;
        const gain = audioContext.createGain();
        gain.gain.value = volume;
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
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
        const whiteNoiseGain = this.audioContext.createGain();
        whiteNoiseGain.gain.value = volume;
        whiteNoise.connect(whiteNoiseGain).connect(this.audioContext.destination);
    }
}
