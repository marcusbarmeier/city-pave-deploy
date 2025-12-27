/**
 * voice-manager.js
 * Handles Web Speech API for Text-to-Speech (TTS) and Speech-to-Text (STT).
 * "Local First" approach.
 */

export const VoiceManager = {
    state: {
        isListening: false,
        isSpeaking: false,
        voices: [],
        recognition: null,
        synthesis: window.speechSynthesis
    },

    init: () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn("[Voice] Speech Recognition API not supported.");
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false; // Stop after one sentence
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            VoiceManager.state.isListening = true;
            console.log("[Voice] Listening...");
            window.dispatchEvent(new CustomEvent('voice-start'));
        };

        recognition.onend = () => {
            VoiceManager.state.isListening = false;
            console.log("[Voice] Stopped listening.");
            window.dispatchEvent(new CustomEvent('voice-end'));
        };

        recognition.onError = (event) => {
            console.error("[Voice] Error:", event.error);
        };

        VoiceManager.state.recognition = recognition;

        // Pre-load voices
        if (VoiceManager.state.synthesis) {
            VoiceManager.state.synthesis.onvoiceschanged = () => {
                VoiceManager.state.voices = VoiceManager.state.synthesis.getVoices();
            };
        }

        return true;
    },

    /**
     * Speak text using Native TTS
     * @param {string} text 
     */
    speak: (text) => {
        if (!VoiceManager.state.synthesis) return;

        // Cancel previous
        VoiceManager.state.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Pick a nice voice if available (e.g., Google US English)
        const voices = VoiceManager.state.voices.length ? VoiceManager.state.voices : VoiceManager.state.synthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            VoiceManager.state.isSpeaking = true;
        };

        utterance.onend = () => {
            VoiceManager.state.isSpeaking = false;
        };

        VoiceManager.state.synthesis.speak(utterance);
    },

    /**
     * Start listening for a single command.
     * Returns a Promise that resolves with the text.
     */
    listenOnce: () => {
        return new Promise((resolve, reject) => {
            if (!VoiceManager.state.recognition) {
                reject("Voice API not supported");
                return;
            }

            const rec = VoiceManager.state.recognition;

            // Handlers specifically for this session
            rec.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                console.log(`[Voice] Heard: "${transcript}"`);
                resolve(transcript);
            };

            rec.onerror = (event) => {
                reject(event.error);
            };

            try {
                rec.start();
            } catch (e) {
                // effective restart if already running
                rec.stop();
                setTimeout(() => rec.start(), 100);
            }
        });
    }
};
