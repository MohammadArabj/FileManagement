import { Injectable } from '@angular/core';
import { AbstractControl } from '@angular/forms';
declare var webkitSpeechRecognition: any;

@Injectable({
    providedIn: 'root'
})
export class VoiceRecognitionService {

    recognition = new webkitSpeechRecognition();
    isStoppedSpeechRecog = false;
    public text = '';
    tempWords: any;
    control!: AbstractControl;

    constructor() { }

    init() {
        this.recognition.interimResults = true;
        this.recognition.lang = 'fa-IR';
        this.recognition.addEventListener('result', (e: any) => {
            const transcript = Array.from(e.results)
                .map((result: any) => result[0])
                .map((result: any) => result.transcript)
                .join('');
            this.tempWords = transcript;
        });
    }

    start(control: AbstractControl) {
        this.control = control;
        this.isStoppedSpeechRecog = false;
        this.recognition.start();
        this.recognition.addEventListener('end', () => {
            if (this.isStoppedSpeechRecog) {
                this.recognition.stop();
            } else {
                this.wordConcat()
                this.recognition.start();
            }
        });
    }

    stop() {
        this.isStoppedSpeechRecog = true;
        this.wordConcat()
        this.recognition.stop();
    }

    wordConcat() {
        let currentValue = '';

        if (this.control.value)
            currentValue = this.control.value;

        if (this.tempWords != undefined)
            this.control.setValue(`${currentValue} ${this.tempWords}`);

        this.tempWords = '';
    }
}