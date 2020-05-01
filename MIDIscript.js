(function() {
    if (typeof navigator.requestMIDIAccess === "function") {
        navigator.requestMIDIAccess().then(MIDIsuccess, MIDIfailure);
    }
    else {
        document.getElementById("feedback2").textContent = "Your browser can not access the Web MIDI API.";
        document.getElementById("sign").style.backgroundColor = "rgb(220, 0, 0)";
    }

    function MIDIsuccess(access) { //request access to MIDI devices
        MIDIsign(access.inputs.size);
        access.onstatechange = function(e) { //monitor controller connections
            console.log("Device \"" + e.port.name + "\" from \"" + e.port.manufacturer + "\" " + e.port.state); //log connections and disconnections
            MIDIsign(access.inputs.size);
            for (var input of access.inputs.values()) {
                input.onmidimessage = MIDImsg;
            }
        };
        for (var input of access.inputs.values()) {
            input.onmidimessage = MIDImsg;
        }
    }

    function MIDIfailure() {
        document.getElementById("feedback2").textContent = "MIDI devices could not be accessed.";
    }

    function MIDIsign(ins) { //show number of MIDI inputs
        document.getElementById("feedback2").textContent = ins + " MIDI input(s) detected.";
        document.getElementById("sign").style.backgroundColor = (ins > 0) ? "rgb(0, 220, 0)" : "rgb(172, 172, 172)";
    }

    var ctx = null; //web audio instance
    var notes = []; //array for synth notes
    var keys = []; //array for keys
    var range = 128;
    var volume = 1.0;
    for (var i = 0; i < range; i++) {
        keys[i] = {};
        keys[i].vis = false; //visible keys
        keys[i].inc = true; //keys included in selected scale
    }

    document.body.addEventListener("click", init);
    document.body.addEventListener("keydown", init);
    function init() {
        document.getElementById("start").disabled = true;
        document.body.removeEventListener("click", init);
        document.body.removeEventListener("keydown", init);
        ctx = new AudioContext(); //web audio instance
        document.getElementById("feedback1").textContent = "Audio context created.";
        document.addEventListener("keydown", function(e) {
            if (e.keyCode == 83) {
                mute();
            }
        });
    }

    function MIDImsg(message) { //recieve signals from MIDI controller
        var note = message.data[1];
        var velocity = (message.data.length > 2) ? message.data[2] : 0; //0 if message has no velocity
        switch (message.data[0]) {
            case 144:
                if (velocity > 0) {
                    noteOn(note, velocity); //press
                }
                else {
                    noteOff(note); //release
                }
                break;
            case 128:
                noteOff(note); //release
                break;
        }
    }

    function noteOn(note, velocity) { //start playing given node at given volume
        if (ctx != null) {
            if (notes[note] == null) { //instantiate synth
                notes[note] = {}; //object for key state and settings
                var f = Math.pow(2, (note - 69) / 12) * 440; //frequency of note based on MIDI message
                notes[note].osc1 = ctx.createOscillator(); //new oscillator for note
                notes[note].osc1.type = "triangle";
                notes[note].osc1.frequency.setTargetAtTime(f, ctx.currentTime, 0);
                notes[note].masterGain = ctx.createGain(); //gain node for velocity control
                notes[note].masterGain.gain.setValueAtTime(0, ctx.currentTime); //initial mute
                notes[note].osc1.connect(notes[note].masterGain); //route oscillator to gain node
                notes[note].masterGain.connect(ctx.destination); //route gain node to output
                notes[note].osc1.start(0);
            }
            if (keys[note].inc == true) {
                notes[note].masterGain.gain.setTargetAtTime((velocity / 127) * volume, ctx.currentTime, 0.03); //attack
                notes[note].masterGain.gain.setTargetAtTime(0, ctx.currentTime + 0.03, 1); //decay
                if (keys[note].vis == true) {
                    document.getElementById("k" + note).classList.add("lit"); //visual feedback for key press
                }
            }
        }
    }

    function noteOff(note) { //stop playing given note
        if (notes[note] != null) {
            notes[note].masterGain.gain.setTargetAtTime(0, ctx.currentTime + 0.03, 0.02); //release (cutoff prevention)
            if (keys[note].vis == true) {
                document.getElementById("k" + note).classList.remove("lit"); //visual feedback for key release
            }
        }
    }

    var keyboard = document.getElementById("keys");
    keyboard.addEventListener("mousedown", function() {
        keyboard.pressed = true;
    });
    document.body.addEventListener("mouseup", function() {
        keyboard.pressed = false;
    });
    function drawboard() { //generate keyboard based on screen width
        for (var x = 0; x < range; x++) {
            keys[x].vis = false; //reset visible keys
        }
        var n = Math.floor((window.innerWidth + 50) / 200);
        var octaves = n < 7 ? n : 7;
        var size = octaves * 7 + 1; //octaves with a trailing C
        var mapper = 60 - (Math.ceil((size / 2) / 12) * 12); //size out from middle C
        var tone = 0;
        for (var i = 0; i < size; i++) {
            var key = document.createElement("li");
            if (tone == 1 || tone == 3 || tone == 6 || tone == 8 || tone == 10) {
                key.className = "key b";
                key.style.left = (20 * i); //position semitones
                i -= 1;
            }
            else {
                key.className = "key w";
            }
            key.id = "k" + mapper;
            key.addEventListener("mousedown", function() {
                noteOn(parseInt(this.id.substring(1)), 50);
            });
            key.addEventListener("mouseover", function() {
                if (keyboard.pressed) {
                    noteOn(parseInt(this.id.substring(1)), 50);
                }
            });
            key.addEventListener("mouseup", function() {
                noteOff(parseInt(this.id.substring(1)));
            });
            key.addEventListener("mouseout", function() {
                noteOff(parseInt(this.id.substring(1)));
            });
            keyboard.appendChild(key);
            keys[mapper].vis = true;
            mapper += 1;
            tone = (tone + 1) % 12; //next note
        }
    }
    drawboard();

    var enablescale = document.getElementById("enablescale");
    var tonicselect = document.getElementById("tonicselect");
    var modeselect = document.getElementById("modeselect");
    var enablestrict = document.getElementById("enablestrict");
    var mutebutton = document.getElementById("mute");
    var volumeslider = document.getElementById("volume");
    enablescale.addEventListener("change", function() { //enable scale specific functions
        if (enablescale.checked == true) {
            tonicselect.disabled = false;
            modeselect.disabled = false;
            enablestrict.disabled = false;
            hinter(tonicselect.value, modeselect.value);
        }
        else {
            tonicselect.disabled = true;
            modeselect.disabled = true;
            if (enablestrict.checked == true) {
                enablestrict.click();
            }
            enablestrict.disabled = true;
            unhint();
        }
    });
    tonicselect.addEventListener("change", function() { //change tonic
        unhint();
        if (enablestrict.checked == true) {
            includer(tonicselect.value, modeselect.value);
        }
        hinter(tonicselect.value, modeselect.value);
    });
    modeselect.addEventListener("change", function() { //change mode
        unhint();
        if (enablestrict.checked == true) {
            includer(tonicselect.value, modeselect.value);
        }
        hinter(tonicselect.value, modeselect.value);
    });
    enablestrict.addEventListener("change", function() { //enable selective key lock
        if (enablestrict.checked == true) {
            includer(tonicselect.value, modeselect.value);
        }
        else {
            for (var i = 0; i < range; i++) {
                keys[i].inc = true; //include all keys
            }
        }
    });
    mutebutton.addEventListener("click", mute);
    volumeslider.addEventListener("change", function() {
        volume = volumeslider.value / 100;
    });

    window.addEventListener("resize", function() { //generate new keyboard on resize
        while (keyboard.firstChild) {
            keyboard.removeChild(keyboard.firstChild); //erase keyboard
        }
        drawboard();
        if (enablescale.checked == true) {
            hinter(tonicselect.value, modeselect.value);
        }
    });

    function intervaler(mode) { //determine note intervals
        if (mode < 7) {
            return { it: [2, 2, 1, 2, 2, 2, 1], s: parseInt(mode) - 1 }; //diatonic
        }
        else if (mode == 7) {
            return { it: [2, 1, 2, 2, 2, 2, 1], s: -1 }; //melodic ascending minor
        }
        else if (mode == 8) {
            return { it: [2, 1, 2, 2, 1, 3, 1], s: -1 }; //harmonic minor
        }
        else if (mode == 9) {
            return { it: [1, 2, 1, 2, 1, 2, 1, 2], s: -1 }; //dominant diminished
        }
        else {
            return { it: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], s: -1 }; //chromatic (contingency)
        }
    }

    function includer(tonic, mode) { //determine included keys in a scale
        for (var i = 0; i < range; i++) {
            keys[i].inc = false; //exclude all keys
        }
        var its = intervaler(parseInt(mode));
        var s = its.s; //rotate diatonics
        var n = 0 - (12 - parseInt(tonic));
        while (n < range) {
            if (n >= 0) {
                keys[n].inc = true; //keys included in selected scale
            }
            s = (s + 1) % its.it.length; //wrap around length of array of intervals
            n += its.it[s]; //tone incrementation
        }
    }

    function hinter(tonic, mode) { //show scale hint on keyboard
        var its = intervaler(parseInt(mode));
        var s = its.s; //rotate diatonics
        var i = parseInt(tonic);
        while (i < range) {
            if (keys[i].vis == true) {
                document.getElementById("k" + i).classList.add("part"); //mark key as part of scale
                if ((i - parseInt(tonic)) - (Math.floor(i / 12) * 12) == 0) {
                    document.getElementById("k" + i).classList.add("tonic"); //mark key as tonic of scale
                }
            }
            s = (s + 1) % its.it.length;
            i += its.it[s]; //tone incrementation
        }
    }

    function unhint() { //clear scale hint from keyboard
        var allkeys = document.getElementById("keys").children;
        for (var i = 0; i < allkeys.length; i++) {
            allkeys[i].classList.remove("part");
            allkeys[i].classList.remove("tonic");
        }
    }

    function mute() { //stops all sound from keyboard
        for (var i = 0; i < notes.length; i++) {
            noteOff(i);
        }
    }
}());
