/*
 * scanner_v001.js – Finanzapp Handy 2: Kategorien und Aussehen per QR-Code vom PC übernehmen.
 *
 * Die Kamera des Handys liest den QR-Code vom PC-Bildschirm (jsQR, läuft komplett auf dem Handy –
 * ohne Internet). Ein Paket kann aus mehreren Codes bestehen ("Teil 2 von 3"); die Reihenfolge ist
 * egal, die Teile werden gesammelt und danach entpackt (inflate_v001.js).
 *
 * Aufbau eines Codes (siehe handy_qr_v001.py am PC):
 *   "F" "A" | Format 1 | Paket-Nummer (2 Bytes) | Teil | Anzahl | Stück der gepackten Daten
 *
 * Benötigt: jsQR_1.4.0.js (window.jsQR), inflate_v001.js (window.FAinflate)
 *
 *   var s = FAscanner.starten(video, {beiTeil: fn(gelesen, anzahl), beiFertig: fn(paket), beiFehler: fn(text)});
 *   s.stoppen();
 */
(function (global) {
    "use strict";

    var FORMAT = 1;

    /** Sammelt die Teile eines Pakets. */
    function Sammler() { this.id = null; this.anzahl = 0; this.teile = {}; }

    /**
     * Verarbeitet die Bytes eines gelesenen Codes.
     * Rückgabe: {art: "teil"|"fertig"|"fremd"|"link"|"doppelt"|"fehler", gelesen, anzahl, paket, text}
     */
    Sammler.prototype.hinzufuegen = function (bytes) {
        if (!bytes || bytes.length < 8 || bytes[0] !== 70 || bytes[1] !== 65) {
            var text = "";
            try { text = new TextDecoder("utf-8").decode(new Uint8Array(bytes || [])); } catch (e) { text = ""; }
            return { art: /^https?:\/\//i.test(text) ? "link" : "fremd" };
        }
        if (bytes[2] !== FORMAT) {
            return { art: "fehler", text: "Dieser Code ist von einer anderen Version der Finanz-App. Bitte die Handy-App aktualisieren." };
        }
        var id = (bytes[3] << 8) | bytes[4], teil = bytes[5], anzahl = bytes[6];
        if (!anzahl || !teil || teil > anzahl) { return { art: "fremd" }; }
        if (this.id !== id || this.anzahl !== anzahl) {       // neues Paket (z. B. am PC neu geöffnet)
            this.id = id; this.anzahl = anzahl; this.teile = {};
        }
        var schonDa = !!this.teile[teil];
        this.teile[teil] = Array.prototype.slice.call(bytes, 7);
        var gelesen = Object.keys(this.teile).length;
        if (gelesen < anzahl) {
            return { art: schonDa ? "doppelt" : "teil", gelesen: gelesen, anzahl: anzahl, teil: teil };
        }
        var alle = [];
        for (var i = 1; i <= anzahl; i++) { alle = alle.concat(this.teile[i]); }
        try {
            var roh = global.FAinflate.zlib(new Uint8Array(alle));
            var paket = JSON.parse(new TextDecoder("utf-8").decode(roh));
            if (!paket || paket.v !== FORMAT || !Array.isArray(paket.k) || !Array.isArray(paket.g)) { throw new Error("Inhalt"); }
            return { art: "fertig", gelesen: gelesen, anzahl: anzahl, paket: paket };
        } catch (e) {
            this.id = null; this.teile = {};
            return { art: "fehler", text: "Die Codes ließen sich nicht zusammensetzen. Bitte am PC das Fenster neu öffnen und noch einmal scannen." };
        }
    };

    function kameraFehlerText(e) {
        var name = e && e.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
            return "Die Kamera ist nicht erlaubt. In den Einstellungen des Handys (bzw. des Browsers) für diese App die Kamera erlauben und noch einmal tippen.";
        }
        if (name === "NotFoundError" || name === "OverconstrainedError") { return "Auf diesem Gerät wurde keine Kamera gefunden."; }
        if (name === "NotReadableError") { return "Die Kamera wird gerade von einer anderen App benutzt. Diese schließen und noch einmal versuchen."; }
        return "Die Kamera ließ sich nicht starten" + (e && e.message ? " (" + e.message + ")" : "") + ".";
    }

    function starten(video, rueckruf) {
        var sammler = new Sammler();
        var strom = null, aktiv = true, letzter = 0, warte = null;
        var leinwand = document.createElement("canvas");
        var ctx = leinwand.getContext("2d", { willReadFrequently: true });
        var letzterText = "";

        function stoppen() {
            aktiv = false;
            if (warte) { cancelAnimationFrame(warte); warte = null; }
            if (strom) { strom.getTracks().forEach(function (t) { t.stop(); }); strom = null; }
            try { video.pause(); } catch (e) { /* egal */ }
            video.srcObject = null;
        }

        function bild(zeit) {
            if (!aktiv) { return; }
            warte = requestAnimationFrame(bild);
            if (zeit - letzter < 110 || video.readyState < 2 || !video.videoWidth) { return; }
            letzter = zeit;
            var vw = video.videoWidth, vh = video.videoHeight;
            var faktor = Math.min(1, 1000 / Math.max(vw, vh));        // groß genug für feine Codes, aber flott
            var w = Math.round(vw * faktor), h = Math.round(vh * faktor);
            if (leinwand.width !== w) { leinwand.width = w; }
            if (leinwand.height !== h) { leinwand.height = h; }
            ctx.drawImage(video, 0, 0, w, h);
            var pixel = ctx.getImageData(0, 0, w, h);
            var code = global.jsQR(pixel.data, w, h, { inversionAttempts: "dontInvert" });
            if (!code) { return; }
            var r = sammler.hinzufuegen(code.binaryData);
            // derselbe Code wird viele Male je Sekunde gelesen - nur Neues melden
            var schluessel = (r.art === "teil" || r.art === "doppelt") ? "teil:" + r.teil : r.art;
            if (schluessel === letzterText && r.art !== "fertig") { return; }   // denselben Code nicht dauernd melden
            letzterText = schluessel;
            if (r.art === "fertig") {
                stoppen();
                rueckruf.beiFertig(r.paket);
            } else if (r.art === "teil" || r.art === "doppelt") {
                if (rueckruf.beiTeil) { rueckruf.beiTeil(r.gelesen, r.anzahl, r.art === "doppelt"); }
            } else if (r.art === "link") {
                rueckruf.beiHinweis("Das ist der Code zum Installieren. Am PC im Fenster „Handy-App“ auf den Reiter „Kategorien aufs Handy“ klicken.");
            } else if (r.art === "fremd") {
                rueckruf.beiHinweis("Das ist kein Code der Finanz-App. Am PC: „Handy-App“ → „Kategorien aufs Handy“.");
            } else {
                rueckruf.beiHinweis(r.text);
            }
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setTimeout(function () {
                rueckruf.beiFehler(global.isSecureContext === false
                    ? "Die Kamera geht nur, wenn die App über ihre https-Adresse geöffnet wird."
                    : "Dieser Browser kann die Kamera nicht benutzen.");
            }, 0);
            return { stoppen: stoppen };
        }
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        }).then(function (s) {
            if (!aktiv) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
            strom = s;
            video.setAttribute("playsinline", "");
            video.muted = true;
            video.srcObject = s;
            var p = video.play();
            if (p && p.catch) { p.catch(function () { /* iOS spielt nach der Freigabe trotzdem */ }); }
            warte = requestAnimationFrame(bild);
        }, function (e) {
            if (aktiv) { rueckruf.beiFehler(kameraFehlerText(e)); }
        });
        return { stoppen: stoppen };
    }

    global.FAscanner = { starten: starten, Sammler: Sammler };
})(typeof window !== "undefined" ? window : globalThis);
